import React, { useState, useEffect, useMemo } from 'react';
import { View, ImageBackground, StyleSheet, useWindowDimensions } from 'react-native';
import { ComponentMap } from '../components'; // Імпортуємо мапу компонентів
import { useNetwork } from './NetworkContext';

// Рекурсивна функція для ін'єкції даних
const recursiveProcessConfig = (rawConfig: any, serverData: any): any => {
    // 1. Клонуємо конфіг
    const finalConfig = { ...rawConfig };

    // 2. Мерджимо дані для цього ID
    if (finalConfig.id && serverData.components && serverData.components[finalConfig.id]) {
        const updates = serverData.components[finalConfig.id];
        Object.assign(finalConfig, updates);
    }

    // 3. Рекурсія для дітей
    if (finalConfig.layout && Array.isArray(finalConfig.layout)) {
        finalConfig.layout = finalConfig.layout.map((child: any) =>
            recursiveProcessConfig(child, serverData)
        );
    }

    return finalConfig;
};

interface ScreenRendererProps {
    screenConfig: any; // Тип ScreenConfig з ProtocolTypes
}

const ScreenRenderer: React.FC<ScreenRendererProps> = ({ screenConfig }) => {
    const { serverData, sendMessage } = useNetwork();
    console.log("🎨 RENDERER: Config received:", screenConfig); // <--- LOG 1

    // 1. Отримуємо розміри екрану телефону
    const { width, height } = useWindowDimensions();

    // 2. Розраховуємо Scale.
    // Припускаємо, що базовий дизайн намальований для ширини 1000px (або інше значення з твого макету)
    // Якщо телефон в landscape (ширина > висоти), беремо ширину як основу.
    const BASE_DESIGN_WIDTH = 900;
    const uiScale = width / BASE_DESIGN_WIDTH;

    // Якщо конфігу немає, нічого не рендеримо або показуємо лоадер
    if (!screenConfig) {
        return <View style={styles.container} />; // Чорний екран
    }

    const handleAction = (type: string, payload: any) => {
        // Прокидаємо події на сервер
        sendMessage(type, payload);
    };

    const renderElement = (el: any, index: number) => {
        // --- 1. Обробка даних (Мердж стану з сервера) ---
        const finalConfig = recursiveProcessConfig(el, serverData);

        // --- 2. Перевірка видимості ---
        if (finalConfig.visible === false) return null;

        // --- 3. Вибір компонента ---
        const Component = ComponentMap[finalConfig.type];
        if (!Component) {
            console.warn(`Unknown component type: ${finalConfig.type}`);
            return null;
        }

        // --- 4. Старі байндінги (сумісність) ---
        if (finalConfig.bindContent && serverData[finalConfig.bindContent] !== undefined) {
            finalConfig.content = serverData[finalConfig.bindContent];
        }

        return (
            <Component
                key={index}
                config={finalConfig}
                globalScale={uiScale}
                onInteract={handleAction}
            />
        );
    };

    // Обробка бекграунду. Якщо це URL з http - React Native зрозуміє.
    // Якщо це локальний шлях типу "/assets/bg.jpg" - це може не спрацювати в Native без змін.
    // Для початку припускаємо, що там повний URL.
    const bgSource = screenConfig.background
        ? { uri: screenConfig.background }
        : null;

    return (
        <View style={styles.container}>
            {bgSource ? (
                <ImageBackground
                    source={bgSource}
                    style={styles.background}
                    resizeMode="cover"
                >
                     {screenConfig.layout.map((el: any, i: number) => renderElement(el, i))}
                </ImageBackground>
            ) : (
                <View style={[styles.background, { backgroundColor: screenConfig.backgroundColor || '#000' }]}>
                     {screenConfig.layout.map((el: any, i: number) => renderElement(el, i))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    }
});

export default ScreenRenderer;