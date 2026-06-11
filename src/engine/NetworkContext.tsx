import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import ClientManager from '../services/ClientManager';
import { GameState, MessageTypes, ServerMessage, LoadScreenMessage, PatchStateMessage, GameStateMessage, TriggerHapticsMessage, ShowErrorToastMessage } from '../types/ProtocolTypes';
import { LayoutConfig, ElementConfig, ScreenConfig } from '../types/LayoutTypes';
import { triggerHaptics, showError } from '../services/FeedbackService';
import { resolveSetScreen, resolveUpdateComponents, ResolverContext } from './ComponentStateResolver';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useInputGuard } from './InputGuardContext';

// ─── Server Data Context ─────────────────────────────────────────────────────
// Changes frequently (every server update). Components that only need
// serverData subscribe here and won't re-render on connection state changes.

interface ServerDataContextType {
    serverData: GameState;
}

const ServerDataContext = createContext<ServerDataContextType | null>(null);

// ─── Connection Context ───────────────────────────────────────────────────────
// Changes rarely (connect/disconnect events). Components that only need
// connection actions won't re-render on every serverData update.

interface ConnectionContextType {
    isDisconnected: boolean;
    connectionError: string | null;
    sendMessage: (type: string, data?: unknown) => void;
    connect: (p_param: string) => void;
    reconnect: () => void;
    disconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

interface Props {
    children: ReactNode;
    layouts?: LayoutConfig;
    onScreenChange: (screenId: string) => void;
    onConfigUrlReceived?: (url: string) => void;
    onReconnected?: () => void;
    /**
     * When provided, NetworkProvider populates this ref with its disconnect function.
     * Allows parent components (e.g. Main) that live outside the context tree to
     * imperatively disconnect — e.g. after a failed version-compatibility check.
     */
    disconnectRef?: React.RefObject<(() => void) | null>;
}

interface AppController {
    dispatch: (msg: ServerMessage) => void;
    onConnectionEstablished: () => void;
}

export const NetworkProvider: React.FC<Props> = ({ children, layouts, onScreenChange, onConfigUrlReceived, onReconnected, disconnectRef }) => {
    const [serverData, setServerData] = useState<GameState>({});
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const { unlockInput } = useInputGuard();

    const onScreenChangeRef = useRef(onScreenChange);
    const onConfigUrlReceivedRef = useRef(onConfigUrlReceived);
    const onReconnectedRef = useRef(onReconnected);
    const managerRef = useRef<ClientManager | null>(null);
    const appControllerRef = useRef<AppController | null>(null);

    // layouts is static (loaded once at startup) — build the lookup map once,
    // not on every PATCH_STATE message.
    const layoutComponentsById = useMemo<Record<string, ElementConfig>>(() => {
        if (!layouts?.screens) return {};
        return Object.values(layouts.screens).reduce((acc: Record<string, ElementConfig>, screen) => {
            const s = screen as ScreenConfig;
            const allElements: ElementConfig[] = [
                ...(s?.layout || []),
                ...(s?.layouts?.landscape || []),
                ...(s?.layouts?.portrait || []),
            ];
            allElements.forEach((comp: ElementConfig) => {
                if (comp?.id) acc[comp.id] = comp;
            });
            return acc;
        }, {});
    }, [layouts]);

    // Stable resolver context — rebuilt only when layouts changes (= never during gameplay).
    const resolverCtx = useMemo<ResolverContext>(() => ({
        layoutComponentsById,
        layouts,
        baseUrl: layouts?.settings?.assetsBaseUrl || '',
    }), [layoutComponentsById, layouts]);

    useEffect(() => { onScreenChangeRef.current = onScreenChange; }, [onScreenChange]);
    useEffect(() => { onConfigUrlReceivedRef.current = onConfigUrlReceived; }, [onConfigUrlReceived]);
    useEffect(() => { onReconnectedRef.current = onReconnected; }, [onReconnected]);

    // ─── Message Handlers ───────────────────────────────────────────────────────

    const handleLoadScreen = (data: LoadScreenMessage['data']) => {
        const { screenId, state } = resolveSetScreen(data, resolverCtx);
        setServerData(state);
        if (screenId) onScreenChangeRef.current?.(screenId);
    };

    const handlePatchState = (data: PatchStateMessage['data']) => {
        setServerData(prev => resolveUpdateComponents(data, prev, resolverCtx));
    };

    const handleGameState = (data: GameStateMessage['data']) => {
        const configUrl = data?.state?.controllerConfigURL || '';
        if (configUrl) onConfigUrlReceivedRef.current?.(configUrl);

        // Restore screen + state after reconnection (server won't re-send LOAD_SCREEN)
        const stateData = data?.state?.data || {};
        const { screenId, ...restOfData } = stateData as GameState & { screenId?: string };
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
        dispatch: (msg: ServerMessage) => {
            const data = (msg as { data?: unknown })?.data;

            switch (msg.type) {
                case MessageTypes.LOAD_SCREEN:            handleLoadScreen(data as LoadScreenMessage['data']); break;
                case MessageTypes.PATCH_STATE:            handlePatchState(data as PatchStateMessage['data']); break;
                case MessageTypes.UNLOCK_SCREEN:          unlockInput(); break;
                case MessageTypes.TRIGGER_HAPTICS:        triggerHaptics(data as TriggerHapticsMessage['data']); break;
                case MessageTypes.SHOW_ERROR:             showError(data as ShowErrorToastMessage['data']); break;
                case MessageTypes.GAME_STATE:             handleGameState(data as GameStateMessage['data']); break;
                case MessageTypes.CONNECTION_STATUS:      setIsDisconnected(!(data as { isConnected?: boolean })?.isConnected); break;
                case MessageTypes.CONNECTION_TIMEOUT:     setConnectionError((data as { message?: string })?.message || 'Unable to connect, please try again'); break;
                case MessageTypes.CLEAR_CONNECTION_ERROR: setConnectionError(null); break;
            }
        },
        onConnectionEstablished: () => {
            setConnectionError(null);
            onReconnectedRef.current?.();
        },
    };

    if (!managerRef.current) {
        managerRef.current = new ClientManager({
            dispatch:                (msg: ServerMessage) => appControllerRef.current?.dispatch(msg),
            onConnectionEstablished: ()                   => appControllerRef.current?.onConnectionEstablished(),
        });
    }

    // Expose disconnect to callers outside the provider tree (e.g. Main after a failed
    // version-compatibility check). managerRef is stable for the lifetime of the provider.
    useEffect(() => {
        if (disconnectRef) {
            disconnectRef.current = () => managerRef.current?.disconnect();
        }
        return () => {
            if (disconnectRef) disconnectRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — managerRef and disconnectRef are stable refs

    // Cleanup on unmount only
    useEffect(() => {
        return () => {
            managerRef.current?.disconnect();
        };
    }, []);

    // Notify the game when the app moves to background or returns to foreground
    useAppLifecycle(managerRef);

    // ─── Stable actions ──────────────────────────────────────────────────────────

    const sendMessage = useCallback((type: string, data?: unknown) => {
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

    // ─── Context values ───────────────────────────────────────────────────────────
    // Separated so that serverData changes don't trigger ConnectionContext consumers
    // and connection state changes don't trigger ServerDataContext consumers.

    const serverDataValue = useMemo<ServerDataContextType>(() => ({
        serverData,
    }), [serverData]);

    const connectionValue = useMemo<ConnectionContextType>(() => ({
        isDisconnected,
        connectionError,
        sendMessage,
        connect,
        reconnect,
        disconnect,
    }), [isDisconnected, connectionError, sendMessage, connect, reconnect, disconnect]);

    return (
        <ConnectionContext.Provider value={connectionValue}>
            <ServerDataContext.Provider value={serverDataValue}>
                {children}
            </ServerDataContext.Provider>
        </ConnectionContext.Provider>
    );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Subscribe to server data only. Re-renders on every server update. */
export const useServerData = (): ServerDataContextType => {
    const context = useContext(ServerDataContext);
    if (!context) throw new Error('useServerData must be used within a NetworkProvider');
    return context;
};

/** Subscribe to connection state/actions only. Does NOT re-render on server data updates. */
export const useConnection = (): ConnectionContextType => {
    const context = useContext(ConnectionContext);
    if (!context) throw new Error('useConnection must be used within a NetworkProvider');
    return context;
};


