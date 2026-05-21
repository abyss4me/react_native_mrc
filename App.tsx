import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Linking, ActivityIndicator, Platform, BackHandler, Alert } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

// Engine Imports
import {NetworkProvider, useNetwork} from './src/engine/NetworkContext';
import ScreenRenderer from './src/engine/ScreenRenderer';
import { preloadAssets, checkLayoutCompatibility } from './src/utils/AssetsLoader';
import { preloadRemoteFonts } from './src/utils/FontLoader';
import DisconnectOverlay from './src/components/DisconnectOverlay';
import { SCREEN } from './src/utils/constants';

// Screens
import { TransitionScreen } from './src/screens/TransitionScreen';
import { HomeScreen } from './src/screens/HomeScreen';

// localLayouts is used ONLY for local web/Chrome debug (Platform.OS === 'web').
// It is NOT a fallback — on mobile, any error always routes back to HomeScreen.
import localLayouts from './assets/layouts/layout.json';

SplashScreen.preventAutoHideAsync();

/* Relevant only for dev & debug in Chrome for checking screens */
const DEFAULT_DEV_SCREEN = SCREEN.DEV;

function AndroidBackHandler({ currentScreenId, setCurrentScreenId, setConfigUrl }: any) {
    const { disconnect } = useNetwork();

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const onBackPress = () => {
            // 1. If in offline setup screens, safely go back to Home
            if (currentScreenId === SCREEN.TRANSITION) {
                setCurrentScreenId(SCREEN.HOME);
                setConfigUrl(null);
                return true;
            }

            // 2. If actively connected to a server/game (Control Screen)
            if (currentScreenId !== SCREEN.HOME) {
                Alert.alert(
                    "Disconnect",
                    "Are you sure you want to disconnect from the game?",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Disconnect",
                            style: "destructive",
                                onPress: () => {
                                        disconnect();
                                        setCurrentScreenId(SCREEN.HOME);
                                        setConfigUrl(null);
                                    }
                        }
                    ]
                );
                return true; // We handled it, don't exit app or jump instantly
            }

            // 3. If on HOME_SCREEN, return false to let Android natively exit/background the app
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => backHandler.remove();
    }, [currentScreenId, disconnect, setCurrentScreenId, setConfigUrl]);

    return null;
}

