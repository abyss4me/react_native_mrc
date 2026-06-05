// src/services/FeedbackService.ts
import { Vibration, Platform, ToastAndroid, Alert } from 'react-native';
import { TriggerHapticsMessage, ShowErrorToastMessage } from '../types/ProtocolTypes';

export const triggerHaptics = (data: TriggerHapticsMessage['data']): void => {
    const pattern = data?.pattern;
    const duration = data?.duration || 400;

    if (pattern && Array.isArray(pattern)) {
        Vibration.vibrate(pattern);
    } else {
        Vibration.vibrate(duration);
    }
};

export const showError = (data: ShowErrorToastMessage['data']): void => {
    const message = data?.message || 'An error occurred';
    if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
        Alert.alert('Notice', message);
    }
};

