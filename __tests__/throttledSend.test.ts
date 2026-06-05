/**
 * Unit tests for throttledSend.ts
 *
 * Covers both exported functions:
 *   sendThrottled — three strategies:
 *     - strategy 0      : fires sender on every call (no throttle)
 *     - strategy number : fires at most once per N ms (interval throttle)
 *     - strategy 'raf'  : coalesces calls to one per animation frame
 *   cancelThrottled — resets all refs, cancels pending rAF
 *
 * requestAnimationFrame / cancelAnimationFrame are not available in the
 * Jest node environment, so they are manually mocked per describe block.
 */

import { sendThrottled, cancelThrottled, ThrottleRefs } from '../src/utils/throttledSend';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates fresh mutable refs (compatible with ThrottleRefs interface). */
const makeRefs = () => ({
    rafHandleRef:      { current: null  as number | null },
    pendingPayloadRef: { current: null  as unknown },
    lastSentAtRef:     { current: 0 },
}) as unknown as ThrottleRefs;

// ─── strategy: 0 (no throttle) ───────────────────────────────────────────────

describe('sendThrottled — strategy 0 (no throttle)', () => {
    test('calls sender immediately on every call', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(0, 'payload', sender, refs);

        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith('payload');
    });

    test('calls sender on every subsequent call without skipping', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(0, 'a', sender, refs);
        sendThrottled(0, 'b', sender, refs);
        sendThrottled(0, 'c', sender, refs);

        expect(sender).toHaveBeenCalledTimes(3);
        expect(sender).toHaveBeenNthCalledWith(1, 'a');
        expect(sender).toHaveBeenNthCalledWith(2, 'b');
        expect(sender).toHaveBeenNthCalledWith(3, 'c');
    });

    test('works with object payload', () => {
        const sender = jest.fn();
        const refs = makeRefs();
        const payload = { x: 10, y: 20 };

        sendThrottled(0, payload, sender, refs);

        expect(sender).toHaveBeenCalledWith(payload);
    });

    test('does not touch any refs', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(0, 'data', sender, refs);

        expect(refs.rafHandleRef.current).toBeNull();
        expect(refs.pendingPayloadRef.current).toBeNull();
        expect(refs.lastSentAtRef.current).toBe(0);
    });
});

// ─── strategy: number (interval throttle) ────────────────────────────────────

describe('sendThrottled — strategy: number (interval throttle)', () => {
    let mockNow: number;

    beforeEach(() => {
        mockNow = 10_000; // arbitrary starting point
        jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('first call always fires (lastSentAt starts at 0, now >> interval)', () => {
        const sender = jest.fn();
        const refs = makeRefs(); // lastSentAtRef.current = 0

        sendThrottled(100, 'first', sender, refs);

        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith('first');
    });

    test('updates lastSentAtRef on each send', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'data', sender, refs);

        expect(refs.lastSentAtRef.current).toBe(mockNow);
    });

    test('second call within interval is skipped', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'first', sender, refs);   // fires, lastSentAt = 10_000
        mockNow += 50;                               // only 50ms passed
        sendThrottled(100, 'second', sender, refs);  // skipped

        expect(sender).toHaveBeenCalledTimes(1);
    });

    test('second call exactly at interval boundary fires', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'first', sender, refs);   // fires, lastSentAt = 10_000
        mockNow += 100;                              // exactly 100ms
        sendThrottled(100, 'second', sender, refs);  // fires

        expect(sender).toHaveBeenCalledTimes(2);
        expect(sender).toHaveBeenNthCalledWith(2, 'second');
    });

    test('second call after interval fires', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'first', sender, refs);   // fires
        mockNow += 150;                              // 150ms > 100ms
        sendThrottled(100, 'second', sender, refs);  // fires

        expect(sender).toHaveBeenCalledTimes(2);
    });

    test('only the call that crosses the boundary gets through', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'p1', sender, refs);  // fires  @ t=10_000
        mockNow += 30;
        sendThrottled(100, 'p2', sender, refs);  // skip   @ t=10_030
        mockNow += 30;
        sendThrottled(100, 'p3', sender, refs);  // skip   @ t=10_060
        mockNow += 50;
        sendThrottled(100, 'p4', sender, refs);  // fires  @ t=10_110  (110ms elapsed)

        expect(sender).toHaveBeenCalledTimes(2);
        expect(sender).toHaveBeenNthCalledWith(1, 'p1');
        expect(sender).toHaveBeenNthCalledWith(2, 'p4');
    });

    test('different interval values are respected', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(500, 'a', sender, refs);   // fires
        mockNow += 200;
        sendThrottled(500, 'b', sender, refs);   // skip — only 200ms < 500ms
        mockNow += 400;
        sendThrottled(500, 'c', sender, refs);   // fires — 600ms > 500ms

        expect(sender).toHaveBeenCalledTimes(2);
        expect(sender).toHaveBeenNthCalledWith(2, 'c');
    });

    test('does not touch rafHandleRef or pendingPayloadRef', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled(100, 'data', sender, refs);

        expect(refs.rafHandleRef.current).toBeNull();
        expect(refs.pendingPayloadRef.current).toBeNull();
    });
});

