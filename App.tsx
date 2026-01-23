import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';

// Engine Imports
import { NetworkProvider } from './src/engine/NetworkContext';
import ScreenRenderer from './src/engine/ScreenRenderer';

// --- 1. CONFIGURATION & MOCK DATA ---
// These are your JSON layouts. In the future, you can load them via fetch()
// or import from a file: import localLayouts from './src/layouts/main_layout.json';
import localLayouts from './assets/layouts/main_layout.json';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
    // 1. Navigation state
    const [currentScreenId, setCurrentScreenId] = useState<string>("CONNECT_SCREEN");
    
    // 2. Font loading
    const [fontsLoaded] = useFonts({
        // Make sure the file is in the ./assets/fonts/ folder
        'LibreFranklinBold': require('./assets/fonts/libre_franklin_bold.ttf'),
    });

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

    // 4. Handling View readiness (hiding the splash screen) TODO:
    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    // While fonts are not loaded - return null (the splash is still visible)
    if (!fontsLoaded) {
        return null;
    }

    // 5. Selecting screen configuration
    // Fallback to CONNECT_SCREEN if an unknown ID is received
    const currentConfig = (localLayouts as any).screens[currentScreenId] || (localLayouts as any)["CONNECT_SCREEN"];

    return (
        <View style={styles.container} onLayout={onLayoutRootView}>
            {/* Hide the status bar for full immersion */}
            <StatusBar hidden translucent backgroundColor="transparent" />

            <NetworkProvider onScreenChange={setCurrentScreenId}>
                <ScreenRenderer screenConfig={currentConfig} />
            </NetworkProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black', // Background color
    },
});
