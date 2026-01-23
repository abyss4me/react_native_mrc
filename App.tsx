import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Text, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';

// Engine Imports
import { NetworkProvider } from './src/engine/NetworkContext';
import ScreenRenderer from './src/engine/ScreenRenderer';
import { preloadAssets } from './src/utils/AssetsLoader';
import { preloadRemoteFonts } from './src/utils/FontLoader';

// --- 1. CONFIGURATION & MOCK DATA ---
// These are your JSON layouts. In the future, you can load them via fetch()
// or import from a file: import localLayouts from './src/layouts/main_layout.json';
import localLayouts from './assets/layouts/main_layout.json';

// Prevent the splash screen from auto-hiding
//SplashScreen.preventAutoHideAsync();

export default function App() {
    const [isReady, setIsReady] = useState(false);
    // 1. Navigation state
    const [currentScreenId, setCurrentScreenId] = useState<string>("CONNECT_SCREEN");

    const { width, height } = useWindowDimensions();
    const isPortrait = height > width;

    useEffect(() => {
        async function prepare() {
            try {
                // 1. Тримаємо Splash Screen
                await SplashScreen.preventAutoHideAsync();

                // 2. Завантажуємо шрифти та картинки паралельно

                await Promise.all([
                    preloadAssets(localLayouts) ,// Прелоад ваших картинок
                    preloadRemoteFonts(localLayouts)
                ]);

            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
                // 3. Ховаємо заставку
                await SplashScreen.hideAsync();
            }
        }

        prepare();
    }, []);


    // 3. Lock orientation (Landscape)
    useEffect(() => {
        async function lockOrientation() {
            try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            } catch (error) {
                console.warn("Orientation lock failed (might happen in Expo Go on some devices):", error);
            }
        }
        lockOrientation();
    }, []);



    // While fonts are not loaded - return null (the splash is still visible)
    if (!isReady) return null;


    // 5. Selecting screen configuration
    // Fallback to CONNECT_SCREEN if an unknown ID is received
    const currentConfig = (localLayouts as any).screens[currentScreenId] || (localLayouts as any)["CONNECT_SCREEN"];

    return (
        <View style={styles.container} onLayout={() => {}}>
            {/* Hide the status bar for full immersion */}
            <StatusBar hidden translucent backgroundColor="transparent" />
            {isPortrait && (
                <View style={styles.rotateOverlay}>
                    <Text style={styles.rotateText}>🔄</Text>
                    <Text style={styles.rotateText}>Please rotate your device</Text>
                    <Text style={styles.rotateSubText}>This app works only in landscape mode</Text>
                </View>
            )}
            {!isPortrait && (
                <NetworkProvider onScreenChange={setCurrentScreenId}>
                    <ScreenRenderer screenConfig={currentConfig} />
                </NetworkProvider>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black', // Background color
    },
    rotateOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1a1a1a',
        zIndex: 9999, // Поверх всього
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    rotateText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        fontFamily: 'LibreFranklinBold',
    },
    rotateSubText: {
        color: '#aaaaaa',
        fontSize: 16,
        textAlign: 'center',
    }
});
