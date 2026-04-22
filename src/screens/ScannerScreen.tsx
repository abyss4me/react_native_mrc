// src/screens/ScannerScreen.tsx
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { parseRoomId } from '../utils/urlHelper';

export const ScannerScreen = ({ navigation }: any) => {
    const device = useCameraDevice('back');
    const [isActive, setIsActive] = useState(true);

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && isActive) {
                const rawValue = codes[0].value;
                const roomId = parseRoomId(rawValue || '');

                if (roomId) {
                    setIsActive(false); // Зупиняємо сканер
                    // Використовуємо replace, щоб видалити камеру зі стека
                    navigation.replace('Transit', { roomId });
                }
            }
        }
    });

    if (!device) return null;

    return (
        <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive}
            codeScanner={codeScanner}
        />
    );
};