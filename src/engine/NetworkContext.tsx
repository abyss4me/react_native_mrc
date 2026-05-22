import React, { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { Vibration, Platform, ToastAndroid, Alert } from 'react-native';
import ClientManager from '../services/ClientManager'; // Make sure the path is correct
import { ServerMessage, GameState, MessageTypes } from '../types/ProtocolTypes'; // Import your types

interface NetworkContextType {
    client: ClientManager | null;
    serverData: GameState;
    isDisconnected: boolean;
    connectionError: string | null;
    sendMessage: (type: string, data?: any) => void;
    connect: (p_param: string) => void;
    reconnect: () => void;
    disconnect: () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

interface Props {
    children: ReactNode;
    layouts?: any;
    onScreenChange: (screenId: string) => void;
    onConfigUrlReceived?: (url: string) => void;
}

export const NetworkProvider: React.FC<Props> = ({ children, layouts, onScreenChange, onConfigUrlReceived }) => {
    const [client, setClient] = useState<ClientManager | null>(null);
    const [serverData, setServerData] = useState<GameState>({});
    const [isDisconnected, setIsDisconnected] = useState(false); // State for disconnect overlay
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const onScreenChangeRef = useRef(onScreenChange);
    const onConfigUrlReceivedRef = useRef(onConfigUrlReceived);

    // As you requested, we keep the declaration inside using useRef.
    // Note: useRef does NOT reset to null on re-renders. It only resets if the Provider unmounts completely.
    const managerRef = useRef<ClientManager | null>(null);

    useEffect(() => {
        onScreenChangeRef.current = onScreenChange;
    }, [onScreenChange]);

    useEffect(() => {
        onConfigUrlReceivedRef.current = onConfigUrlReceived;
    }, [onConfigUrlReceived]);

    useEffect(() => {
        const appController = {
            dispatch: (msg: any) => {
                const data = msg.data?.data || {};
                if (msg.type === MessageTypes.SET_SCREEN) {
                    const { screenId, ...restOfData } = data;

                    const clonedData = JSON.parse(JSON.stringify(restOfData));
                    /*
                        Patches allow you to update only specific properties of (multiple at a time) components without needing to resend the entire component data.
                         The patch applying logic checks if the property you want to update is a nested object. Instead of replacing the entire object, it shallow-merges it:
                         This guarantees that if you push an update to style: { opacity: 1 }, it won't overwrite other existing style properties (like margins, padding, etc.) that your components might already have!
                    */
                    if (data.patches && Array.isArray(data.patches)) {
                        clonedData.components = clonedData.components || {};
                        data.patches.forEach((patch: any) => {
                            const { target, props } = patch;
                            if (target?.ids && Array.isArray(target.ids) && props) {
                                target.ids.forEach((id: string) => {
                                    clonedData.components[id] = clonedData.components[id] || {};
                                    Object.keys(props).forEach(key => {
                                        if (typeof props[key] === 'object' && props[key] !== null && !Array.isArray(props[key])) {
                                            clonedData.components[id][key] = { ...(clonedData.components[id][key] || {}), ...props[key] };
                                        } else {
                                            clonedData.components[id][key] = props[key];
                                        }
                                    });
                                });
                            }
                        });
                    }

                    if (data && data.components) {
                        // For efficient lookups, create a map of components from the layout, keyed by their ID.
                        const layoutComponents = layouts?.screens[data?.screenId]?.layout || {};
                        const layoutComponentsById = Object.values(layoutComponents).reduce((acc, comp: any) => {
                            if (comp?.id) {
                                acc[comp.id] = comp;
                            }
                            return acc;
                        }, {} as { [id: string]: any });

                        for (const componentId in data.components) {
                            const incomingComponent = data.components[componentId];
                            if (incomingComponent?.style) {
                                const layoutComponent = layoutComponentsById[componentId];
                                const baseStyle = layoutComponent?.style || {};
                                
                                // Ensure the style object exists on the cloned data before merging
                                clonedData.components[componentId] = clonedData.components[componentId] || {};
                                clonedData.components[componentId].style = { ...baseStyle, ...incomingComponent.style };
                            }
                        }
                    }

                    const baseUrl = layouts?.settings?.assetsBaseUrl || '';

                    if (clonedData.components && baseUrl) {
                         Object.keys(clonedData.components).forEach(key => {
                             const comp = clonedData.components[key];
                             if (comp.texture && typeof comp.texture === 'string' && !comp.texture.startsWith('http') && !comp.texture.startsWith('https')) {
                                 comp.texture = `${baseUrl}${comp.texture}`;
                             }
                             if (comp.src && typeof comp.src === 'string' && !comp.src.startsWith('http') && !comp.src.startsWith('https')) {
                                 comp.src = `${baseUrl}${comp.src}`;
                             }
                         });
                    }
                    setServerData(clonedData as GameState);
                    if (screenId && onScreenChangeRef.current) {
                        onScreenChangeRef.current(screenId);
                    }
                }

                if (msg.type === MessageTypes.UPDATE_COMPONENTS) {
                    setServerData(prev => {
                        // Deep clone previous components to start safely
                        const updatedComponents = JSON.parse(JSON.stringify(prev.components || {}));

                        if (data.patches && Array.isArray(data.patches)) {
                            data.patches.forEach((patch: any) => {
                                const { target, props } = patch;
                                if (target?.ids && Array.isArray(target.ids) && props) {
                                    target.ids.forEach((id: string) => {
                                        updatedComponents[id] = updatedComponents[id] || {};
                                        Object.keys(props).forEach(key => {
                                            if (typeof props[key] === 'object' && props[key] !== null && !Array.isArray(props[key])) {
                                                updatedComponents[id][key] = { ...(updatedComponents[id][key] || {}), ...props[key] };
                                            } else {
                                                updatedComponents[id][key] = props[key];
                                            }
                                        });
                                    });
                                }
                            });
                        }

                        // Merge logic for components receiving direct updates
                        if (data && data.components) {
                            // Find base properties by looking across all screens
                            const layoutComponentsById = Object.values(layouts?.screens || {}).reduce((acc: any, screen: any) => {
                                Object.values(screen?.layout || {}).forEach((comp: any) => {
                                    if (comp?.id) {
                                        acc[comp.id] = comp;
                                    }
                                });
                                return acc;
                            }, {});

                            for (const componentId in data.components) {
                                const incomingComponent = data.components[componentId];
                                const layoutComponent = layoutComponentsById[componentId] || {};
                                const prevComponent = prev.components?.[componentId] || {};

                                // Merge layout base, previous state, and incoming updates (restoring missing root bounds)
                                updatedComponents[componentId] = {
                                    ...layoutComponent,
                                    ...prevComponent,
                                    ...(updatedComponents[componentId] || {}), // Include patches applied above
                                    ...incomingComponent,
                                    style: {
                                        ...(layoutComponent.style || {}),
                                        ...(prevComponent.style || {}),
                                        ...(incomingComponent.style || {})
                                    }
                                };
                            }
                        }

                        const baseUrl = layouts?.settings?.assetsBaseUrl || '';

                        Object.keys(updatedComponents).forEach((key) => {
                            const comp = updatedComponents[key];
                            if (comp.texture && typeof comp.texture === 'string' && baseUrl && !comp.texture.startsWith('http') && !comp.texture.startsWith('https')) {
                                comp.texture = `${baseUrl}${comp.texture}`;
                            }
                            if (comp.src && typeof comp.src === 'string' && baseUrl && !comp.src.startsWith('http') && !comp.src.startsWith('https')) {
                                comp.src = `${baseUrl}${comp.src}`;
                            }
                        });

                        return {
                            ...prev,
                            ...data,
                            components: updatedComponents
                        };
                    });
                }


                if (msg.type === MessageTypes.TRIGGER_HAPTICS) {
                    // Supports a custom pattern array or a simple duration (default 400ms)
                    const pattern = data?.pattern;
                    const duration = data?.duration || 400;

                    if (pattern && Array.isArray(pattern)) {
                        Vibration.vibrate(pattern);
                    } else {
                        Vibration.vibrate(duration);
                    }
                }

                if (msg.type === MessageTypes.SHOW_ERROR) {
                    const message = data?.message || "An error occurred";
                    if (Platform.OS === 'android') {
                        ToastAndroid.show(message, ToastAndroid.SHORT);
                    } else {
                        Alert.alert("Notice", message);
                    }
                }

                if (msg.type === MessageTypes.GAME_STATE) {
                    const configUrl = msg?.data?.state?.controllerConfigURL || "";
                    if (configUrl && onConfigUrlReceivedRef.current) {
                        onConfigUrlReceivedRef.current(configUrl);
                    }

                    // Synchronize screen and data after reconnection.
                    // Critical for reconnection: configUrl hasn't changed so fetchLayout won't re-run,
                    // so we must restore the screen and state directly from the gameState message.
                    const stateData = msg.data?.state?.data || {};
                    const { screenId, ...restOfData } = stateData;
                    if (Object.keys(restOfData).length > 0) {
                        setServerData(restOfData as GameState);
                    }
                    if (screenId && onScreenChangeRef.current) {
                        onScreenChangeRef.current(screenId);
                    }

                    setIsDisconnected(false);
                }

                // Handle connection status changes
                if (msg.type === MessageTypes.CONNECTION_STATUS) {
                    setIsDisconnected(!data.isConnected);
                }

                if (msg.type === MessageTypes.CONNECTION_TIMEOUT) {
                    setConnectionError(data.message || "Unable to connect, please try again");
                }

                if (msg.type === MessageTypes.CLEAR_CONNECTION_ERROR) {
                    setConnectionError(null);
                }
            },
            onConnectionEstablished: () => {
                setIsDisconnected(false); // Hide overlay on connection
                setConnectionError(null);
            }
        };

        if (!managerRef.current) {
            const cm = new ClientManager(appController);
            managerRef.current = cm;
            setClient(cm);
        } else {
            managerRef.current.appController = appController;
        }

        return () => {
            managerRef.current.disconnect();
            // Not destroying instance here to support Strict Mode mounting gracefully
        };
    }, []);

    const value = useMemo(() => ({
        client,
        serverData,
        sendMessage: (type: string, data?: any) => client?.sendMessage(type, data),
        isDisconnected, // Expose the new state
        connectionError,
        connect: (p_param: string) => client?.connect(p_param),
        reconnect: () => client?.reconnect(),
        disconnect: () => client?.disconnect()
    }), [client, serverData, isDisconnected, connectionError]);

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};