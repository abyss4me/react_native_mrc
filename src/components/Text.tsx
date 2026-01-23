import React, { useState, useEffect } from 'react';
import * as Font from 'expo-font'; // Add Expo Font
import { Text, View } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';

const loadedDynamicFonts = new Set<string>();

export const TextComponent = ({ config, globalScale = 1, parentWidth, parentHeight }: any) => {
    const [isFontReady, setIsFontReady] = useState(false);
    const anchorStyle = getAnchorStyle(config, globalScale, parentWidth, parentHeight);
    
    // Parse font size (remove "px" if it's in the JSON)
    const rawFontSize = config.style?.fontSize ? parseInt(String(config.style.fontSize)) : 24;
    const fontSize = rawFontSize * globalScale;

    const fontFamily = config.style?.fontFamily;
    // Font URL from JSON (if any)
    const fontSrc = config.fontSrc;

    useEffect(() => {
        const loadFont = async () => {
            // 1. If it's a regular system font or local (loaded in App.tsx)
            // We just say "ready"
            if (!fontSrc) {
                setIsFontReady(true);
                return;
            }

            // 2. If the font has been loaded before during this session
            if (loadedDynamicFonts.has(fontFamily)) {
                setIsFontReady(true);
                return;
            }

            // 3. Load the font from URL
            try {
                console.log(`Loading font: ${fontFamily} from ${fontSrc}`);
                await Font.loadAsync({
                    [fontFamily]: { uri: fontSrc }
                });

                loadedDynamicFonts.add(fontFamily); // Add to cache
                setIsFontReady(true);
            } catch (e) {
                console.error("Failed to load font", e);
                // Even if it fails, set to true to show text with the default font
                setIsFontReady(true);
            }
        };

        loadFont();
    }, [fontFamily, fontSrc]);

    if (!isFontReady) return null;

    // Helper function to scale paddings/margins
    const getScaledValue = (val: any) => val ? (parseInt(val) * globalScale) : undefined;

    return (
        <View style={[
            anchorStyle,
            {
                position: 'absolute',
                width: getScaledValue(config.style?.width),
                height: getScaledValue(config.style?.height),
                padding: getScaledValue(config.style?.padding),
                // Flexbox to center text within the block
                justifyContent: config.style?.justifyContent || 'center', 
                alignItems: config.style?.alignItems || 'center',
                // opacity
                opacity: config.style?.opacity ?? 1,
            }
        ]}>
            <Text
                // numberOfLines={1} emulates whiteSpace: 'nowrap'
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                    color: config.style?.color || 'white',
                    fontSize: fontSize,
                    fontFamily: fontFamily, // Must be loaded in App.tsx
                    fontWeight: config.style?.fontWeight === 'bold' ? 'bold' : 'normal',
                    textAlign: config.style?.textAlign || 'center',
                    includeFontPadding: false, // Removes extra padding on Android
                }}
            >
                {config.content}
            </Text>
        </View>
    );
};