// ─── strategy: 'raf' (animation frame coalescing) ────────────────────────────

describe('sendThrottled — strategy "raf"', () => {
    let capturedRafCb: ((time: number) => void) | null;
    const fireRaf = () => { capturedRafCb?.(0); capturedRafCb = null; };

    beforeEach(() => {
        capturedRafCb = null;
        global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
            capturedRafCb = cb;
            return 1; // fake handle
        });
        global.cancelAnimationFrame = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as any).requestAnimationFrame;
        delete (global as any).cancelAnimationFrame;
    });

    test('first call sets pendingPayload and schedules rAF', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);

        expect(refs.pendingPayloadRef.current).toBe('payload');
        expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });

    test('first call stores rAF handle in rafHandleRef', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);

        expect(refs.rafHandleRef.current).toBe(1); // fake handle returned by mock
    });

    test('sender is NOT called until rAF fires', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);

        expect(sender).not.toHaveBeenCalled();
    });

    test('sender is called when rAF fires', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);
        fireRaf();

        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith('payload');
    });

    test('second call before rAF fires: payload is updated, rAF NOT re-scheduled', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'first', sender, refs);   // schedules rAF
        sendThrottled('raf', 'second', sender, refs);  // updates payload only

        expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1); // only once
        expect(refs.pendingPayloadRef.current).toBe('second');
    });

    test('rAF fires with the LAST payload (coalescing)', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'first',  sender, refs);
        sendThrottled('raf', 'second', sender, refs);
        sendThrottled('raf', 'third',  sender, refs);
        fireRaf();

        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith('third');
    });

    test('rAF fires: rafHandleRef is reset to null', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);
        fireRaf();

        expect(refs.rafHandleRef.current).toBeNull();
    });

    test('rAF fires: pendingPayloadRef is cleared to null', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);
        fireRaf();

        expect(refs.pendingPayloadRef.current).toBeNull();
    });

    test('after rAF fires, next sendThrottled schedules a new rAF', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'first', sender, refs);
        fireRaf();

        // rafHandleRef is null again — next call should schedule new rAF
        sendThrottled('raf', 'second', sender, refs);
        expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2);

        fireRaf();
        expect(sender).toHaveBeenCalledTimes(2);
        expect(sender).toHaveBeenLastCalledWith('second');
    });

    test('if pendingPayload is null when rAF fires — sender is NOT called', () => {
        // This can happen if cancelThrottled clears pendingPayloadRef before rAF fires
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);
        refs.pendingPayloadRef.current = null; // simulate cancel clearing it
        fireRaf();

        expect(sender).not.toHaveBeenCalled();
    });

    test('many rapid calls produce exactly one sender call per rAF cycle', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        for (let i = 0; i < 20; i++) {
            sendThrottled('raf', { frame: i }, sender, refs);
        }
        fireRaf();

        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith({ frame: 19 });
    });
});

