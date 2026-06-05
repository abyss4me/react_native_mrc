import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    StyleSheet,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useServerData } from '../engine/NetworkContext';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';
import { ComponentMap } from './ComponentRegistry';
import { ButtonStates, ElementConfig } from '../types/LayoutTypes';
import { useLayout } from "../engine/LayoutContext";
import { useInputGuard } from "../engine/InputGuardContext";
import { triggerHaptic } from '../utils/haptics';
import { applyServerDataToChild } from '../utils/applyServerData';

// --- Types ---

type KeyPayload      = { keyCode: string };
type ActionPayload   = { id?: string; action: string; actionPayload?: Record<string, unknown> };
type JoystickPayload = { id?: string; x: number; y: number; magnitude: number; released?: boolean };
type TouchpadPayload = { id?: string; [key: string]: unknown };
export type InteractPayload = KeyPayload | ActionPayload | JoystickPayload | TouchpadPayload;

export interface ButtonConfig {
    type: "button";
    id?: string;
    action?: string;
    keyCode?: string;
    text?: string;
    disabled?: boolean;
    visible?: boolean;
    texture?: string;
    cooldown?: number;
    lockScreen?: boolean;
    hitbox?: number;
    haptic?: "light" | "medium" | "heavy";
    autoRepeat?: boolean;
    repeatInterval?: number;
    actionPayload?: Record<string, unknown>;
    states?: ButtonStates;

    // Placement
    position?: [number, number];
    size?: [number, number];
    rotation?: number;
    anchor?: [number, number];

    style?: ViewStyle & TextStyle & { objectFit?: string };
    layout?: ElementConfig[];
}

