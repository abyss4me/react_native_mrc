import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import ClientManager from '../logic/ClientManager'; // Переконайся, що шлях правильний
import { ServerMessage, GameState } from '../types/ProtocolTypes'; // Імпорт твоїх типів

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

    // 1. Зберігаємо onScreenChange у ref, щоб useEffect не залежав від зміни цієї функції
    // Це критично важливо, щоб сокет не перестворювався при кожному рендері батька.
    const onScreenChangeRef = useRef(onScreenChange);

    useEffect(() => {
        onScreenChangeRef.current = onScreenChange;
    }, [onScreenChange]);

    useEffect(() => {
        // Створюємо інстанс ClientManager
        const cm = new ClientManager({
            handleMessage: (msg: ServerMessage) => {
                
                // CASE 1: Change Screen (Atomic Update)
                if (msg.type === "SET_SCREEN") {
                    const { screenId, ...restOfData } = msg.data;

                    // A. Reset State (Flush & Replace)
                    // Беремо все, що прийшло окрім screenId, і робимо це новим станом
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
                        
                        // Глибокий мердж властивостей компонентів
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

        // Автоматичний конект при маунті
        //cm.connect();
        setClient(cm);

        // Cleanup при розмонтуванні компонента (якщо потрібно закрити сокет)
        // return () => cm.disconnect(); 
    }, []); // Порожній масив = виконується 1 раз при старті

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