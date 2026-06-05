/**
 * resolveOrientationState — pure function that encapsulates all orientation
 * decision logic from Main.tsx. Extracted so it can be fully unit-tested
 * without any native modules, hooks, or device state.
 *
 * Everything that depends on device/native APIs stays in Main.tsx as effects.
 * This function only takes plain values and returns plain values.
 */

import { ScreenConfig } from '../types/LayoutTypes';

export type OrientationMode = 'landscape' | 'portrait' | 'auto' | undefined;
export type DeviceOrientation = 'landscape' | 'portrait';

export interface OrientationStateInput {
    /** Global orientation setting from config */
    configOrientation: OrientationMode;
    /** Current device orientation derived from window dimensions (width > height = landscape) */
    deviceOrientation: DeviceOrientation;
    /** Physical device portrait state from OS API — null = not yet known */
    isDevicePortrait: boolean | null;
    /** The screen config for the currently active screen */
    rawScreenConfig: ScreenConfig | undefined;
    /** Whether running on web (overlays never shown on web) */
    isWeb: boolean;
}

export interface OrientationStateOutput {
    /** Whether to show the rotate-device overlay */
    showRotateOverlay: boolean;
    /** Which direction the overlay should instruct the user to rotate TO */
    overlayTargetLandscape: boolean;
    /** Whether the current screen has per-orientation layouts defined */
    screenHasOwnLayouts: boolean;
    /** Whether there's a mismatch between device orientation and available screen layouts */
    screenLayoutsMismatch: boolean;
    /** Whether global orientation config is locked (not auto/undefined) */
    isOrientationLocked: boolean;
    /** The effective element array to render for the current orientation */
    resolvedLayout: import('../types/LayoutTypes').ElementConfig[] | undefined;
}

export function resolveOrientationState(input: OrientationStateInput): OrientationStateOutput {
    const { configOrientation, deviceOrientation, isDevicePortrait, rawScreenConfig, isWeb } = input;

    const isAutoMode = configOrientation === 'auto';
    const isOrientationLocked = configOrientation === 'landscape' || configOrientation === 'portrait';
    const wantLandscape = configOrientation === 'landscape';
    const otherOrientation: DeviceOrientation = deviceOrientation === 'landscape' ? 'portrait' : 'landscape';
    const screenHasOwnLayouts = !!rawScreenConfig?.layouts;

    // lockedOrientationMismatch: global lock disagrees with physical device orientation.
    // Suppressed when screen has own layouts (screenLayoutsMismatch is the authority).
    const lockedOrientationMismatch =
        isOrientationLocked &&
        !isAutoMode &&
        !screenHasOwnLayouts &&
        isDevicePortrait !== null &&
        ((wantLandscape && isDevicePortrait === true) ||
            (!wantLandscape && isDevicePortrait === false));

    // screenLayoutsMismatch: screen defines `layouts` but current orientation has no content,
    // while the opposite orientation does. Works for all global orientation modes.
    const screenLayoutsMismatch = (() => {
        if (!rawScreenConfig?.layouts) return false;
        const currentHasContent = (rawScreenConfig.layouts[deviceOrientation]?.length ?? 0) > 0;
        const otherHasContent = (rawScreenConfig.layouts[otherOrientation]?.length ?? 0) > 0;
        return !currentHasContent && otherHasContent;
    })();

    const showRotateOverlay = !isWeb && (lockedOrientationMismatch || screenLayoutsMismatch);
    const overlayTargetLandscape = screenLayoutsMismatch ? otherOrientation === 'landscape' : wantLandscape;

    // Resolve the effective layout array for the current orientation.
    // If screen has `layouts`, pick current orientation — do NOT fall back to opposite
    // (empty layout is intentional: rotate overlay will be shown instead).
    let resolvedLayout: import('../types/LayoutTypes').ElementConfig[] | undefined;
    if (!rawScreenConfig) {
        resolvedLayout = undefined;
    } else if (rawScreenConfig.layouts) {
        resolvedLayout = rawScreenConfig.layouts[deviceOrientation] ?? [];
    } else {
        resolvedLayout = rawScreenConfig.layout;
    }

    return {
        showRotateOverlay,
        overlayTargetLandscape,
        screenHasOwnLayouts,
        screenLayoutsMismatch,
        isOrientationLocked,
        resolvedLayout,
    };
}