interface ButtonProps {
    config: ButtonConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

export const Button: React.FC<ButtonProps> = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }) => {
    const { lockInput } = useInputGuard();
    const { settings } = useLayout();
    const [isPressed, setIsPressed] = useState(false);

    const isDisabled = config.disabled === true;

    const [w, h] = config.size || [100, 100];
    const width = w * globalScale;
    const height = h * globalScale;

    const { normal = {}, pressed = {}, disabled = {} } = config.states || {};

    let activeStateConfig = normal;
    if (isDisabled) {
        activeStateConfig = disabled;
    } else if (isPressed) {
        activeStateConfig = pressed;
    }

    const currentTexture = activeStateConfig.texture || config.texture;
    const activeScale = activeStateConfig.scale !== undefined
        ? activeStateConfig.scale
        : (isPressed && !isDisabled ? 0.95 : 1);
    const activeStateStyle = activeStateConfig.style || {};

    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const transformStyles: ({ rotate: string } | { scale: number })[] = [
        ...rotationTransform(config.rotation),
        { scale: activeScale },
    ];

    const calculatedHitSlop = config.hitbox ? {
        top: config.hitbox,
        bottom: config.hitbox,
        left: config.hitbox,
        right: config.hitbox
    } : undefined;

    const autoRepeatIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isCoolingDown, setIsCoolingDown] = useState(false);

    // Priority: config.cooldown > settings.defaultCooldown > 50ms fallback
    const defaultCooldown = (settings.defaultCooldown !== undefined) ? (settings.defaultCooldown <= 0 ? 50 : settings.defaultCooldown) : 50;
    const cooldownDuration = config?.cooldown !== undefined ? config?.cooldown : defaultCooldown;

    const handlePressIn = () => {
        if (isDisabled || isCoolingDown) return;
        setIsPressed(true);

        // Locks input shield synchronously — stays up until ScreenRenderer calls unlockInput() on new screen.
        if (config.lockScreen) {
            lockInput();
        }

        if (config.haptic) {
            triggerHaptic(config.haptic);
        }

        const navKeyCode = config.keyCode || (!config.action ? config.id : null);
        if (navKeyCode && onInteract) {
            onInteract("keyDown", { keyCode: navKeyCode });

            if (config.autoRepeat) {
                const interval = config.repeatInterval || 200;
                autoRepeatIntervalRef.current = setInterval(() => {
                    // Simulate rapid release and re-press
                    onInteract("keyUp", { keyCode: navKeyCode });
                    onInteract("keyDown", { keyCode: navKeyCode });
                }, interval);
            }
        }
    };

    const handlePressOut = () => {
        if (isDisabled || isCoolingDown) return;
        setIsPressed(false);

        if (autoRepeatIntervalRef.current) {
            clearInterval(autoRepeatIntervalRef.current);
            autoRepeatIntervalRef.current = null;
        }

        const navKeyCode = config.keyCode || (!config.action ? config.id : null);
        let eventWasFired: boolean = true;

        if (navKeyCode && onInteract) {
            onInteract("keyUp", { keyCode: navKeyCode });
            eventWasFired = true;
        } else if (config.action && onInteract) {
            onInteract("action", {
                id: config.id,
                action: config.action,
                ...(config.actionPayload ? { actionPayload: config.actionPayload } : {})
            });
            eventWasFired = true;
        }

        // Cooldown prevents rapid re-triggering on fast taps or holds.
        if (eventWasFired && cooldownDuration > 0) {
            setIsCoolingDown(true);
            debounceTimeoutRef.current = setTimeout(() => {
                setIsCoolingDown(false);
            }, cooldownDuration);
        }
    };

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (autoRepeatIntervalRef.current) clearInterval(autoRepeatIntervalRef.current);
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, []);

    return (
        <Pressable
            disabled={isDisabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={calculatedHitSlop}
            style={[
                styles.button,
                anchorStyle as ViewStyle,
                {
                    width,
                    height,
                    position: (config.position || config.anchor) ? 'absolute' : 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: transformStyles,
                },
                config.style as ViewStyle,
                activeStateStyle as ViewStyle
            ]}
        >
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]} pointerEvents="none">
                {/* Pre-warm all state textures into GPU memory to avoid first-press decode lag */}
                {[normal.texture, pressed.texture, disabled.texture, config.texture]
                    .filter((t): t is string => !!t && t !== currentTexture)
                    .filter((t, i, arr) => arr.indexOf(t) === i)
                    .map((tex, i) => (
                        <Image
                            key={`precache-${i}`}
                            source={{ uri: tex }}
                            style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }}
                        />
                    ))}
                {currentTexture ? (
                    <Image
                        source={{ uri: currentTexture }}
                        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                        resizeMode={(config.style?.objectFit as import('react-native').ImageResizeMode) || "stretch"}
                    />
                ) : null}
                {(!config.layout && !!config.text) ? (
                    <Text style={[
                        config.style as TextStyle,
                        activeStateStyle as TextStyle,
                        {
                            color: (activeStateStyle as TextStyle).color ?? (config.style?.color as string | undefined) ?? 'white',
                            fontSize: config.style?.fontSize ? (parseInt(String(config.style.fontSize)) * globalScale) : (20 * globalScale),
                            includeFontPadding: false,
                            textAlign: 'center',
                            textAlignVertical: 'center',
                            transform: [{ rotate: `-${config.rotation || 0}deg` }]
                        }
                    ]}>
                        {config.text}
                    </Text>
                ) : null}
                {config.layout ? (
                    <ButtonChildLayout
                        layout={config.layout}
                        globalScale={globalScale}
                        onInteract={onInteract}
                        width={width}
                        height={height}
                    />
                ) : null}
            </View>
        </Pressable>
    );
};

// Separate component so only buttons WITH a layout prop pay the cost of
// subscribing to serverData. Plain buttons never re-render on server updates.
interface ButtonChildLayoutProps {
    layout: ElementConfig[];
    globalScale: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
    width: number;
    height: number;
}
const styles = StyleSheet.create({
    button: {}
});

const ButtonChildLayout: React.FC<ButtonChildLayoutProps> = ({ layout, globalScale, onInteract, width, height }) => {
    const { serverData } = useServerData();
    return (
        <>
            {layout.map((el: ElementConfig, i: number) => {
                if (el.visible === false) return null;
                const Component = ComponentMap[el.type];
                if (!Component) return null;
                const childConfig = { ...el } as Record<string, unknown>;
                applyServerDataToChild(childConfig, serverData);
                return (
                    <Component
                        key={i}
                        config={childConfig as unknown as ElementConfig}
                        globalScale={globalScale}
                        onInteract={onInteract}
                        parentWidth={width}
                        parentHeight={height}
                    />
                );
            })}
        </>
    );
};

