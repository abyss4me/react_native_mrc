import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, StatusBar, Linking, Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Engine Imports
import { NetworkProvider } from './engine/NetworkContext';
import { LayoutContext } from './engine/LayoutContext';
import { InputGuardProvider } from './engine/InputGuardContext';
import { LayoutConfig, LayoutSettings, ScreenConfig } from './types/LayoutTypes';
import ScreenRenderer from './engine/ScreenRenderer';
import { resolveOrientationState } from './engine/resolveOrientationState';
import { preloadAssets, checkLayoutCompatibility } from './utils/AssetsLoader';
import { preloadRemoteFonts } from './utils/FontLoader';
import DisconnectOverlay from './components/DisconnectOverlay';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';
import { SCREEN } from './constants';

// Screens
import { TransitionScreen } from './screens/TransitionScreen';
import { HomeScreen } from './screens/HomeScreen';

// Components
import AndroidBackHandler from './components/AndroidBackHandler';
import LoadingIndicator from './components/LoadingIndicator';

// localLayouts is used ONLY for local web/Chrome debug (Platform.OS === 'web').
// On mobile the initial state is intentionally empty — the real config is fetched
// from the server. Loading localLayouts on mobile caused its settings (e.g. orientation)
// to apply before the remote config arrived, producing incorrect orientation locks.
import _localLayouts from '../assets/layouts/config.json';
const localLayouts = _localLayouts as unknown as LayoutConfig;
const EMPTY_LAYOUT: LayoutConfig = {};

SplashScreen.preventAutoHideAsync();

// Disable text selection on web to prevent accidental copy on desktop/mobile browsers
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = '* { user-select: none !important; -webkit-user-select: none !important; }';
    document.head.appendChild(style);
}

const DEFAULT_DEV_SCREEN = SCREEN.DEV;

/**
 * Extracts the ?p= parameter from a deep-link URL.
 *
 * Using a regex instead of new URL() so the function works with every
 * URL form without relying on exception-based flow control:
 *  - mrcengine://host?p=VALUE  (standard authority URL)
 *  - mrcengine:?p=VALUE        (opaque-path URL — new URL().searchParams is empty for these)
 *  - https://h5.play.works/path?p=VALUE  (Universal Link passthrough)
 */