// ─── cancelThrottled ─────────────────────────────────────────────────────────

describe('cancelThrottled', () => {
    beforeEach(() => {
        global.cancelAnimationFrame = jest.fn();
    });

    afterEach(() => {
        delete (global as any).cancelAnimationFrame;
    });

    test('resets pendingPayloadRef to null', () => {
        const refs = makeRefs();
        refs.pendingPayloadRef.current = { x: 5 };

        cancelThrottled(refs);

        expect(refs.pendingPayloadRef.current).toBeNull();
    });

    test('resets lastSentAtRef to 0', () => {
        const refs = makeRefs();
        refs.lastSentAtRef.current = 9999;

        cancelThrottled(refs);

        expect(refs.lastSentAtRef.current).toBe(0);
    });

    test('cancels pending rAF when rafHandleRef is not null', () => {
        const refs = makeRefs();
        refs.rafHandleRef.current = 42; // simulate pending rAF

        cancelThrottled(refs);

        expect(global.cancelAnimationFrame).toHaveBeenCalledWith(42);
    });

    test('resets rafHandleRef to null after cancelling', () => {
        const refs = makeRefs();
        refs.rafHandleRef.current = 42;

        cancelThrottled(refs);

        expect(refs.rafHandleRef.current).toBeNull();
    });

    test('does NOT call cancelAnimationFrame when rafHandleRef is already null', () => {
        const refs = makeRefs();
        refs.rafHandleRef.current = null; // no pending rAF

        cancelThrottled(refs);

        expect(global.cancelAnimationFrame).not.toHaveBeenCalled();
    });

    test('resets all three refs even when rafHandleRef is null', () => {
        const refs = makeRefs();
        refs.pendingPayloadRef.current = 'leftover';
        refs.lastSentAtRef.current = 5000;
        refs.rafHandleRef.current = null;

        cancelThrottled(refs);

        expect(refs.pendingPayloadRef.current).toBeNull();
        expect(refs.lastSentAtRef.current).toBe(0);
        expect(refs.rafHandleRef.current).toBeNull();
    });

    test('cancel after raf+send cycle: only resets already-null refs — no error', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        // simulate a completed rAF cycle where refs are already clean
        refs.rafHandleRef.current = null;
        refs.pendingPayloadRef.current = null;
        refs.lastSentAtRef.current = 0;

        expect(() => cancelThrottled(refs)).not.toThrow();
        expect(global.cancelAnimationFrame).not.toHaveBeenCalled();
    });
});

// ─── sendThrottled + cancelThrottled interaction ──────────────────────────────

describe('sendThrottled + cancelThrottled interaction', () => {
    let capturedRafCb: ((time: number) => void) | null;
    const fireRaf = () => { capturedRafCb?.(0); capturedRafCb = null; };

    beforeEach(() => {
        capturedRafCb = null;
        global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
            capturedRafCb = cb;
            return 7;
        });
        global.cancelAnimationFrame = jest.fn(() => { capturedRafCb = null; });
    });

    afterEach(() => {
        delete (global as any).requestAnimationFrame;
        delete (global as any).cancelAnimationFrame;
    });

    test('cancel before rAF fires → sender is never called', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        sendThrottled('raf', 'payload', sender, refs);
        cancelThrottled(refs);
        fireRaf(); // rAF was cancelled — capturedRafCb is now null

        expect(sender).not.toHaveBeenCalled();
    });

    test('cancel resets interval throttle: next send fires immediately', () => {
        const sender = jest.fn();
        const refs = makeRefs();

        jest.spyOn(Date, 'now').mockReturnValue(10_000);
        sendThrottled(100, 'first', sender, refs);  // fires, lastSentAt=10_000

        cancelThrottled(refs);                       // resets lastSentAt to 0

        // Even though only 0ms passed, cancel reset lastSentAt → fires again
        sendThrottled(100, 'second', sender, refs);
        expect(sender).toHaveBeenCalledTimes(2);
        expect(sender).toHaveBeenLastCalledWith('second');

        jest.restoreAllMocks();
    });
});

