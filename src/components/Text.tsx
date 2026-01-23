import React, { useState, useEffect } from 'react';
import * as Font from 'expo-font'; // Додаємо Expo Font
import { Text, View } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';

const loadedDynamicFonts = new Set<string>();

export const TextComponent = ({ config, globalScale = 1 }: any) => {
    const [isFontReady, setIsFontReady] = useState(false);
    const anchorStyle = getAnchorStyle(config, globalScale);
    
    // Парсимо розмір шрифту (прибираємо "px" якщо він там є в JSON)
    const rawFontSize = config.style?.fontSize ? parseInt(String(config.style.fontSize)) : 24;
    const fontSize = rawFontSize * globalScale;

    const fontFamily = config.style?.fontFamily;
    // URL шрифту з JSON (якщо є)
    const fontSrc = config.fontSrc;

    useEffect(() => {
        const loadFont = async () => {
            // 1. Якщо це звичайний системний шрифт або локальний (завантажений в App.tsx)
            // Ми просто кажемо "готово"
            if (!fontSrc) {
                setIsFontReady(true);
                return;
            }

            // 2. Якщо шрифт вже завантажували раніше під час цієї сесії
            if (loadedDynamicFonts.has(fontFamily)) {
                setIsFontReady(true);
                return;
            }

            // 3. Завантажуємо шрифт з URL
            try {
                console.log(`Loading font: ${fontFamily} from ${fontSrc}`);
                await Font.loadAsync({
                    [fontFamily]: { uri: fontSrc }
                });

                loadedDynamicFonts.add(fontFamily); // Додаємо в кеш
                setIsFontReady(true);
            } catch (e) {
                console.error("Failed to load font", e);
                // Навіть якщо впало, ставимо true, щоб показати текст дефолтним шрифтом
                setIsFontReady(true);
            }
        };

        loadFont();
    }, [fontFamily, fontSrc]);

    if (!isFontReady) return null;

    // Допоміжна функція для скейлу відступів
    const getScaledValue = (val: any) => val ? (parseInt(val) * globalScale) : undefined;

    return (
        <View style={[
            anchorStyle,
            {
                position: 'absolute',
                width: getScaledValue(config.style?.width),
                height: getScaledValue(config.style?.height),
                padding: getScaledValue(config.style?.padding),
                // Flexbox для центрування тексту всередині блоку
                justifyContent: config.style?.justifyContent || 'center', 
                alignItems: config.style?.alignItems || 'center',
                // opacity
                opacity: config.style?.opacity ?? 1,
            }
        ]}>
            <Text
                // numberOfLines={1} емулює whiteSpace: 'nowrap'
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                    color: config.style?.color || 'white',
                    fontSize: fontSize,
                    fontFamily: fontFamily, // Має бути завантажений в App.tsx
                    fontWeight: config.style?.fontWeight === 'bold' ? 'bold' : 'normal',
                    textAlign: config.style?.textAlign || 'center',
                    includeFontPadding: false, // Прибирає зайві відступи Android
                }}
            >
                {config.content}
            </Text>
        </View>
    );
};