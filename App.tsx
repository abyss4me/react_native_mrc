import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

// Engine Imports
import { NetworkProvider } from './src/engine/NetworkContext';
import ScreenRenderer from './src/engine/ScreenRenderer';

// --- 1. CONFIGURATION & MOCK DATA ---
// Це ваші JSON макети. У майбутньому ви можете завантажувати їх через fetch()
// або імпортувати з файлу: import localLayouts from './src/layouts/main_layout.json';
import localLayouts from './assets/layouts/main_layout.json';

// Запобігаємо автоматичному прихованню сплеш-скріну

SplashScreen.preventAutoHideAsync();

export default function App() {
    // 1. Стан навігації
    const [currentScreenId, setCurrentScreenId] = useState<string>("CONNECT_SCREEN");
    
    // 2. Завантаження шрифтів
    const [fontsLoaded] = useFonts({
        // Переконайся, що файл лежить в папці ./assets/fonts/
        'LibreFranklinBold': require('./assets/fonts/libre_franklin_bold.ttf'),
    });

    // 3. Блокування орієнтації (Landscape)
    useEffect(() => {
        async function lockOrientation() {
            try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            } catch (error) {
                console.warn("Orientation lock failed (might happen in Expo Go on some devices):", error);
            }
        }
        lockOrientation();
    }, []);

    // 4. Обробка готовності View (хованная сплеш-скріну) TODO:
    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    // Поки шрифти не завантажились - повертаємо null (сплеш ще висить)
    if (!fontsLoaded) {
        return null;
    }

    // 5. Вибір конфігурації екрану
    // Fallback на CONNECT_SCREEN якщо прийшов невідомий ID
    const currentConfig = (localLayouts as any).screens[currentScreenId] || (localLayouts as any)["CONNECT_SCREEN"];
    console.log("=============>", localLayouts)
    return (
        <View style={styles.container} onLayout={onLayoutRootView}>
            {/* Ховаємо статусбар для повного занурення */}
            <StatusBar hidden translucent backgroundColor="transparent" />

            <NetworkProvider onScreenChange={setCurrentScreenId}>
                <ScreenRenderer screenConfig={currentConfig} />
            </NetworkProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black', // Колір підкладки
    },
});
//registerRootComponent(App);