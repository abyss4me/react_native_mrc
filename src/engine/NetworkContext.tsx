import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import ClientManager from '../logic/ClientManager'; // Make sure the path is correct
import { ServerMessage, GameState } from '../types/ProtocolTypes'; // Import your types

interface NetworkContextType {
    client: ClientManager | null;
    serverData: GameState;
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

    // 1. Store onScreenChange in a ref so useEffect doesn't depend on this function changing
    // This is critical to prevent the socket from being recreated on every parent render.
    const onScreenChangeRef = useRef(onScreenChange);

    useEffect(() => {
        onScreenChangeRef.current = onScreenChange;
    }, [onScreenChange]);

    useEffect(() => {
        // Create a ClientManager instance
        const cm = new ClientManager({
            handleMessage: (msg: ServerMessage) => {
                
                // CASE 1: Change Screen (Atomic Update)
                if (msg.type === "SET_SCREEN") {
                    const { screenId, ...restOfData } = msg.data;

                    // A. Reset State (Flush & Replace)
                    // Take everything that came except screenId and make it the new state
                    setServerData(restOfData as GameState);

                    // B. Navigate
                    if (screenId && onScreenChangeRef.current) {
                        onScreenChangeRef.current(screenId);
                    }
                }

                // CASE 2: Update Data (Incremental Update)
                if (msg.type === "UPDATE_DATA") {
                    setServerData(prev => {
                        // 1. Merge Components Deeply
                        const updatedComponents = { 
                            ...(prev.components || {}), 
                            ...(msg.data.components || {}) 
                        };
                        
                        // Deep merge component properties
                        Object.keys(msg.data.components || {}).forEach(key => {
                            if (msg.data.components && msg.data.components[key]) {
                                updatedComponents[key] = {
                                    ...(prev.components?.[key] || {}),
                                    ...msg.data.components[key]
                                };
                            }
                        });

                        // 2. Merge Root Level Data
                        return {
                            ...prev,
                            ...msg.data,
                            components: updatedComponents
                        };
                    });
                }
            },
            onConnectionEstablished: () => {
                console.log("Connection established!");
            }
        });

        // Auto-connect on mount
        //cm.connect();
        setClient(cm);

        // Cleanup on component unmount (if you need to close the socket)
        // return () => cm.disconnect(); 
    }, []); // Empty array = runs once on start

    const value = useMemo(() => ({
        client,
        serverData,
        sendMessage: (type: string, data?: any) => client?.sendMessage(type, data),
        connect: () => client?.connect()
    }), [client, serverData]);

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
};