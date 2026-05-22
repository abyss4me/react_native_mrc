import React, { useEffect } from 'react';
import { Platform, BackHandler, Alert } from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { SCREEN } from '../constants';

interface AndroidBackHandlerProps {
    currentScreenId: string;
    setCurrentScreenId: (id: string) => void;
    setConfigUrl: (url: string | null) => void;
}

export default function AndroidBackHandler({ currentScreenId, setCurrentScreenId, setConfigUrl }: AndroidBackHandlerProps) {
    const { disconnect } = useNetwork();

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const onBackPress = () => {
            // 1. If in offline setup screens, safely go back to Home
            if (currentScreenId === SCREEN.TRANSITION) {
                setCurrentScreenId(SCREEN.HOME);
                setConfigUrl(null);
                return true;
            }

            // 2. If actively connected to a server/game (Control Screen)
            if (currentScreenId !== SCREEN.HOME) {
                Alert.alert(
                    "Disconnect",
                    "Are you sure you want to disconnect from the game?",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Disconnect",
                            style: "destructive",
                            onPress: () => {
                                disconnect();
                                setCurrentScreenId(SCREEN.HOME);
                                setConfigUrl(null);
                            }
                        }
                    ]
                );
                return true; // We handled it, don't exit app or jump instantly
            }

            // 3. If on HOME_SCREEN, return false to let Android natively exit/background the app
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => backHandler.remove();
    }, [currentScreenId, disconnect, setCurrentScreenId, setConfigUrl]);

    return null;
}

