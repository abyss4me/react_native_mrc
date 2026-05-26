import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Linking, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Engine Imports
import { NetworkProvider } from './engine/NetworkContext';
import { LayoutContext } from './engine/LayoutContext';
import { InputGuardProvider } from './engine/InputGuardContext';
import { LayoutConfig, LayoutSettings } from './types/LayoutTypes';
import ScreenRenderer from './engine/ScreenRenderer';
import { preloadAssets, checkLayoutCompatibility } from './utils/AssetsLoader';
import { preloadRemoteFonts } from './utils/FontLoader';
import DisconnectOverlay from './components/DisconnectOverlay';
import { SCREEN } from './constants';

// Screens
import { TransitionScreen } from './screens/TransitionScreen';
import { HomeScreen } from './screens/HomeScreen';

// Components
import AndroidBackHandler from './components/AndroidBackHandler';
import LoadingIndicator from './components/LoadingIndicator';

// localLayouts is used ONLY for local web/Chrome debug (Platform.OS === 'web').
import localLayouts from '../assets/layouts/layout.json';

SplashScreen.preventAutoHideAsync();

// Disable text selection on web to prevent accidental copy on desktop/mobile browsers
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = '* { user-select: none !important; -webkit-user-select: none !important; }';
    document.head.appendChild(style);
}

const DEFAULT_DEV_SCREEN = SCREEN.DEV;

export default function Main() {
    const [isReady, setIsReady] = useState(false);
    // Set initial screen based on the platform
    const [currentScreenId, setCurrentScreenId] = useState<string>(
        Platform.OS === 'web' ? DEFAULT_DEV_SCREEN : SCREEN.HOME
    );
    const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
    const [configUrl, setConfigUrl] = useState<string | null>(null);
    const [layouts, setLayouts] = useState<LayoutConfig>(localLayouts as unknown as LayoutConfig); // Start with local layouts
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

    const currentConfig = layouts.screens?.[currentScreenId];

    const resolvedSettings: LayoutSettings = layouts?.settings ?? {};

    // Dynamically pad the main view if SafeArea is requested by the server JSON
    const safeAreaPadding = shouldSafeArea ? {
        paddingTop: top,
        paddingBottom: bottom,
        paddingLeft: left,
        paddingRight: right
    } : {};

    return (
        <LayoutContext.Provider value={{ layouts, settings: resolvedSettings }}>
        <InputGuardProvider>
        <NetworkProvider
            onScreenChange={setCurrentScreenId}
            layouts={layouts}
            onReconnected={() => {
                // When auto-reconnect fires from background (onConnected never triggers),
                // the server may not re-send SET_SCREEN. Navigate away from TransitionScreen
                // using the last known screenId so the user isn't stuck on "Connecting...".
                setCurrentScreenId(prev => {
                    if (prev === SCREEN.TRANSITION) {
                        console.log("Auto-reconnect: navigating away from TransitionScreen");
                        return SCREEN.HOME;
                    }
                    return prev;
                });
            }}
            onConfigUrlReceived={(url) => {
                if (url) {
                    setConfigUrl(prevUrl => {
                        if (prevUrl !== null) {
                            console.log("Config URL already set, ignoring new URL:", url);
                            return prevUrl;
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
                    <LoadingIndicator isLoadingConfig={isLoadingConfig} />
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
                            <ScreenRenderer screenConfig={currentConfig} />
                        )}
                        <DisconnectOverlay hidden={currentScreenId === SCREEN.TRANSITION} />
                    </>
                )}
            </View>
        </NetworkProvider>
        </InputGuardProvider>
        </LayoutContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    }
});
