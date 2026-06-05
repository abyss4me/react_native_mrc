import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface RotateDeviceOverlayProps {
    visible: boolean;
    targetLandscape?: boolean; // true = needs landscape, false = needs portrait
}

const RotateDeviceOverlay: React.FC<RotateDeviceOverlayProps> = ({ visible, targetLandscape = true }) => {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        Animated.loop(
            Animated.sequence([
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.delay(600),
                Animated.timing(rotateAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.delay(300),
            ])
        ).start();

        return () => rotateAnim.stopAnimation();
    }, [visible, rotateAnim]);

    if (!visible) return null;

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', targetLandscape ? '90deg' : '-90deg'],
    });

    return (
        <View style={styles.overlay}>
            <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>
                📱
            </Animated.Text>
            <Text style={styles.title}>Rotate your device</Text>
            <Text style={styles.subtitle}>
                {targetLandscape ? 'This app works in landscape mode' : 'This app works in portrait mode'}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    icon: {
        fontSize: 80,
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 18,
        color: '#AAAAAA',
    },
});

export default RotateDeviceOverlay;