function AppContent() {
    const [isReady, setIsReady] = useState(false);
    // Set initial screen based on the platform
    const [currentScreenId, setCurrentScreenId] = useState<string>(
        Platform.OS === 'web' ? DEFAULT_DEV_SCREEN : SCREEN.HOME
    );
    const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
    const [configUrl, setConfigUrl] = useState<string | null>(null);
    const [layouts, setLayouts] = useState<any>(localLayouts); // Start with local layouts
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);
    const [isConfigLoadingError, setConfigLoadingError] = useState(false);

    //Apply keep-awake setting dynamically from layout JSON
    useEffect(() => {
        const shouldKeepAwake = layouts?.settings?.keepAwake;

        const manageKeepAwake = async () => {
            try {
                if (shouldKeepAwake) {
                    await activateKeepAwakeAsync();
                } else {
                    await deactivateKeepAwake();
                }
            } catch (e) {
                console.warn("Failed to manage keep-awake state:", e);
            }
        };

        manageKeepAwake();
    }, [layouts?.settings?.keepAwake]);

    // Read SafeArea settings dynamically from layout JSON
    const { top, bottom, left, right } = useSafeAreaInsets();
    const shouldSafeArea = layouts?.settings?.useSafeArea === true;

    // Deep linking for cold starts and warm starts
    useEffect(() => {
        const handleUrl = (url: string | null) => {
            if (!url) return;
            try {
                const parsedUrl = new URL(url);
                const p = parsedUrl.searchParams.get('p');  //p - parameter which contains hashed roomId & hostname
                if (p) {
                    //console.log("🔗 Deep Link detected. Room ID:", p, "Config URL:", config);
                    setInitialRoomId(p);
                    setConfigUrl(null);
                    setCurrentScreenId(SCREEN.TRANSITION);
                }
            } catch (error) {
                console.error("Invalid deep link URL:", error);
            }
        };

        Linking.getInitialURL().then(handleUrl);
        const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
        return () => subscription.remove();
    }, []);

    // Effect to fetch remote layout when configUrl changes
    useEffect(() => {
        const fetchLayout = async () => {
            if (!configUrl) return;
            setIsLoadingConfig(true);
            console.log(`Fetching remote layout from: ${configUrl}`);
            try {
                const response = await fetch(configUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const remoteLayouts = await response.json();

                // Resolve all relative asset URLs in-place BEFORE rendering,
                try {
                    if (!checkLayoutCompatibility(remoteLayouts)) {
                        // Fall back to Home Screen if layout is incompatible with current app version
                        const defaultScreen = SCREEN.HOME;
                        setConfigLoadingError(true)
                        setCurrentScreenId(defaultScreen);
                        return;
                    }
                    await preloadAssets(remoteLayouts);
                    await preloadRemoteFonts(remoteLayouts);
                } catch (e) {
                    console.warn("Asset preloading warning during fetchLayout:", e);
                }

                setLayouts(remoteLayouts); // Replace layouts with the remote one (URLs now resolved)
                console.log("Remote layout loaded successfully.");

                // Hide transition and show default screen from JSON configuration
                const defaultScreen = remoteLayouts.initialScreen || (remoteLayouts.screens && Object.keys(remoteLayouts.screens)[0]) || SCREEN.HOME;
                setCurrentScreenId(defaultScreen);
            } catch (error) {
                console.error("Failed to fetch or parse remote layout:", error);
                setConfigLoadingError(true);
                setCurrentScreenId(SCREEN.HOME);
            } finally {
                setIsLoadingConfig(false);
            }
        };

        fetchLayout();
    }, [configUrl]);

    // Initial preparation — runs once on mount
    useEffect(() => {
        async function prepare() {
            if (Platform.OS === 'web') {
                // Web: preload local layout assets before revealing the UI
                try {
                    await Promise.all([
                        preloadAssets(localLayouts),
                        preloadRemoteFonts(localLayouts)
                    ]);
                } catch (e) {
                    console.warn("Asset preloading warning:", e);
                }
            } else {
                // Mobile: hide the native splash screen immediately — HomeScreen has no remote assets to wait for
                try {
                    await SplashScreen.hideAsync();
                } catch (e) {
                    console.warn("Error hiding splash screen:", e);
                }
            }
            setIsReady(true);
        }
        prepare();
    }, []);

    // Lock orientation on mobile only
    useEffect(() => {
        if (Platform.OS !== 'web') {
            const isLandscape = layouts?.settings?.orientation !== 'portrait'; // default to landscape if not explicitly portrait
            async function lockOrientation() {
                try {
                    await ScreenOrientation.lockAsync(isLandscape ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP);
                } catch (error) {
                    console.warn("Orientation lock failed:", error);
                }
            }
            lockOrientation();
        }
    }, [layouts?.settings?.orientation]);

    const currentConfig = layouts.screens[currentScreenId] || "";
    const globalBackground = layouts.background;

    // Dynamically pad the main view if SafeArea is requested by the server JSON
    const safeAreaPadding = shouldSafeArea ? {
        paddingTop: top,
        paddingBottom: bottom,
        paddingLeft: left,
        paddingRight: right
    } : {};

    return (
        <NetworkProvider
            onScreenChange={setCurrentScreenId}
            layouts={layouts}
            onConfigUrlReceived={(url) => {
                if (url) {
                    setConfigUrl(prevUrl => {
                        if (prevUrl !== null) {
                            console.log("Config URL already set, ignoring new URL:", url);
                            return prevUrl; // Lock after first set — config loads once per session
                        }
                        console.log("Setting layout config URL from Network:", url);
                        return url;
                    });
                }
            }}
        >
            <AndroidBackHandler
                currentScreenId={currentScreenId}
                setCurrentScreenId={setCurrentScreenId}
                setConfigUrl={setConfigUrl}
            />
            <View style={[styles.container, safeAreaPadding]}>
                <StatusBar hidden translucent backgroundColor="transparent" />

                {(!isReady || isLoadingConfig) ? (
                    <View style={[styles.container, styles.centered]}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.loadingText}>{isLoadingConfig ? 'Loading Configuration...' : 'Preparing...'}</Text>
                    </View>
                ) : (
                    <>
                        {currentScreenId === SCREEN.HOME ? (
                            <HomeScreen isConfigLoadingError={isConfigLoadingError}/>
                        ) : currentScreenId === SCREEN.TRANSITION ? (
                            <TransitionScreen roomId={initialRoomId!} onCancel={() => {
                                setCurrentScreenId(Platform.OS === 'web' ? DEFAULT_DEV_SCREEN : SCREEN.HOME);
                                setConfigUrl(null);
                            }} />
                        ) : (
                            <ScreenRenderer screenConfig={currentConfig} globalBackground={globalBackground} templates={layouts?.templates} />
                        )}
                        <DisconnectOverlay hidden={currentScreenId === SCREEN.TRANSITION} />
                    </>
                )}
            </View>
        </NetworkProvider>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AppContent />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: 'white',
        fontSize: 16,
    },
});