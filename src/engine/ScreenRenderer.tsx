import React, { useEffect, useCallback } from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { ComponentMap } from '../components';
import { useNetwork } from './NetworkContext';
import { useInputGuard } from './InputGuardContext';
import { useLayout } from './LayoutContext';
import InputGuard from '../components/InputGuard';
import useUIScale from './useUIScale';
import resolveBackground from './resolveBackground';
import { resolveElementConfig, recursiveProcessConfig } from './LayoutUtils';
import { ScreenConfig } from '../types/LayoutTypes';

interface ScreenRendererProps {
    screenConfig: ScreenConfig | undefined;
}

const ScreenRenderer: React.FC<ScreenRendererProps> = ({ screenConfig }) => {
    const { serverData, sendMessage } = useNetwork();
    const { unlockInput } = useInputGuard();
    const { layouts } = useLayout();
    const { width, height, uiScale } = useUIScale();

    const globalBackground = layouts?.background;

    // Unlock input shield when a new screen is rendered.
    // This is the authoritative unlock point — no server round-trip, no timeout.
    useEffect(() => {
        if (screenConfig) {
            unlockInput();
        }
    }, [screenConfig, unlockInput]);

    const handleAction = useCallback((type: string, payload: any) => {
        sendMessage(type, payload);
    }, [sendMessage]);

    const baseUrl = layouts?.settings?.assetsBaseUrl || '';

    const renderElement = useCallback((el: any, index: number) => {
        // 1. Style Resolution + Asset URL prepending
        let resolvedEl = el;
        try {
            if (layouts?.styles) {
                resolvedEl = resolveElementConfig(layouts.styles, el, baseUrl);
            } else if (baseUrl) {
                resolvedEl = resolveElementConfig({}, el, baseUrl);
            }
        } catch (e) {
            console.error('[ScreenRenderer] resolveElementConfig failed for element:', el, e);
        }

        // 2. Data Processing — merge state from server
        const finalConfig = recursiveProcessConfig(resolvedEl, serverData);

        // 3. Visibility Check
        if (finalConfig.visible === false) return null;

        // 4. Component Selection
        const Component = ComponentMap[finalConfig.type];
        if (!Component) {
            console.warn(`Unknown component type: ${finalConfig.type}`);
            return null;
        }

        return (
            <Component
                key={index}
                config={finalConfig}
                globalScale={uiScale}
                onInteract={handleAction}
                parentWidth={width}
                parentHeight={height}
            />
        );
    }, [layouts, baseUrl, serverData, uiScale, handleAction, width, height]);

    if (!screenConfig) {
        return <View style={styles.container} />;
    }

    const { bgSource, bgColor } = resolveBackground(
        screenConfig.background,
        globalBackground,
        baseUrl
    );

    const children = screenConfig.layout.map((el: any, i: number) => renderElement(el, i));

    return (
        <View style={styles.container}>
            {bgSource ? (
                <ImageBackground source={bgSource} style={styles.background} resizeMode="cover">
                    {children}
                </ImageBackground>
            ) : (
                <View style={[styles.background, { backgroundColor: bgColor }]}>
                    {children}
                </View>
            )}
            {/* Transparent shield — blocks all touches during screen transitions */}
            <InputGuard />
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
    },
});

export default ScreenRenderer;

