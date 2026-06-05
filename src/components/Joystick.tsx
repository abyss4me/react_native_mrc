import React, { useCallback, useRef } from 'react';
import {
    Image,
    View,
    StyleSheet,
    ViewStyle,
    ImageStyle,
    ColorValue,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';
import { InteractPayload } from './Button';
import { triggerHaptic } from '../utils/haptics';
import { sendThrottled, cancelThrottled, ThrottleRefs } from '../utils/throttledSend';

/**
 * Joystick — an analog input component.
 * Sends a normalized vector {x, y, magnitude} to the server on every frame.
 *
 * Key difference from Touchpad:
 * - Fixed center (base always stays in place)
 * - Stick snaps back to center on release
 * - Output is a normalized vector in [-1, 1] + magnitude in [0, 1]
 *   → server gets direction + force in one packet, no delta accumulation needed
 *
 * Layout JSON example:
 * {
 *   "type": "joystick",
 *   "id": "move_stick",
 *   "position": [40, 300],
 *   "size": [160, 160],
 *   "anchor": [0, 0.5],
 *   "action": "joystick_move",
 *   "deadzone": 0.05,
 *   "stickSize": 60,
 *   "texture": "url/to/base.png",
 *   "stickTexture": "url/to/stick.png",
 *   "style": { "opacity": 0.85 },
 *   "stickStyle": { "backgroundColor": "rgba(255,255,255,0.8)" },
 *   "haptic": "light"
 * }
 */

// ─── Config ──────────────────────────────────────────────────────────────────

export interface JoystickConfig {
    type: 'joystick';
    id?: string;

    // Placement
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    rotation?: number;
    visible?: boolean;

    // Behavior
    /** Action name sent to the server on move. Default: "joystick" */
    action?: string;
    /**
     * Normalized deadzone radius in [0, 1] relative to joystick radius.
     * Inputs within this zone report magnitude: 0. Default: 0.05
     */
    deadzone?: number;
    /**
     * Throttle strategy — same as Touchpad.
     * "raf" syncs to display refresh (~16ms). Default: "raf"
     */
    throttle?: number | 'raf';
    /** Send a final zero-vector event on release. Default: true */
    sendReleaseEvent?: boolean;

    // Visual — base plate
    texture?: string;
    style?: ViewStyle & { tintColor?: ColorValue };

    // Visual — stick (the knob that moves)
    /** Size of the stick knob in design pixels. Default: half of component size */
    stickSize?: number;
    stickTexture?: string;
    stickStyle?: ViewStyle;

    // Feedback
    haptic?: 'light' | 'medium' | 'heavy';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface JoystickProps {
    config: JoystickConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Joystick: React.FC<JoystickProps> = ({
    config,
    globalScale = 1,
    parentWidth,
    parentHeight,
    onInteract,
}) => {
    // ── Sizing ────────────────────────────────────────────────────────────────
    const [designW, designH] = config.size || [160, 160];
    const width  = designW * globalScale;
    const height = designH * globalScale;

    const radius     = Math.min(width, height) / 2;  // joystick usable radius
    const stickSize  = (config.stickSize ?? designW / 2) * globalScale;
    const stickHalf  = stickSize / 2;

    // ── Positioning ───────────────────────────────────────────────────────────
    const anchorStyle: ViewStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    // ── Behavior defaults ─────────────────────────────────────────────────────
    const action           = config.action ?? 'joystick';
    const deadzone         = config.deadzone ?? 0.05;  // normalized [0,1]
    const throttle         = config.throttle ?? 'raf';
    const sendReleaseEvent = config.sendReleaseEvent !== false;

    // ── Stick position — shared values (UI thread, zero re-render) ────────────
    const stickX = useSharedValue(0); // offset from center in px
    const stickY = useSharedValue(0);

    // ── Throttle refs (JS thread) ─────────────────────────────────────────────
    const rafHandleRef      = useRef<number | null>(null);
    const pendingPayloadRef = useRef<any>(null);
    const lastSentAtRef     = useRef<number>(0);

    // Cancel any in-flight RAF on unmount (e.g. screen change mid-gesture)
    React.useEffect(() => {
        return () => cancelThrottled({ rafHandleRef, pendingPayloadRef, lastSentAtRef });
    }, []);

    // ── JS-thread callbacks ───────────────────────────────────────────────────

    const fireHaptic = useCallback(() => {
        triggerHaptic(config.haptic);
    }, [config.haptic]);

    const fireMove = useCallback((rawX: number, rawY: number) => {
        if (!onInteract) return;

        // Normalize to [-1, 1] based on joystick radius
        let nx = rawX / radius;
        let ny = rawY / radius;

        // Clamp to unit circle
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist > 1) {
            nx /= dist;
            ny /= dist;
        }

        const magnitude = Math.min(1, dist);

        // Apply deadzone — if within deadzone, report zero vector
        if (magnitude < deadzone) {
            if (onInteract) onInteract(action, { x: 0, y: 0, magnitude: 0, id: config.id });
            return;
        }

        const payload = { x: nx, y: ny, magnitude, id: config.id };

        const throttleRefs: ThrottleRefs = { rafHandleRef, pendingPayloadRef, lastSentAtRef };
        sendThrottled(throttle, payload, (p) => onInteract(action, p as InteractPayload), throttleRefs);
    }, [action, config.id, deadzone, onInteract, radius, throttle]);

    const fireRelease = useCallback(() => {
        cancelThrottled({ rafHandleRef, pendingPayloadRef, lastSentAtRef });

        if (sendReleaseEvent && onInteract) {
            onInteract(action, { x: 0, y: 0, magnitude: 0, released: true, id: config.id });
        }
    }, [action, config.id, onInteract, sendReleaseEvent]);

    // ── Gesture ───────────────────────────────────────────────────────────────

    const pan = Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => { fireHaptic(); })
        .onUpdate((e) => {
            // Clamp stick visual position to the joystick radius
            const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
            if (dist <= radius) {
                stickX.value = e.translationX;
                stickY.value = e.translationY;
            } else {
                stickX.value = (e.translationX / dist) * radius;
                stickY.value = (e.translationY / dist) * radius;
            }
            fireMove(stickX.value, stickY.value);
        })
        .onEnd(() => {
            stickX.value = withSpring(0, { damping: 15, stiffness: 200 });
            stickY.value = withSpring(0, { damping: 15, stiffness: 200 });
            fireRelease();
        })
        .onFinalize(() => {
            stickX.value = withSpring(0, { damping: 15, stiffness: 200 });
            stickY.value = withSpring(0, { damping: 15, stiffness: 200 });
        });

    // ── Styles ────────────────────────────────────────────────────────────────

    const { tintColor: _bgTint, borderRadius, ...safeContainerStyle } = (config.style || {}) as Record<string, unknown>;
    const scaledBorderRadius = typeof borderRadius === 'number' ? borderRadius * globalScale : undefined;

    const containerStyle: ViewStyle = {
        width,
        height,
        ...(scaledBorderRadius !== undefined ? { borderRadius: scaledBorderRadius } : {}),
        ...(safeContainerStyle as ViewStyle),
        ...anchorStyle,
        ...(config.rotation ? { transform: rotationTransform(config.rotation) } : {}),
    };

    // Stick moves relative to center via translation
    const animatedStickStyle = useAnimatedStyle(() => ({
        position: 'absolute' as const,
        width: stickSize,
        height: stickSize,
        borderRadius: stickHalf,
        transform: [{ translateX: stickX.value }, { translateY: stickY.value }] as unknown as ViewStyle['transform'],
    }));

    const { borderRadius: stickBorderRadius, ...safeStickStyle } = (config.stickStyle || {}) as Record<string, unknown>;
    const scaledStickBorderRadius = typeof stickBorderRadius === 'number'
        ? stickBorderRadius * globalScale
        : stickHalf;

    const stickBaseStyle: ViewStyle = {
        backgroundColor: 'rgba(255,255,255,0.6)',
        ...(safeStickStyle as ViewStyle),
        borderRadius: scaledStickBorderRadius,
    };

    const { borderRadius: stickImgBorderRadius, ...safeStickImageStyle } = (config.stickStyle || {}) as Record<string, unknown>;
    const stickImageBaseStyle: ImageStyle = {
        backgroundColor: 'transparent',
        ...(safeStickImageStyle as ImageStyle),
        ...(typeof stickImgBorderRadius === 'number' ? { borderRadius: stickImgBorderRadius * globalScale } : {}),
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const renderBase = () => {
        if (!config.texture) return null;
        const tintColor = (config.style as Record<string, unknown>)?.tintColor as ColorValue | undefined;
        return (
            <Image
                source={{ uri: config.texture }}
                style={[StyleSheet.absoluteFill, tintColor ? { tintColor } : undefined]}
                resizeMode="contain"
            />
        );
    };

    const renderStick = () => {
        if (config.stickTexture) {
            return (
                <Animated.Image
                    source={{ uri: config.stickTexture }}
                    style={[animatedStickStyle, stickImageBaseStyle]}
                    resizeMode="contain"
                />
            );
        }
        return <Animated.View style={[animatedStickStyle, stickBaseStyle]} />;
    };

    return (
        <GestureDetector gesture={pan}>
            {/*
              * Outer View: static, handles positioning + border + overflow clip.
              * Separated from Animated.View because Reanimated on Web does not
              * correctly apply overflow:hidden clipping with borderRadius on
              * animated containers — it works on Android but not on Chrome.
              */}
            <View style={[styles.outerClip, containerStyle]}>
                {/* Inner Animated.View: fills the outer clip, centers the stick */}
                <Animated.View style={styles.innerFill}>
                    {renderBase()}
                    {renderStick()}
                </Animated.View>
            </View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    outerClip: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    innerFill: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});




