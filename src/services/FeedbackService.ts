// src/services/FeedbackService.ts
import { Vibration, Platform, ToastAndroid, Alert } from 'react-native';

/**
 * Triggers haptic feedback based on server payload.
 * Supports a custom vibration pattern or a simple duration (default 400ms).
 */
export const triggerHaptics = (data: any): void => {
    const pattern = data?.pattern;
    const duration = data?.duration || 400;

    if (pattern && Array.isArray(pattern)) {
        Vibration.vibrate(pattern);
    } else {
        Vibration.vibrate(duration);
    }
};

/**
 * Shows an error message to the user.
 * Uses ToastAndroid on Android, Alert on other platforms.
 */
export const showError = (data: any): void => {
    const message = data?.message || 'An error occurred';
    if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
        Alert.alert('Notice', message);
    }
};

