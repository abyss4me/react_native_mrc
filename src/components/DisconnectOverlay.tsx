import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useConnection } from '../engine/NetworkContext';

const DisconnectOverlay: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
    const { isDisconnected, reconnect } = useConnection();

    if (!isDisconnected || hidden) {
        return null;
    }

    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                <Text style={styles.title}>Connection Lost</Text>
                <Text style={styles.message}>Attempting to reconnect...</Text>
                <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />
                <TouchableOpacity style={styles.button} onPress={reconnect}>
                    <Text style={styles.buttonText}>Reconnect</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000, // Ensure it's on top
    },
    container: {
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    message: {
        fontSize: 26,
        color: '#FFFFFF',
        marginBottom: 20,
    },
    spinner: {
        marginTop: 10,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default DisconnectOverlay;