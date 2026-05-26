import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import ClientManager from '../services/ClientManager';
import { GameState, MessageTypes } from '../types/ProtocolTypes';
import { resolveStyleReference, applyPatches, resolveComponentAssets } from './LayoutUtils';
import { triggerHaptics, showError } from '../services/FeedbackService';

interface NetworkContextType {
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
    onReconnected?: () => void;
}

export const NetworkProvider: React.FC<Props> = ({ children, layouts, onScreenChange, onConfigUrlReceived, onReconnected }) => {
    const [serverData, setServerData] = useState<GameState>({});
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const onScreenChangeRef = useRef(onScreenChange);
    const onConfigUrlReceivedRef = useRef(onConfigUrlReceived);
    const onReconnectedRef = useRef(onReconnected);
    const managerRef = useRef<ClientManager | null>(null);
    const appControllerRef = useRef<any>(null);

    useEffect(() => { onScreenChangeRef.current = onScreenChange; }, [onScreenChange]);
    useEffect(() => { onConfigUrlReceivedRef.current = onConfigUrlReceived; }, [onConfigUrlReceived]);
    useEffect(() => { onReconnectedRef.current = onReconnected; }, [onReconnected]);

    // ─── Message Handlers ───────────────────────────────────────────────────────

    const handleSetScreen = (data: any) => {
        const { screenId, ...restOfData } = data;
        const clonedData = JSON.parse(JSON.stringify(restOfData));

        // Apply patches
        if (data.patches && Array.isArray(data.patches)) {
            clonedData.components = clonedData.components || {};
            applyPatches(clonedData.components, data.patches);
        }

        // Merge server component overrides with layout base styles
        if (data.components) {
            const layoutComponents = layouts?.screens?.[screenId]?.layout || {};
            const layoutComponentsById = Object.values(layoutComponents).reduce((acc: any, comp: any) => {
                if (comp?.id) acc[comp.id] = comp;
                return acc;
            }, {} as Record<string, any>);

            for (const componentId in data.components) {
                const incomingComponent = data.components[componentId];
                if (incomingComponent?.style) {
                    const layoutComponent = layoutComponentsById[componentId];
                    const rawBaseStyle = layoutComponent?.style || {};
                    const resolvedBase = layouts?.styles && typeof rawBaseStyle === 'string'
                        ? resolveStyleReference(layouts.styles, { style: rawBaseStyle }).style
                        : rawBaseStyle;
                    clonedData.components[componentId] = clonedData.components[componentId] || {};
                    clonedData.components[componentId].style = { ...resolvedBase, ...incomingComponent.style };
                }
            }
        }

        // Resolve asset URLs
        if (clonedData.components) {
            resolveComponentAssets(clonedData.components, layouts?.settings?.assetsBaseUrl || '');
        }

        setServerData(clonedData as GameState);
        if (screenId) onScreenChangeRef.current?.(screenId);
    };

    const handleUpdateComponents = (data: any) => {
        setServerData(prev => {
            const updatedComponents = JSON.parse(JSON.stringify(prev.components || {}));

            // Apply patches
            if (data.patches && Array.isArray(data.patches)) {
                applyPatches(updatedComponents, data.patches);
            }

            // Merge server component overrides with layout base styles + prev state
            if (data.components) {
                const layoutComponentsById = Object.values(layouts?.screens || {}).reduce((acc: any, screen: any) => {
                    Object.values(screen?.layout || {}).forEach((comp: any) => {
                        if (comp?.id) acc[comp.id] = comp;
                    });
                    return acc;
                }, {} as Record<string, any>);

                for (const componentId in data.components) {
                    const incomingComponent = data.components[componentId];
                    const layoutComponent = layoutComponentsById[componentId] || {};
                    const prevComponent = prev.components?.[componentId] || {};

                    const rawBaseStyle = layoutComponent.style || {};
                    const resolvedBaseStyle = layouts?.styles && typeof rawBaseStyle === 'string'
                        ? resolveStyleReference(layouts.styles, { style: rawBaseStyle }).style
                        : rawBaseStyle;

                    updatedComponents[componentId] = {
                        ...layoutComponent,
                        ...prevComponent,
                        ...(updatedComponents[componentId] || {}),
                        ...incomingComponent,
                        style: {
                            ...resolvedBaseStyle,
                            ...(prevComponent.style || {}),
                            ...(incomingComponent.style || {})
                        }
                    };
                }
            }

            // Resolve asset URLs
            resolveComponentAssets(updatedComponents, layouts?.settings?.assetsBaseUrl || '');

            return { ...prev, ...data, components: updatedComponents };
        });
    };

    const handleGameState = (msg: any) => {
        const configUrl = msg?.state?.controllerConfigURL || '';
        if (configUrl) onConfigUrlReceivedRef.current?.(configUrl);

        // Restore screen + state after reconnection (server won't re-send SET_SCREEN)
        const stateData = msg?.state?.data || {};
        const { screenId, ...restOfData } = stateData;
        if (Object.keys(restOfData).length > 0) setServerData(restOfData as GameState);
        if (screenId) onScreenChangeRef.current?.(screenId);

        // Safety net: GAME_STATE signals active connection (e.g. after background resume)
        setIsDisconnected(false);
    };

    // ─── App Controller ──────────────────────────────────────────────────────────

    // Update appControllerRef on every render so handlers always use fresh closures.
    // ClientManager holds a stable proxy that delegates to appControllerRef.current —
    // this decouples the long-lived ClientManager instance from React's render cycle.
    appControllerRef.current = {
        dispatch: (msg: any) => {
            const data = msg?.data || {};

            switch (msg.type) {
                case MessageTypes.SET_SCREEN:             handleSetScreen(data); break;
                case MessageTypes.UPDATE_COMPONENTS:      handleUpdateComponents(data); break;
                case MessageTypes.TRIGGER_HAPTICS:        triggerHaptics(data); break;
                case MessageTypes.SHOW_ERROR:             showError(data); break;
                case MessageTypes.GAME_STATE:             handleGameState(data); break;
                // Single source of truth for overlay visibility
                case MessageTypes.CONNECTION_STATUS:      setIsDisconnected(!data.isConnected); break;
                case MessageTypes.CONNECTION_TIMEOUT:     setConnectionError(data.message || 'Unable to connect, please try again'); break;
                case MessageTypes.CLEAR_CONNECTION_ERROR: setConnectionError(null); break;
            }
        },
        onConnectionEstablished: () => {
            // Side-effects only — isDisconnected is driven by CONNECTION_STATUS dispatch above
            setConnectionError(null);
            onReconnectedRef.current?.();
        },
    };

    if (!managerRef.current) {
        managerRef.current = new ClientManager({
            dispatch:                (msg: any) => appControllerRef.current.dispatch(msg),
            onConnectionEstablished: ()         => appControllerRef.current.onConnectionEstablished(),
        });
    }

    // Cleanup on unmount only
    useEffect(() => {
        return () => {
            managerRef.current?.disconnect();
        };
    }, []);

    // ─── Stable sendMessage ──────────────────────────────────────────────────────

    const sendMessage = useCallback((type: string, data?: any) => {
        managerRef.current?.sendMessage(type, data);
    }, []);

    const connect = useCallback((p_param: string) => {
        managerRef.current?.connect(p_param);
    }, []);

    const reconnect = useCallback(() => {
        managerRef.current?.reconnect();
    }, []);

    const disconnect = useCallback(() => {
        managerRef.current?.disconnect();
    }, []);

    const value = useMemo(() => ({
        serverData,
        sendMessage,
        isDisconnected,
        connectionError,
        connect,
        reconnect,
        disconnect,
    }), [serverData, sendMessage, isDisconnected, connectionError, connect, reconnect, disconnect]);

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};