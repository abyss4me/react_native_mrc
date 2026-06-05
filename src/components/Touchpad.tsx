import React, { useCallback, useRef } from 'react';
import {
    Image,
    StyleSheet,
    ViewStyle,
    ImageStyle,
    ColorValue,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated,
{
    useSharedValue,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { InteractPayload } from './Button';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';
import { triggerHaptic } from '../utils/haptics';
import { sendThrottled, cancelThrottled, ThrottleRefs } from '../utils/throttledSend';

// ─── Helper ───────────────────────────────────────────────────────────────────

const getSwipeDirection = (dx: number, dy: number): 'left' | 'right' | 'up' | 'down' => {
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
};

// ─── Config ──────────────────────────────────────────────────────────────────

export interface TouchpadConfig {
    type: 'touchpad';
    id?: string;

    // Placement
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    rotation?: number;
    visible?: boolean;

    // Behavior
    /** Event/action name sent to the server on move (default: "touchpad") */
    action?: string;
    /**
     * Movement mode:
     * - "relative" (default) — sends dx/dy deltas. Game accumulates cursor position.
     * - "normalized" — sends x/y in 0..1 range relative to touchpad size. Game maps to its own resolution.
     */
    mode?: 'relative' | 'normalized';
    /** Multiplier applied to raw pixel deltas before sending (default: 1). Only used in "relative" mode */
    sensitivity?: number;
    /** Minimum pixel movement before a delta is reported (default: 0) */
    deadzone?: number;
    /** Fire updates continuously while dragging (default: true) */
    continuous?: boolean;
    /**
     * Minimum time in milliseconds between successive move events sent to the server.
     * Uses requestAnimationFrame when set to "raf" (recommended — syncs to display refresh ~16ms).
     * Pass a number (ms) for a fixed interval, or omit / set 0 for no throttle.
     * Default: "raf"
     */
    throttle?: number | 'raf';
    /** Send a final event with dx:0,dy:0 on release (default: false) */
    sendReleaseEvent?: boolean;

    // Visual — background
    texture?: string;
    style?: ViewStyle;
    tintColor?: ColorValue;

    // Visual — thumb indicator (the floating dot that follows the finger)
    showIndicator?: boolean;
    /** Size of the indicator dot in design pixels (default: 40) */
    indicatorSize?: number;
    indicatorStyle?: ImageStyle;
    indicatorTexture?: string;
    /** Clamp the indicator to stay within the touchpad bounds (default: true) */
    clampIndicator?: boolean;
    /** Move the indicator back to center when finger lifts (default: true) */
    resetOnRelease?: boolean;

    // Feedback
    haptic?: 'light' | 'medium' | 'heavy';

    // Tap gestures
    /** Single tap — equivalent to left mouse click. Example: "mouse_left_click" */
    tapAction?: string;
    /** Double tap — equivalent to left mouse double-click. Example: "mouse_double_click" */
    doubleTapAction?: string;
    /** Long press — equivalent to right mouse click. Example: "mouse_right_click" */
    longPressAction?: string;
    /** Max finger travel in design-space px for a touch to be a tap (not a drag). Default: 10 */
    tapSlop?: number;
    /** Max ms between two taps to register as a double tap. Default: 300 */
    doubleTapDelay?: number;
    /** Ms the finger must be held still to trigger a long press. Default: 500 */
    longPressDelay?: number;

    // Swipe lifecycle
    /**
     * Fired once the moment finger travel exceeds tapSlop — swipe begins.
     * Payload: { x0, y0, id }
     */
    swipeStartAction?: string;
    /**
     * Fired on finger release after a drag — swipe ends.
     * Fires regardless of continuous mode.
     * Payload: { x0, y0, x1, y1, dx, dy, vx, vy, speed, direction, id }
     */
    swipeEndAction?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TouchpadProps {
    config: TouchpadConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Touchpad: React.FC<TouchpadProps> = ({
    config,
    globalScale = 1,
    parentWidth,
    parentHeight,
    onInteract,
}) => {
    // -- Sizing --
    const [designW, designH] = config.size || [200, 200];
    const width = designW * globalScale;
    const height = designH * globalScale;

    // -- Positioning --
    const anchorStyle: ViewStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    // -- Behavior defaults --
    const mode        = config.mode ?? 'relative';
    const sensitivity = config.sensitivity ?? 1;
    const deadzone    = (config.deadzone ?? 0) * globalScale;
    const continuous  = config.continuous !== false;
    const sendReleaseEvent = config.sendReleaseEvent ?? false;
    const showIndicator    = config.showIndicator !== false;
    const clampIndicator   = config.clampIndicator !== false;
    const resetOnRelease   = config.resetOnRelease !== false;
    const indicatorSize    = (config.indicatorSize ?? 40) * globalScale;
    const indicatorHalf    = indicatorSize / 2;
    const action           = config.action ?? 'touchpad';
    const throttle         = config.throttle ?? 'raf';
    const tapSlop          = (config.tapSlop ?? 10) * globalScale;
    const doubleTapDelay   = config.doubleTapDelay ?? 300;
    const longPressDelay   = config.longPressDelay ?? 500;

    // -- Indicator position — shared values (UI thread, zero re-render) --
    const indicatorX  = useSharedValue(0);
    const indicatorY  = useSharedValue(0);
    const touchStartX = useSharedValue(0); // absolute finger origin within the pad
    const touchStartY = useSharedValue(0);

    // -- Throttle refs (JS thread) --
    const rafHandleRef     = useRef<number | null>(null);
    const pendingPayloadRef = useRef<any>(null);
    const lastSentAtRef    = useRef<number>(0);
    const swipeStartPosRef = useRef({ x0: 0, y0: 0 });

    // Cancel any in-flight RAF on unmount (e.g. screen change mid-gesture)
    React.useEffect(() => {
        return () => cancelThrottled({ rafHandleRef, pendingPayloadRef, lastSentAtRef });
    }, []);

    // ── JS-thread callbacks (called via runOnJS from worklets) ────────────────

    const fireHaptic = useCallback(() => {
        triggerHaptic(config.haptic);
    }, [config.haptic]);

    const fireSwipeStart = useCallback((x0: number, y0: number) => {
        swipeStartPosRef.current = { x0, y0 };
        if (config.swipeStartAction && onInteract) {
            onInteract(config.swipeStartAction, { x0, y0, id: config.id });
        }
    }, [config.swipeStartAction, config.id, onInteract]);

    const fireMove = useCallback((translationX: number, translationY: number,
                                  startX: number, startY: number) => {
        if (!continuous || !onInteract) return;
        if (Math.abs(translationX) < deadzone && Math.abs(translationY) < deadzone) return;

        const dx = translationX * sensitivity;
        const dy = translationY * sensitivity;

        const payload = mode === 'normalized'
            ? {
                x: Math.min(1, Math.max(0, (startX + translationX) / width)),
                y: Math.min(1, Math.max(0, (startY + translationY) / height)),
                id: config.id,
            }
            : { dx, dy, id: config.id };

        const throttleRefs: ThrottleRefs = { rafHandleRef, pendingPayloadRef, lastSentAtRef };
        sendThrottled(throttle, payload, (p) => onInteract(action, p as InteractPayload), throttleRefs);
    }, [continuous, deadzone, sensitivity, mode, throttle, action, config.id, onInteract, width, height]);

    const fireRelease = useCallback((
        translationX: number, translationY: number,
        velocityX: number, velocityY: number,
        startX: number, startY: number,
    ) => {
        // Cleanup throttle
        cancelThrottled({ rafHandleRef, pendingPayloadRef, lastSentAtRef });

        // pan.onEnd only fires when gesture was active (drag confirmed) — no isDrag check needed
        const dx        = translationX * sensitivity;
        const dy        = translationY * sensitivity;
        const vx        = velocityX * sensitivity;
        const vy        = velocityY * sensitivity;
        const speed     = Math.sqrt(vx * vx + vy * vy);
        const direction = getSwipeDirection(translationX, translationY);

        // Single swipe packet (continuous: false)
        if (!continuous && onInteract) {
            onInteract(action, { dx, dy, vx, vy, speed, direction, id: config.id });
        }

        // swipeEndAction — fires regardless of continuous mode
        if (config.swipeEndAction && onInteract) {
            const x1 = Math.min(1, Math.max(0, (startX + translationX) / width));
            const y1 = Math.min(1, Math.max(0, (startY + translationY) / height));
            onInteract(config.swipeEndAction, {
                ...swipeStartPosRef.current,
                x1, y1, dx, dy, vx, vy, speed, direction,
                id: config.id,
            });
        }

        if (sendReleaseEvent && onInteract) {
            onInteract(action, { dx: 0, dy: 0, released: true, id: config.id });
        }
    }, [continuous, sensitivity, action, config, onInteract, sendReleaseEvent, width, height]);

    const fireTap = useCallback(() => {
        if (config.tapAction && onInteract) onInteract(config.tapAction, { id: config.id });
    }, [config.tapAction, config.id, onInteract]);

    const fireDoubleTap = useCallback(() => {
        if (config.doubleTapAction && onInteract) onInteract(config.doubleTapAction, { id: config.id });
    }, [config.doubleTapAction, config.id, onInteract]);

    const fireLongPress = useCallback(() => {
        if (config.longPressAction && onInteract) onInteract(config.longPressAction, { id: config.id });
    }, [config.longPressAction, config.id, onInteract]);

    // ── Gesture definitions ───────────────────────────────────────────────────
    //
    // .runOnJS(true) — all callbacks run on the JS thread.
    // This avoids thread violations on Android 13 when calling JS-only APIs
    // (Vibration, requestAnimationFrame, refs) from gesture handlers.
    // SharedValue updates work from JS thread — Reanimated syncs them to UI thread
    // automatically, so the indicator still animates via useAnimatedStyle.

    const pan = Gesture.Pan()
        .runOnJS(true)
        .minDistance(tapSlop)
        .onBegin((e) => {
            touchStartX.value = e.x;
            touchStartY.value = e.y;
            fireHaptic();
        })
        .onStart((e) => {
            const x0 = Math.min(1, Math.max(0, e.x / width));
            const y0 = Math.min(1, Math.max(0, e.y / height));
            fireSwipeStart(x0, y0);
        })
        .onUpdate((e) => {
            const rawX = touchStartX.value + e.translationX - indicatorHalf;
            const rawY = touchStartY.value + e.translationY - indicatorHalf;
            indicatorX.value = clampIndicator
                ? Math.min(width - indicatorSize, Math.max(0, rawX))
                : rawX;
            indicatorY.value = clampIndicator
                ? Math.min(height - indicatorSize, Math.max(0, rawY))
                : rawY;
            fireMove(e.translationX, e.translationY, touchStartX.value, touchStartY.value);
        })
        .onEnd((e) => {
            if (resetOnRelease) {
                indicatorX.value = 0;
                indicatorY.value = 0;
            }
            fireRelease(
                e.translationX, e.translationY,
                e.velocityX, e.velocityY,
                touchStartX.value, touchStartY.value,
            );
        })
        .onFinalize(() => {
            if (resetOnRelease) {
                indicatorX.value = 0;
                indicatorY.value = 0;
            }
        });

    const doubleTap = Gesture.Tap()
        .runOnJS(true)
        .numberOfTaps(2)
        .maxDelay(doubleTapDelay)
        .onEnd(() => { fireDoubleTap(); });

    const singleTap = Gesture.Tap()
        .runOnJS(true)
        .numberOfTaps(1)
        .onEnd(() => { fireTap(); });

    const longPress = Gesture.LongPress()
        .runOnJS(true)
        .minDuration(longPressDelay)
        .onStart(() => { fireLongPress(); });

    const composed = Gesture.Race(
        pan,
        Gesture.Exclusive(doubleTap, singleTap),
        longPress,
    );

    // ── Styles ────────────────────────────────────────────────────────────────

    const safeContainerStyle: ViewStyle = config.style || {};
    const containerStyle: ViewStyle = {
        width,
        height,
        overflow: 'hidden',
        ...safeContainerStyle,
        ...anchorStyle,
        ...(config.rotation ? { transform: rotationTransform(config.rotation) } : {}),
    };

    // Indicator position driven by shared values — updates on UI thread, no re-render
    const animatedIndicatorStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        width: indicatorSize,
        height: indicatorSize,
        left: indicatorX.value,
        top: indicatorY.value,
    }));

    const indicatorBaseStyle: ViewStyle = {
        borderRadius: indicatorHalf,
        backgroundColor: 'rgba(255,255,255,0.5)',
        ...(config.indicatorStyle || {}),
    };

    const indicatorImageBaseStyle: ImageStyle = {
        backgroundColor: 'transparent',
        ...(config.indicatorStyle as ImageStyle || {}),
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const renderBackground = () => {
        if (!config.texture) return null;
        const tintColor = config.tintColor;
        return (
            <Image
                source={{ uri: config.texture }}
                style={[StyleSheet.absoluteFill, tintColor ? { tintColor } : undefined]}
                resizeMode="cover"
            />
        );
    };

    const renderIndicator = () => {
        if (!showIndicator) return null;
        if (config.indicatorTexture) {
            return (
                <Animated.Image
                    source={{ uri: config.indicatorTexture }}
                    style={[animatedIndicatorStyle, indicatorImageBaseStyle]}
                    resizeMode="contain"
                />
            );
        }
        return <Animated.View style={[animatedIndicatorStyle, indicatorBaseStyle]} />;
    };

    return (
        <GestureDetector gesture={composed}>
            <Animated.View style={[styles.base, containerStyle]}>
                {renderBackground()}
                {renderIndicator()}
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    base: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

