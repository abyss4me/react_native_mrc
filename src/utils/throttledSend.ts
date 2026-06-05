import { RefObject } from 'react';

export type ThrottleStrategy = number | 'raf';

export interface ThrottleRefs {
    rafHandleRef:      RefObject<number | null>;
    pendingPayloadRef: RefObject<unknown>;
    lastSentAtRef:     RefObject<number>;
}

/**
 * Sends `payload` via `sender` according to the chosen throttle strategy:
 * - `"raf"` — coalesces calls to one per animation frame (~16 ms).
 * - `0`     — fires immediately on every call (no throttle).
 * - `number` — fires at most once every N milliseconds.
 */
export const sendThrottled = (
    strategy: ThrottleStrategy,
    payload: unknown,
    sender: (payload: unknown) => void,
    refs: ThrottleRefs,
): void => {
    if (strategy === 'raf') {
        refs.pendingPayloadRef.current = payload;
        if (refs.rafHandleRef.current === null) {
            refs.rafHandleRef.current = requestAnimationFrame(() => {
                refs.rafHandleRef.current = null;
                if (refs.pendingPayloadRef.current !== null) {
                    sender(refs.pendingPayloadRef.current);
                    refs.pendingPayloadRef.current = null;
                }
            });
        }
    } else if (strategy === 0) {
        sender(payload);
    } else {
        const now = Date.now();
        if (now - refs.lastSentAtRef.current >= (strategy as number)) {
            refs.lastSentAtRef.current = now;
            sender(payload);
        }
    }
};

/**
 * Cancels any pending throttled send and resets all throttle refs.
 * Call this when the gesture ends or the component unmounts.
 */
export const cancelThrottled = (refs: ThrottleRefs): void => {
    if (refs.rafHandleRef.current !== null) {
        cancelAnimationFrame(refs.rafHandleRef.current);
        refs.rafHandleRef.current = null;
    }
    refs.pendingPayloadRef.current = null;
    refs.lastSentAtRef.current = 0;
};

