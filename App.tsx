import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Text, useWindowDimensions, Linking } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';

// Engine Imports
import { NetworkProvider } from './src/engine/NetworkContext';
import ScreenRenderer from './src/engine/ScreenRenderer';
import { preloadAssets } from './src/utils/AssetsLoader';
import { preloadRemoteFonts } from './src/utils/FontLoader';
import { setOrientation } from './src/utils/OrientationManager';

// --- 1. CONFIGURATION & MOCK DATA ---
// These are your JSON layouts. In the future, you can load them via fetch()
// or import from a file: import localLayouts from './src/layouts/main_layout.json';
import localLayouts from './assets/layouts/main_layout.json';

const linking = {
    // Ваші префікси (Universal Links та Custom Scheme)
    prefixes: ['https://h5.play.works/works/mrc/', 'mrcapp://'],
    config: {
        screens: {
            // Мапимо шлях index.html на логіку програми
            CONNECT_SCREEN: 'index.html',
        },
    },
};

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
    const [isReady, setIsReady] = useState(false);
    // 1. Navigation state
    const [currentScreenId, setCurrentScreenId] = useState<string>("CONNECT_SCREEN");

    const [initialRoomId, setInitialRoomId] = useState<string | null>(null);

    const { width, height } = useWindowDimensions();
    const isPortrait = height > width;

    // --- 2. DEEP LINKING LOGIC ---
    useEffect(() => {
        const handleUrl = (url: string | null) => {
            if (!url) return;

            // Парсимо URL (https://h5.play/works/mrc/index.html?p=1223344)
            const parsedUrl = new URL(url);
            const p = parsedUrl.searchParams.get('p');

            if (p) {
                console.log("🔗 Deep Link detected. Room ID:", p);
                setInitialRoomId(p);
                // Якщо прийшов лінк, перемикаємо на екран завантаження/геймпада
                setCurrentScreenId("GAMEPAD_SCREEN");
            }
        };

        // Перевірка при холодному старті (Cold Start)
        Linking.getInitialURL().then(handleUrl);

        // Слухач для відкритого додатка (Warm Start)
        const subscription = Linking.addEventListener('url', (event) => {
            handleUrl(event.url);
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        async function prepare() {
            try {
                // 1. Тримаємо Splash Screen
              //  await SplashScreen.preventAutoHideAsync();

                // 2. Load fonts & images

                await Promise.all([
                    preloadAssets(localLayouts) ,// Images preload
                    preloadRemoteFonts(localLayouts)
                ]);

            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
                // 3. Hide splash
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
    const globalBackground = (localLayouts as any).background;

    return (
        <NavigationContainer linking={linking}>
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
                <NetworkProvider onScreenChange={setCurrentScreenId}
                                /* initialRoomId={initialRoomId}*/
                >
                    <ScreenRenderer screenConfig={currentConfig} globalBackground={globalBackground} />
                </NetworkProvider>
            )}
        </View>
        </NavigationContainer>
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