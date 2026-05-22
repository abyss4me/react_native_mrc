import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable, // Replaced TouchableOpacity with Pressable
    StyleSheet,
    ViewStyle,
    TextStyle,
    ImageStyle,
    Vibration
} from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/LayoutUtils';
import { ComponentMap } from './ComponentRegistry';
import { ButtonStates } from '../types/LayoutTypes';

// --- Types ---

interface ButtonConfig {
    type: "button";
    id?: string;
    action?: string;
    keyCode?: string; // Explicitly define hardware/navigation keys
    content?: string;
    disabled?: boolean;
    visible?: boolean;
    texture?: string;

    // NEW: User-experience enhancements
    hitbox?: number;  // Expands the clickable area beyond the visual size
    haptic?: "light" | "medium" | "heavy"; // Triggers local immediate vibration
    autoRepeat?: boolean; // NEW: If true, holds down the button and repeatedly fires keyUp/keyDown
    repeatInterval?: number; // NEW: Interval in milliseconds for auto-repeat (default: 200)
    customData?: Record<string, any>; // Optional arbitrary data forwarded with the action event

    // NEW: State-Driven UI instead of flat textures
    states?: ButtonStates;

    // Placement
    position?: [number, number];
    size?: [number, number];
    rotate?: number;
    anchor?: [number, number];

    // Styles (Base styles that are always applied)
    style?: Record<string, any>;

    // Nested elements
    layout?: any[];
}

interface ButtonProps {
    config: ButtonConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: any) => void;
}

export const Button: React.FC<ButtonProps> = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }) => {
    const { serverData } = useNetwork();
    const [isPressed, setIsPressed] = useState(false);

    // 1. State Check (Disabled)
    const isDisabled = config.disabled === true;

    // 2. Size Calculation
    const [w, h] = config.size || [100, 100];
    const width = w * globalScale;
    const height = h * globalScale;

    // NEW: 3. Extract state configurations (with a fallback to empty objects)
    const { normal = {}, pressed = {}, disabled = {} } = config.states || {};

    // Determine the ACTIVE state
    let activeStateConfig = normal;
    if (isDisabled) {
        activeStateConfig = disabled;
    } else if (isPressed) {
        activeStateConfig = pressed;
    }

    // Get values from the active state
    const currentTexture = activeStateConfig.texture || config.texture;
    // If the state has a scale - use it, otherwise the default effect (0.95 for pressed, 1 for others)
    const activeScale = activeStateConfig.scale !== undefined
        ? activeStateConfig.scale
        : (isPressed && !isDisabled ? 0.95 : 1);
    const activeStateStyle = activeStateConfig.style || {};

    // 4. Positioning
    const isAbsolute = !!config.position || !!config.anchor;
    const anchorStyle = isAbsolute ? getAnchorStyle(config, globalScale, parentWidth, parentHeight) : {};

    // 5. Transformations
    const transformStyles = [];
    if (config.rotate !== undefined) transformStyles.push({ rotate: `${config.rotate}deg` } as any);
    transformStyles.push({ scale: activeScale } as any);

    // --- Transform HitSlop ---
    const calculatedHitSlop = config.hitbox ? {
        top: config.hitbox,
        bottom: config.hitbox,
        left: config.hitbox,
        right: config.hitbox
    } : undefined;

    // --- Auto-repeat reference ---
    const autoRepeatIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isCoolingDown, setIsCoolingDown] = useState(false);

    // --- Event Handlers ---

    const handlePressIn = () => {
        if (isDisabled || isCoolingDown) return;
        setIsPressed(true);

        // Immediate local haptic feedback if configured
        if (config.haptic) {
            const hapticDurations = {
                light: 50,
                medium: 100,
                heavy: 200
            };
            Vibration.vibrate(hapticDurations[config.haptic] || 50);
        }

        const navKeyCode = config.keyCode || (!config.action ? config.id : null);
        if (navKeyCode && onInteract) {
            onInteract("keyDown", { keyCode: navKeyCode });

            // Start auto-repeat if enabled for navigation keys
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

        // Clear auto-repeat interval if active
        if (autoRepeatIntervalRef.current) {
            clearInterval(autoRepeatIntervalRef.current);
            autoRepeatIntervalRef.current = null;
        }

        const navKeyCode = config.keyCode || (!config.action ? config.id : null);

        // If it is standard navigation, fire keyUp.
        if (navKeyCode && onInteract) {
            onInteract("keyUp", { keyCode: navKeyCode });
        }
        // If it HAS an action, it is a custom game trigger (e.g. "submit", "fire_weapon")
        else if (config.action && onInteract) {
            onInteract("action", {
                id: config.id,
                action: config.action,
                ...(config.customData ? { customData: config.customData } : {})
            });

            // Apply immediate local debounce to prevent "Double Submit" before SET_INPUT_GUARD arrives
            setIsCoolingDown(true);
            debounceTimeoutRef.current = setTimeout(() => {
                setIsCoolingDown(false);
            }, 500); // 500ms grace period for the server to respond with SET_INPUT_GUARD
        }
    };

    // Cleanup timeouts safely
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
                    position: isAbsolute ? 'absolute' : 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: transformStyles,
                },
                config.style as ViewStyle,
                activeStateStyle as ViewStyle
            ]}
        >
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]} pointerEvents="none">
                {currentTexture ? (
                    <Image
                        source={{ uri: currentTexture }}
                        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                        resizeMode={config.style?.objectFit || "stretch"}
                    />
                ) : null}
                {(!config.layout && !!config.content) ? (
                    <Text style={[
                        config.style as TextStyle,
                        activeStateStyle as TextStyle,
                        {
                            color: (activeStateStyle as TextStyle).color || config.style?.color || 'white',
                            fontSize: config.style?.fontSize ? (parseInt(config.style.fontSize) * globalScale) : (20 * globalScale),
                            includeFontPadding: false,
                            textAlign: 'center',
                            textAlignVertical: 'center',
                            transform: [{ rotate: `-${config.rotate || 0}deg` }]
                        }
                    ]}>
                        {config.content}
                    </Text>
                ) : null}
                {config.layout ? config.layout.map((el: any, i: number) => {
                    if (el.visible === false) return null;

                    const Component = ComponentMap[el.type];
                    if (!Component) return null;

                    const childConfig = { ...el };

                    if (serverData?.components?.[childConfig.id]) {
                        const updates = serverData.components[childConfig.id];
                        const baseStyle = childConfig.style;
                        Object.assign(childConfig, updates);
                        if (baseStyle) {
                            childConfig.style = { ...baseStyle, ...(updates.style || {}) };
                        }
                    }

                    if (serverData && childConfig.id && serverData[childConfig.id] !== undefined) {
                        if (childConfig.type === 'text') childConfig.content = serverData[childConfig.id];
                        if (childConfig.type === 'image') childConfig.texture = serverData[childConfig.id];
                    }

                    return (
                        <Component
                            key={i}
                            config={childConfig}
                            globalScale={globalScale}
                            onInteract={onInteract}
                            parentWidth={width}
                            parentHeight={height}
                        />
                    );
                }) : null}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        // Default styles for the button
    }
});

