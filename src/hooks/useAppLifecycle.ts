// src/hooks/useAppLifecycle.ts
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { MessageTypes } from '../types/ProtocolTypes';
import ClientManager from '../services/ClientManager';

/**
 * Listens for app foreground/background transitions and notifies the game server.
 * Sends APP_BACKGROUND when the app becomes inactive/backgrounded,
 * and APP_FOREGROUND when it returns to active — only if currently connected.
 * If the connection is not yet restored on foreground, sets pendingForegroundNotify
 * so ClientManager will flush the event once the WebSocket reconnects.
 */
export const useAppLifecycle = (managerRef: React.RefObject<ClientManager | null>): void => {
    useEffect(() => {
        let lastState: AppStateStatus = AppState.currentState;

        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            const manager = managerRef.current;
            if (!manager) return;

            if (lastState === 'active' && (nextState === 'background' || nextState === 'inactive')) {
                if (manager.isConnected) {
                    manager.sendMessage(MessageTypes.APP_BACKGROUND);
                }
                manager.pendingForegroundNotify = false; // reset stale flag
            } else if ((lastState === 'background' || lastState === 'inactive') && nextState === 'active') {
                if (manager.isConnected) {
                    manager.sendMessage(MessageTypes.APP_FOREGROUND);
                } else {
                    // Connection not yet restored — defer until reconnect
                    manager.pendingForegroundNotify = true;
                }
            }

            lastState = nextState;
        });

        return () => subscription.remove();
    }, []);
};
