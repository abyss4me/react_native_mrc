import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    Pressable,
    Animated
} from 'react-native';
import { useConnection } from '../engine/NetworkContext';
import { TRANSITION_FADE_DURATION } from '../constants';

interface TransitionScreenProps {
    roomId: string;
    onCancel: () => void;
}

export const TransitionScreen: React.FC<TransitionScreenProps> = ({ roomId, onCancel }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { connect, connectionError, reconnect } = useConnection();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: TRANSITION_FADE_DURATION,
            useNativeDriver: true,
        }).start();

        if (roomId) {
            connect(roomId);
        }
    }, [roomId, connect, fadeAnim]);

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <View style={styles.content}>

                {/* Main Text */}
                <Text style={styles.title}>
                    {connectionError ? 'Connection Failed' : 'Connecting...'}
                </Text>

                {connectionError ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{connectionError}</Text>
                        <Pressable style={styles.retryButton} onPress={reconnect}>
                            <Text style={styles.retryButtonText}>RETRY CONNECTING</Text>
                        </Pressable>

                        {/* Cancel / Go Back Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.cancelButton,
                                pressed && styles.buttonPressed
                            ]}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelButtonText}>
                                CANCEL
                            </Text>
                        </Pressable>

                    </View>
                ) : (
                    <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
                )}
            </View>

            {/* Subtle Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Mobile Remote Controller</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '80%',
        alignItems: 'center',
    },
    loader: {
        marginBottom: 24,
        transform: [{ scale: 1.5 }],
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 1,
        marginBottom: 8,
    },
    roomIdText: {
        fontSize: 16,
        color: '#A0A0A0',
        marginBottom: 30,
    },
    code: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        fontSize: 18,
        letterSpacing: 2,
    },
    errorContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.3)',
        marginBottom: 20,
        width: '100%',
        maxWidth: 300,
    },
    errorText: {
        color: '#FF453A',
        marginBottom: 16,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '500',
    },
    retryButton: {
        backgroundColor: '#FF453A',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    cancelButton: {
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#333',
    },
    cancelButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
    },
    buttonPressed: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: '#555',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
    },
    footerText: {
        color: '#333',
        fontSize: 12,
        letterSpacing: 2,
        textTransform: 'uppercase',
        fontWeight: 'bold',
    }
});