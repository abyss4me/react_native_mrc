import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { LOCK_SAFETY_TIMEOUT_MS } from '../constants';
import { useLayout } from './LayoutContext';

interface InputGuardContextType {
    isLocked: boolean;
    lockInput: () => void;
    unlockInput: () => void;
}

const InputGuardContext = createContext<InputGuardContextType>({
    isLocked: false,
    lockInput: () => {},
    unlockInput: () => {},
});

export const InputGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings } = useLayout();
    const [isLocked, setIsLocked] = useState(false);
    const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timeoutMs = settings.lockSafetyTimeout ?? LOCK_SAFETY_TIMEOUT_MS;

    const unlockInput = useCallback(() => {
        // Clear safety timer if unlock arrives before timeout
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
        }
        setIsLocked(false);
    }, []);

    const lockInput = useCallback(() => {
        setIsLocked(true);

        // Reset previous safety timer if lockInput is called again
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
        }

        // Fail-safe: auto-unlock after timeout if LOAD_SCREEN never arrives
        safetyTimerRef.current = setTimeout(() => {
            console.warn(`[InputGuard] Safety timeout triggered after ${timeoutMs}ms — auto-unlocking.`);
            setIsLocked(false);
            safetyTimerRef.current = null;
        }, timeoutMs);
    }, [timeoutMs]);

    // Clear any pending safety timer on unmount to avoid setState on an unmounted component
    useEffect(() => {
        return () => {
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
        };
    }, []);

    return (
        <InputGuardContext.Provider value={{ isLocked, lockInput, unlockInput }}>
            {children}
        </InputGuardContext.Provider>
    );
};

/**
 * Hook to access the global input lock state.
 *
 * Lock lifecycle:
 *  - LOCK:   Button with `lockScreen: true` calls `lockInput()` on `pressIn` — synchronous, instant.
 *            A safety timeout starts — auto-unlocks after LOCK_SAFETY_TIMEOUT_MS if no LOAD_SCREEN arrives.
 *  - UNLOCK: `ScreenRenderer` calls `unlockInput()` via `useEffect` when `screenConfig` prop changes.
 *            This cancels the safety timer.
 */
export const useInputGuard = (): InputGuardContextType => {
    const ctx = useContext(InputGuardContext);
    if (!ctx) throw new Error('useInputGuard must be used within InputGuardProvider');
    return ctx;
};



