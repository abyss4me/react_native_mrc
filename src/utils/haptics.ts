import { Vibration } from 'react-native';

export type HapticStrength = 'light' | 'medium' | 'heavy';

const HAPTIC_DURATIONS: Record<HapticStrength, number> = {
    light:  50,
    medium: 100,
    heavy:  200,
};

/**
 * Fires a short vibration based on a named haptic strength.
 * No-ops when haptic is undefined.
 */
export const triggerHaptic = (haptic: HapticStrength | undefined): void => {
    if (!haptic) return;
    Vibration.vibrate(HAPTIC_DURATIONS[haptic] ?? 50);
};