function extractPParam(url: string): string | null {
    const match = url.match(/[?&]p=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export default function Main() {
    const [isReady, setIsReady] = useState(false);
    // Set initial screen based on the platform
    const [currentScreenId, setCurrentScreenId] = useState<string>(
        Platform.OS === 'web' ? DEFAULT_DEV_SCREEN : SCREEN.HOME
    );
    // Increments on every LOAD_SCREEN message — even when screenId hasn't changed.
    // ScreenRenderer depends on this so unlockInput() fires even on same-screen reloads.
    const [loadScreenSignal, setLoadScreenSignal] = useState(0);
    const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
    const [configUrl, setConfigUrl] = useState<string | null>(null);
    const [layouts, setLayouts] = useState<LayoutConfig>(
        Platform.OS === 'web' ? localLayouts : EMPTY_LAYOUT
    );
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);
    const [isConfigLoadingError, setConfigLoadingError] = useState(false);

    // Tracks whether we have ever received a config URL in this session.
    // Used to distinguish a background reconnect (server won't re-send config) from
    // the initial connection (server WILL send config — no need to navigate away from TransitionScreen).
    const hasReceivedConfig = useRef(false);

    // Populated by NetworkProvider — lets fetchLayout call disconnect() even though Main is
    // a parent of NetworkProvider and therefore cannot use useConnection() directly.
    const networkDisconnectRef = useRef<(() => void) | null>(null);

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

    // Deep linking — warm starts (app already running when QR code is scanned).
    // Cold starts are handled inside prepare() below so isReady is only set to
    // true AFTER the initial URL is known, preventing a HomeScreen flash.
    useEffect(() => {
        const subscription = Linking.addEventListener('url', (event) => {
            const p = extractPParam(event.url);
            if (p) {
                hasReceivedConfig.current = false;
                setInitialRoomId(p);
                setConfigUrl(null);
                setCurrentScreenId(SCREEN.TRANSITION);
            }
        });
        return () => subscription.remove();
    }, []);

    // Effect to fetch remote layout when configUrl changes
    useEffect(() => {
        if (!configUrl) return;
        const controller = new AbortController();

        const fetchLayout = async () => {
            setIsLoadingConfig(true);
            // Append a timestamp to bust iOS NSURLCache — the native layer ignores
            // the `cache` fetch option but does respect Cache-Control request headers.
            const separator = configUrl.includes('?') ? '&' : '?';
            const bustUrl = `${configUrl}${separator}_t=${Date.now()}`;
            console.log(`Fetching remote layout from: ${bustUrl}`);
            try {
                const response = await fetch(bustUrl, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-store, no-cache',
                        'Pragma': 'no-cache',
                    },
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const remoteLayouts = await response.json();

                // Resolve all relative asset URLs in-place BEFORE rendering,
                try {
                    if (!checkLayoutCompatibility(remoteLayouts)) {
                        // Version mismatch — disconnect so the socket is fully cleaned up.
                        // Without this, the still-alive socket can fire onUserDisconnected
                        // when the OS suspends it (e.g. after backgrounding), causing the
                        // DisconnectOverlay to appear on top of the HomeScreen error message.
                        networkDisconnectRef.current?.();
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
                if ((error as Error).name === 'AbortError') return; // fetch was cancelled — ignore
                console.error("Failed to fetch or parse remote layout:", error);
                setConfigLoadingError(true);
                setCurrentScreenId(SCREEN.HOME);
            } finally {
                if (!controller.signal.aborted) setIsLoadingConfig(false);
            }
        };

        fetchLayout();
        return () => controller.abort();
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
                // Mobile: resolve the cold-start deep-link URL BEFORE revealing the UI.
                // This guarantees isReady becomes true only after the initial screen is
                // already set to TRANSITION (if a ?p= param was present), so there is
                // no HomeScreen flash when the app is launched via a QR-code / custom-scheme link.
                try {
                    const initialUrl = await Linking.getInitialURL();
                    if (initialUrl) {
                        const p = extractPParam(initialUrl);
                        if (p) {
                            hasReceivedConfig.current = false;
                            setInitialRoomId(p);
                            setConfigUrl(null);
                            setCurrentScreenId(SCREEN.TRANSITION);
                        }
                    }
                } catch (e) {
                    console.warn("Error processing initial deep-link URL:", e);
                }

                // Hide the native splash screen — HomeScreen has no remote assets to wait for
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

    const { width: winWidth, height: winHeight } = useWindowDimensions();

    // Keep a ref so the orientation effect can read current dimensions
    // without needing them as dependencies (which would re-trigger lockAsync on every resize).
    const winSizeRef = useRef({ winWidth, winHeight });
    useEffect(() => {
        winSizeRef.current = { winWidth, winHeight };
    }, [winWidth, winHeight]);

    // Track whether the device is physically in portrait — used by resolveOrientationState
    // for lockedOrientationMismatch (physical vs intended lock). null = not yet known.
    const [isDevicePortrait, setIsDevicePortrait] = useState<boolean | null>(null);

    // Tracks the orientation we last successfully locked to, to avoid redundant lock calls.
    const lockedOrientationRef = useRef<'landscape' | 'portrait' | null>(null);

    const configOrientation: 'landscape' | 'portrait' | 'auto' | undefined = layouts?.settings?.orientation;
    const isAutoMode = configOrientation === 'auto';

    // Lock orientation on mobile only
    useEffect(() => {
        if (Platform.OS !== 'web') {
            const updatePortraitState = (orientation: ScreenOrientation.Orientation) => {
                const portrait =
                    orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
                    orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;
                setIsDevicePortrait(portrait);
            };

            // Listen for physical orientation changes (user rotating device manually)
            const sub = ScreenOrientation.addOrientationChangeListener((e) => {
                updatePortraitState(e.orientationInfo.orientation);
            });

            async function applyOrientation() {
                // Default to 'auto' when orientation is not specified.
                const orientation = configOrientation ?? 'auto';

                if (orientation === 'auto') {
                    // Immediately derive from window dims so the correct layout renders
                    // on this frame — before the async unlock completes.
                    const { winWidth: w, winHeight: h } = winSizeRef.current;
                    setIsDevicePortrait(h > w);

                    try { await ScreenOrientation.unlockAsync(); } catch {}
                    lockedOrientationRef.current = null;

                    // Confirm with OS API (corrects edge cases)
                    try {
                        const current = await ScreenOrientation.getOrientationAsync();
                        if (current !== ScreenOrientation.Orientation.UNKNOWN) {
                            updatePortraitState(current);
                        }
                    } catch { /* keep the dimension-derived value */ }
                } else {
                    const isLandscape = orientation !== 'portrait';
                    const targetKey: 'landscape' | 'portrait' = isLandscape ? 'landscape' : 'portrait';

                    // Skip if already locked to correct orientation — avoids a rotation flash.
                    if (lockedOrientationRef.current === targetKey) {
                        try {
                            const current = await ScreenOrientation.getOrientationAsync();
                            if (current !== ScreenOrientation.Orientation.UNKNOWN) updatePortraitState(current);
                        } catch {}
                        return;
                    }

                    try {
                        if (isLandscape) {
                            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                        } else {
                            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                        }
                        lockedOrientationRef.current = targetKey;
                        // Set state from the INTENDED orientation — getOrientationAsync() right after
                        // lockAsync still returns the pre-lock value (device hasn't rotated yet).
                        setIsDevicePortrait(!isLandscape);
                    } catch (error) {
                        console.warn("Orientation lock failed:", error);
                        try {
                            const current = await ScreenOrientation.getOrientationAsync();
                            if (current === ScreenOrientation.Orientation.UNKNOWN) {
                                const { winWidth: w, winHeight: h } = winSizeRef.current;
                                setIsDevicePortrait(h > w);
                            } else {
                                updatePortraitState(current);
                            }
                        } catch {
                            const { winWidth: w, winHeight: h } = winSizeRef.current;
                            setIsDevicePortrait(h > w);
                        }
                    }
                }
            }
            applyOrientation();

            return () => { sub.remove(); };
        } else {
            setIsDevicePortrait(false); // Web — never show the overlay
        }
    }, [configOrientation]);

    // Derived device orientation from window dimensions — always accurate:
    // unlocked (auto) dims update on rotation; locked dims reflect the lock;
    // mismatch case is temporarily unlocked by the effect below.
    const deviceOrientation: 'landscape' | 'portrait' = winHeight > winWidth ? 'portrait' : 'landscape';

    // --- Orientation state resolution (pure, unit-tested in resolveOrientationState.test.ts) ---
    const rawScreenConfig: ScreenConfig | undefined = layouts.screens?.[currentScreenId];
    const {
        showRotateOverlay,
        overlayTargetLandscape,
        screenLayoutsMismatch,
        isOrientationLocked,
        resolvedLayout,
    } = resolveOrientationState({
        configOrientation,
        deviceOrientation,
        isDevicePortrait,
        rawScreenConfig,
        isWeb: Platform.OS === 'web',
    });

    const wantLandscape = configOrientation === 'landscape';

    // Ref so the mismatch effect can read deviceOrientation without adding it as a dep.
    const deviceOrientationRef = useRef(deviceOrientation);
    useEffect(() => { deviceOrientationRef.current = deviceOrientation; }, [deviceOrientation]);

    // Tracks whether screenLayoutsMismatch was ever true for the CURRENT screen.
    // Reset on screen change. Distinguishes two cases when mismatch=false:
    //   1. Mismatch just resolved (user rotated) → lock to device orientation (avoid snap-back loop)
    //   2. No mismatch ever on this screen       → restore global config lock
    const mismatchWasActiveRef = useRef(false);
    useEffect(() => {
        mismatchWasActiveRef.current = false;
    }, [currentScreenId]);

    useEffect(() => {
        if (Platform.OS === 'web' || isAutoMode) return;
        if (screenLayoutsMismatch) {
            mismatchWasActiveRef.current = true;
            lockedOrientationRef.current = null;
            ScreenOrientation.unlockAsync().catch(() => {});
        } else if (isOrientationLocked) {
            if (mismatchWasActiveRef.current) {
                // Mismatch just resolved — lock to current device orientation (has content).
                const current = deviceOrientationRef.current;
                const lock = current === 'landscape'
                    ? ScreenOrientation.OrientationLock.LANDSCAPE
                    : ScreenOrientation.OrientationLock.PORTRAIT_UP;
                lockedOrientationRef.current = current;
                ScreenOrientation.lockAsync(lock).catch(() => {});
            } else {
                // No mismatch on this screen — restore the global config lock.
                const targetKey: 'landscape' | 'portrait' = wantLandscape ? 'landscape' : 'portrait';
                const lock = wantLandscape
                    ? ScreenOrientation.OrientationLock.LANDSCAPE
                    : ScreenOrientation.OrientationLock.PORTRAIT_UP;
                lockedOrientationRef.current = targetKey;
                ScreenOrientation.lockAsync(lock).catch(() => {});
            }
        }
    }, [screenLayoutsMismatch, isOrientationLocked, isAutoMode, currentScreenId, wantLandscape]);

    // Build the final screen config using the orientation-resolved layout.
    const currentConfig = useMemo(() => {
        if (!rawScreenConfig) return undefined;
        if (rawScreenConfig.layouts) {
            return { ...rawScreenConfig, layout: resolvedLayout ?? [] };
        }
        return rawScreenConfig;
    }, [rawScreenConfig, resolvedLayout]);

    const resolvedSettings: LayoutSettings = useMemo(
        () => layouts?.settings ?? {},
        [layouts]
    );

    const layoutContextValue = useMemo(
        () => ({ layouts, settings: resolvedSettings }),
        [layouts, resolvedSettings]
    );

    const handleReconnected = useCallback(() => {
        if (!hasReceivedConfig.current) return;
        setCurrentScreenId(prev => {
            if (prev === SCREEN.TRANSITION) {
                console.log("Auto-reconnect: navigating away from TransitionScreen");
                return SCREEN.HOME;
            }
            return prev;
        });
    }, []);

    const handleConfigUrlReceived = useCallback((url: string) => {
        if (url) {
            setConfigUrl(prevUrl => {
                if (prevUrl !== null) {
                    console.log("Config URL already set, ignoring new URL:", url);
                    return prevUrl;
                }
                console.log("Setting layout config URL from Network:", url);
                hasReceivedConfig.current = true;
                return url;
            });
        }
    }, []);

    // Dynamically pad the main view if SafeArea is requested by the server JSON
    const safeAreaPadding = shouldSafeArea ? {
        paddingTop: top,
        paddingBottom: bottom,
        paddingLeft: left,
        paddingRight: right
    } : {};

    return (
        <LayoutContext.Provider value={layoutContextValue}>
        <InputGuardProvider>
        <NetworkProvider
            onScreenChange={useCallback((screenId: string) => {
                setCurrentScreenId(screenId);
                setLoadScreenSignal(s => s + 1);
            }, [])}
            layouts={layouts}
            onReconnected={handleReconnected}
            onConfigUrlReceived={handleConfigUrlReceived}
            disconnectRef={networkDisconnectRef}
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
                            <ScreenRenderer screenConfig={currentConfig} loadScreenSignal={loadScreenSignal} />
                        )}
                        <DisconnectOverlay hidden={currentScreenId === SCREEN.TRANSITION} />
                    </>
                )}

                {/* Last child = always paints on top on Android, regardless of zIndex */}
                <RotateDeviceOverlay visible={showRotateOverlay} targetLandscape={overlayTargetLandscape} />
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
