import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

interface LoadingIndicatorProps {
    isLoadingConfig: boolean;
}

export default function LoadingIndicator({ isLoadingConfig }: LoadingIndicatorProps) {
    return (
        <View style={[styles.container, styles.centered]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>
                {isLoadingConfig ? 'Loading Configuration...' : 'Preparing...'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: 'white',
        fontSize: 16,
    },
});

