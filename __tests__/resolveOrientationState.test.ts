/**
 * Unit tests for resolveOrientationState — covers all orientation mode combinations.
 *
 * What IS tested here (pure logic, no native modules needed):
 *   - showRotateOverlay / overlayTargetLandscape for every scenario
 *   - screenLayoutsMismatch detection
 *   - lockedOrientationMismatch detection
 *   - resolvedLayout selection (per-orientation vs legacy)
 *
 * What must still be tested ON DEVICE:
 *   - lockAsync / unlockAsync actually taking effect
 *   - useWindowDimensions updating after physical rotation
 *   - mismatchWasActiveRef reset on screen navigation
 *   - The unlock→relock cycle not causing a flash
 */

import {
    resolveOrientationState,
    OrientationStateInput,
} from '../src/engine/resolveOrientationState';
import { ScreenConfig, ElementConfig } from '../src/types/LayoutTypes';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EL_A: ElementConfig = { type: 'text', id: 'a' };
const EL_B: ElementConfig = { type: 'text', id: 'b' };

const screenBothLayouts: ScreenConfig = {
    layouts: { landscape: [EL_A], portrait: [EL_B] },
};
const screenLandscapeOnly: ScreenConfig = {
    layouts: { landscape: [EL_A] },
};
const screenPortraitOnly: ScreenConfig = {
    layouts: { portrait: [EL_B] },
};
const screenLegacyLayout: ScreenConfig = {
    layout: [EL_A, EL_B],
};
const screenNoContent: ScreenConfig = {
    layouts: { landscape: [], portrait: [] },
};

function make(overrides: Partial<OrientationStateInput>): OrientationStateInput {
    return {
        configOrientation: 'auto',
        deviceOrientation: 'landscape',
        isDevicePortrait: false,
        rawScreenConfig: screenBothLayouts,
        isWeb: false,
        ...overrides,
    };
}

// ─── AUTO mode ───────────────────────────────────────────────────────────────

describe('AUTO mode', () => {
    test('device landscape + screen has both → no overlay, landscape layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'landscape',
            rawScreenConfig: screenBothLayouts,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_A]);
    });

    test('device portrait + screen has both → no overlay, portrait layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenBothLayouts,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_B]);
    });

    test('device portrait + screen has landscape only → overlay (rotate to landscape)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenLandscapeOnly,
        }));
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(true);
        expect(r.resolvedLayout).toEqual([]); // empty, overlay covers it
    });

    test('device landscape + screen has portrait only → overlay (rotate to portrait)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenPortraitOnly,
        }));
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(false);
        expect(r.resolvedLayout).toEqual([]);
    });

    test('screen with no layouts field (legacy) → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'landscape',
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.screenHasOwnLayouts).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_A, EL_B]);
    });

    test('screen with empty arrays for both orientations → no overlay (nothing to rotate to)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'portrait',
            rawScreenConfig: screenNoContent,
        }));
        expect(r.showRotateOverlay).toBe(false); // otherHasContent=false → no mismatch
    });

    test('no screen config → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            rawScreenConfig: undefined,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toBeUndefined();
    });

    test('web platform → never show overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'auto',
            deviceOrientation: 'portrait',
            rawScreenConfig: screenLandscapeOnly,
            isWeb: true,
        }));
        expect(r.showRotateOverlay).toBe(false);
    });
});

// ─── PORTRAIT locked mode ─────────────────────────────────────────────────────

describe('PORTRAIT locked mode', () => {
    test('device portrait (correct) + legacy layout → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.isOrientationLocked).toBe(true);
    });

    test('device landscape (mismatch) + legacy layout → overlay (rotate to portrait)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(false);
    });

    test('isDevicePortrait=null (not yet known) + legacy → no overlay yet', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'landscape',
            isDevicePortrait: null,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(false);
    });

    test('screen has own layouts + device in landscape → screenLayoutsMismatch, not lockedOrientationMismatch', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenPortraitOnly,
        }));
        // lockedOrientationMismatch suppressed because screenHasOwnLayouts=true
        expect(r.screenHasOwnLayouts).toBe(true);
        // device is landscape, screenPortraitOnly has no landscape content → mismatch IS true
        expect(r.screenLayoutsMismatch).toBe(true);
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(false); // rotate to portrait
    });

    test('screen has both layouts + device in landscape → no overlay, show landscape layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenBothLayouts,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_A]);
    });

    test('screen has both layouts + device in portrait → no overlay, show portrait layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'portrait',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenBothLayouts,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_B]);
    });
});

// ─── LANDSCAPE locked mode ────────────────────────────────────────────────────

describe('LANDSCAPE locked mode', () => {
    test('device landscape (correct) + legacy layout → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'landscape',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.isOrientationLocked).toBe(true);
    });

    test('device portrait (mismatch) + legacy layout → overlay (rotate to landscape)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'landscape',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(true);
    });

    test('screen has portrait-only layouts + device in landscape → overlay (rotate to portrait)', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'landscape',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenPortraitOnly,
        }));
        expect(r.showRotateOverlay).toBe(true);
        expect(r.overlayTargetLandscape).toBe(false);
    });

    test('screen has landscape-only layouts + device in landscape → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'landscape',
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenLandscapeOnly,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_A]);
    });

    test('screen has both layouts + device in portrait → no overlay, show portrait layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: 'landscape',
            deviceOrientation: 'portrait',
            isDevicePortrait: true,
            rawScreenConfig: screenBothLayouts,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.resolvedLayout).toEqual([EL_B]);
    });
});

// ─── UNDEFINED orientation (EMPTY_LAYOUT on startup) ─────────────────────────

describe('undefined orientation (before remote config loads)', () => {
    test('device portrait + no screen → no overlay, no layout', () => {
        const r = resolveOrientationState(make({
            configOrientation: undefined,
            deviceOrientation: 'portrait',
            isDevicePortrait: null,
            rawScreenConfig: undefined,
        }));
        expect(r.showRotateOverlay).toBe(false);
        expect(r.isOrientationLocked).toBe(false);
    });

    test('device landscape + legacy screen → no overlay', () => {
        const r = resolveOrientationState(make({
            configOrientation: undefined,
            deviceOrientation: 'landscape',
            isDevicePortrait: false,
            rawScreenConfig: screenLegacyLayout,
        }));
        expect(r.showRotateOverlay).toBe(false);
    });
});


