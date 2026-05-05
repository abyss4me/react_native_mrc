import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import ClientManager from '../logic/ClientManager'; // Make sure the path is correct
import { ServerMessage, GameState } from '../types/ProtocolTypes'; // Import your types

interface NetworkContextType {
    client: ClientManager | null;
    serverData: GameState;
    isDisconnected: boolean; // New state for the overlay
    sendMessage: (type: string, data?: any) => void;
    connect: () => void;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

interface Props {
    children: React.ReactNode;
    onScreenChange: (screenId: string) => void;
}

export const NetworkProvider: React.FC<Props> = ({ children, onScreenChange }) => {
    const [client, setClient] = useState<ClientManager | null>(null);
    const [serverData, setServerData] = useState<GameState>({});
    const [isDisconnected, setIsDisconnected] = useState(false); // State for disconnect overlay

    const onScreenChangeRef = useRef(onScreenChange);

    useEffect(() => {
        onScreenChangeRef.current = onScreenChange;
    }, [onScreenChange]);

    useEffect(() => {
        const cm = new ClientManager({
            handleMessage: (msg: ServerMessage) => {
                
                if (msg.type === "SET_SCREEN") {
                    const { screenId, ...restOfData } = msg.data;
                    setServerData(restOfData as GameState);
                    if (screenId && onScreenChangeRef.current) {
                        onScreenChangeRef.current(screenId);
                    }
                }

                if (msg.type === "UPDATE_DATA") {
                    setServerData(prev => {
                        const updatedComponents = { 
                            ...(prev.components || {}), 
                            ...(msg.data.components || {}) 
                        };
                        
                        Object.keys(msg.data.components || {}).forEach(key => {
                            if (msg.data.components && msg.data.components[key]) {
                                updatedComponents[key] = {
                                    ...(prev.components?.[key] || {}),
                                    ...msg.data.components[key]
                                };
                            }
                        });

                        return {
                            ...prev,
                            ...msg.data,
                            components: updatedComponents
                        };
                    });
                }

                // Handle connection status changes
                if (msg.type === "CONNECTION_STATUS") {
                    setIsDisconnected(!msg.data.isConnected);
                }
            },
            onConnectionEstablished: () => {
                console.log("Connection established!");
                setIsDisconnected(false); // Hide overlay on connection
            }
        });

        setClient(cm);

    }, []);

    const value = useMemo(() => ({
        client,
        serverData,
        isDisconnected, // Expose the new state
        sendMessage: (type: string, data?: any) => client?.sendMessage(type, data),
        connect: () => client?.connect()
    }), [client, serverData, isDisconnected]);

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};