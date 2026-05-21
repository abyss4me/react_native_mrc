import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { ENGINE_VERSION } from '../utils/constants';

interface HomeScreenProps {
    // No props needed for this simplified view
    isConfigLoadingError: boolean
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ isConfigLoadingError }) => {
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>MOBILE CONTROLLER</Text>
                    {isConfigLoadingError
                        ? <Text style={styles.subtitleError}>{'This controller layout requires a newer version of the app.\nPlease update it via your app store to continue.'}</Text>
                        : <Text style={styles.subtitle}>{'Open your camera and scan the QR code on the TV'}</Text>
                    }
                </View>
            </View>

            {/* app version footer */}
            <Text style={styles.versionText}>v{ENGINE_VERSION}</Text>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A', // Very dark background
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: '15%', // To prevent it from being too stretched out on landscape
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
    },
    subtitleError: {
        fontSize: 16,
        color: '#FF0000',
        fontWeight: '500',
    },
    versionText: {
        position: 'absolute',
        bottom: 15,
        right: 20,
        color: '#555',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});