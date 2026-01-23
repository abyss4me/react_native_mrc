import React, { useState, useEffect, useMemo } from 'react';
import { View, ImageBackground, StyleSheet, useWindowDimensions } from 'react-native';
import { ComponentMap } from '../components'; // Import the component map
import { useNetwork } from './NetworkContext';

// Recursive function for data injection
const recursiveProcessConfig = (rawConfig: any, serverData: any): any => {
    // 1. Clone the config
    const finalConfig = { ...rawConfig };

    // 2. Merge data for this ID
    if (finalConfig.id && serverData.components && serverData.components[finalConfig.id]) {
        const updates = serverData.components[finalConfig.id];
        Object.assign(finalConfig, updates);
    }

    // 3. Recurse for children
    if (finalConfig.layout && Array.isArray(finalConfig.layout)) {
        finalConfig.layout = finalConfig.layout.map((child: any) =>
            recursiveProcessConfig(child, serverData)
        );
    }

    return finalConfig;
};

interface ScreenRendererProps {
    screenConfig: any; // ScreenConfig type from ProtocolTypes
}

const ScreenRenderer: React.FC<ScreenRendererProps> = ({ screenConfig }) => {
    const { serverData, sendMessage } = useNetwork();

    // 1. Get phone screen dimensions
    const { width, height } = useWindowDimensions();

    // 2. Calculate Scale.
    // Assume the base design is drawn for a width of 1000px (or another value from your layout)
    // If the phone is in landscape (width > height), use width as the basis.
    const BASE_DESIGN_WIDTH = 1920;
    const BASE_DESIGN_HEIGHT = 1080;

    // Scale proportionally
    const scaleX = width / BASE_DESIGN_WIDTH;
    const scaleY = height / BASE_DESIGN_HEIGHT;

    // Use the minimum scale to maintain aspect ratio
    const uiScale = Math.min(scaleX, scaleY);

    // If there's no config, render nothing or show a loader
    if (!screenConfig) {
        return <View style={styles.container} />; // Black screen
    }

    const handleAction = (type: string, payload: any) => {
        // Forward events to the server
        sendMessage(type, payload);
    };

    const renderElement = (el: any, index: number) => {
        // --- 1. Data Processing (Merge state from server) ---
        const finalConfig = recursiveProcessConfig(el, serverData);

        // --- 2. Visibility Check ---
        if (finalConfig.visible === false) return null;

        // --- 3. Component Selection ---
        const Component = ComponentMap[finalConfig.type];
        if (!Component) {
            console.warn(`Unknown component type: ${finalConfig.type}`);
            return null;
        }

        // --- 4. Old Bindings (compatibility) ---
        if (finalConfig.bindContent && serverData[finalConfig.bindContent] !== undefined) {
            finalConfig.content = serverData[finalConfig.bindContent];
        }

        return (
            <Component
                key={index}
                config={finalConfig}
                globalScale={uiScale}
                onInteract={handleAction}
            />
        );
    };

    // Background handling. If it's a URL with http - React Native will understand.
    // If it's a local path like "/assets/bg.jpg" - it might not work in Native without changes.
    // For now, assume it's a full URL.
    const bgSource = screenConfig.background
        ? { uri: screenConfig.background }
        : null;

    return (
        <View style={styles.container}>
            {bgSource ? (
                <ImageBackground
                    source={bgSource}
                    style={styles.background}
                    resizeMode="cover"
                >
                     {screenConfig.layout.map((el: any, i: number) => renderElement(el, i))}
                </ImageBackground>
            ) : (
                <View style={[styles.background, { backgroundColor: screenConfig.backgroundColor || '#000' }]}>
                     {screenConfig.layout.map((el: any, i: number) => renderElement(el, i))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    }
});

export default ScreenRenderer;