import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable, // Replaced TouchableOpacity with Pressable
    StyleSheet,
    ViewStyle,
    TextStyle,
    ImageStyle
} from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './index';

// --- Types ---
// Add an interface for configuring a specific state
interface ButtonStateConfig {
    texture?: string;
    scale?: number;
    style?: ViewStyle | TextStyle | ImageStyle; // Additional styles for the state (e.g. opacity, tintColor)
}

interface ButtonConfig {
    type: "button";
    id?: string;
    action?: string;
    content?: string;
    disabled?: boolean;
    visible?: boolean;
    texture?: string;

    // NEW: State-Driven UI instead of flat textures
    states?: {
        normal?: ButtonStateConfig;
        pressed?: ButtonStateConfig;
        disabled?: ButtonStateConfig;
    };

    // Placement
    position?: [number, number];
    size?: [number, number];
    rotate?: number;
    anchor?: string;

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
    const transformStyles = [
        { rotate: `${config.rotate || 0}deg` },
        { scale: activeScale }
    ];

    // --- Event Handlers ---
    const handlePressIn = () => {
        if (isDisabled) return;
        setIsPressed(true);
        if (!config.action && onInteract && config.id) {
            onInteract("keyDown", { keyCode: config.id });
        }
    };

    const handlePressOut = () => {
        if (isDisabled) return;
        setIsPressed(false);
        if (!config.action && onInteract && config.id) {
            onInteract("keyUp", { keyCode: config.id });
        }
    };

    const handlePress = () => {
        if (isDisabled) return;
        if (config.action && onInteract) {
            onInteract("action", { action: config.action });
        }
    };

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isDisabled}
            style={[
                anchorStyle as ViewStyle,
                {
                    width,
                    height,
                    position: isAbsolute ? 'absolute' : 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: transformStyles,
                },
                config.style as ViewStyle, // Base styles
                activeStateStyle as ViewStyle // Override active state styles (e.g. opacity: 0.5 for disabled)
            ]}
        >
            {/* A. Background texture */}
            {currentTexture && (
                <Image
                    source={{ uri: currentTexture }}
                    style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                    resizeMode={config.style?.objectFit || "stretch"}
                />
            )}

            {/* B. Simple text (if there is no layout) */}
            {!config.layout && config.content && (
                <Text style={[
                    config.style,
                    activeStateStyle, // Text can also change color depending on the state
                    {
                        color: activeStateStyle.color || config.style?.color || 'white',
                        fontSize: config.style?.fontSize ? (parseInt(config.style.fontSize) * globalScale) : (20 * globalScale),
                        transform: [{ rotate: `-${config.rotate || 0}deg` }]
                    }
                ]}>
                    {config.content}
                </Text>
            )}

            {/* C. Nested elements (Recursion) */}
            {config.layout && config.layout.map((el: any, i: number) => {
                if (el.visible === false) return null;

                const Component = ComponentMap[el.type];
                if (!Component) return null;

                const childConfig = { ...el };

                if (serverData?.components?.[childConfig.id]) {
                    Object.assign(childConfig, serverData.components[childConfig.id]);
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
                        // Optional: you can pass the current state down so that children can react to it
                        // parentState={isDisabled ? 'disabled' : isPressed ? 'pressed' : 'normal'}
                    />
                );
            })}
        </Pressable>
    );
};