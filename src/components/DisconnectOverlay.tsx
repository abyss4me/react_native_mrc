import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNetwork } from '../engine/NetworkContext';

const DisconnectOverlay: React.FC = () => {
    const { isDisconnected } = useNetwork();

    if (!isDisconnected) {
        return null;
    }

    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                <Text style={styles.title}>Connection Lost</Text>
                <Text style={styles.message}>Attempting to reconnect...</Text>
                <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />
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
    },
});

export default DisconnectOverlay;