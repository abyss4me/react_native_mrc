import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ImageStyle
} from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './index'; // Import component map for recursion

// --- Types (Can be moved to types/LayoutTypes.ts) ---
interface ButtonConfig {
    type: "button";
    id?: string;
    action?: string;
    content?: string;
    disabled?: boolean;
    visible?: boolean;

    // Textures
    texture?: string;
    textureFocused?: string;
    textureDisabled?: string;

    // Placement
    pos?: { x: number; y: number };
    size?: { w: number; h: number };
    rotate?: number;
    align?: string;

    // Styles
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

export const Button: React.FC<ButtonProps> = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract}) => {
    const { serverData } = useNetwork();
    const [isPressed, setIsPressed] = useState(false);

    // 1. State Check (Disabled)
    // The server can send disabled via serverData or it can be in the initial config
    const isDisabled = config.disabled === true;

    // 2. Size Calculation
    const width = (config.size?.w || 100) * globalScale;
    const height = (config.size?.h || 100) * globalScale;

    // 3. Texture Selection
    const currentTexture = (isDisabled && config.textureDisabled)
        ? config.textureDisabled
        : (isPressed && config.textureFocused ? config.textureFocused : config.texture);

    // 4. Positioning
    const isAbsolute = !!config.pos || !!config.align;

    const anchorStyle = isAbsolute ? getAnchorStyle(config, globalScale, parentWidth, parentHeight ) : {};

    // 5. Transformations (React Native uses an array of objects)
    const transformStyles = [
        { rotate: `${config.rotate || 0}deg` },
        { scale: isPressed ? 0.95 : 1 } // Slight scaling down on press
    ];

    // --- Event Handlers ---
    const handlePressIn = () => {
        if (isDisabled) return;
        setIsPressed(true);
        // Emulate key press (if there is no action)
        if (!config.action && onInteract && config.id) {
            onInteract("keyDown", { keyCode: config.id });
        }
    };

    const handlePressOut = () => {
        if (isDisabled) return;
        setIsPressed(false);
        // Emulate key release
        if (!config.action && onInteract && config.id) {
            onInteract("keyUp", { keyCode: config.id });
        }
    };

    const handlePress = () => {
        if (isDisabled) return;
        // Execute action (if there is an action)
        if (config.action && onInteract) {
            onInteract("action", { action: config.action });
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={1} // Disable default flash because we have our own scale/texture animation
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isDisabled}
            style={[
                anchorStyle as ViewStyle, // casting for TS
                {
                    width,
                    height,
                    position: isAbsolute ? 'absolute' : 'relative',
                    opacity: (isDisabled && !config.textureDisabled) ? 0.5 : 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: transformStyles,
                    // Add custom styles from JSON if they are compatible with RN
                    ...(config.style as ViewStyle)
                }
            ]}
        >
            {/* A. Background image (analogous to backgroundImage) */}
            {currentTexture && (
                <Image
                    source={{ uri: currentTexture }}
                    style={StyleSheet.absoluteFill} // Stretches to the full size of the button
                    resizeMode="stretch" // Or 'contain', depending on the design
                />
            )}

            {/* B. Simple text (if there is no layout) */}
            {!config.layout && config.content && (
                <Text style={{
                    ...config.style,
                    color: config.style?.color || 'white',
                    fontSize: config.style?.fontSize ? (parseInt(config.style.fontSize) * globalScale) : (20 * globalScale),

                    // Compensate for container rotation to keep text level (optional)
                    transform: [{ rotate: `-${config.rotate || 0}deg` }]
                }}>
                    {config.content}
                </Text>
            )}

            {/* C. Nested elements (Recursion) */}
            {config.layout && config.layout.map((el: any, i: number) => {
                // 1. Visibility check
                if (el.visible === false) return null;

                // 2. Get component
                const Component = ComponentMap[el.type];
                if (!Component) return null;

                const childConfig = { ...el };

                // 3. Data injection from the server (Data Binding)
                // If the server sent an update for this ID
                if (serverData?.components?.[childConfig.id]) {
                    Object.assign(childConfig, serverData.components[childConfig.id]);
                }

                // 4. Fallback for old logic (simple values)
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
            })}
        </TouchableOpacity>
    );
};