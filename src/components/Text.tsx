import React, { useState, useEffect } from 'react';
import * as Font from 'expo-font'; // Add Expo Font
import { Text, View } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';


export const TextComponent = ({ config, globalScale = 1, parentWidth, parentHeight }: any) => {

    const anchorStyle = getAnchorStyle(config, globalScale, parentWidth, parentHeight);
    
    // Parse font size (remove "px" if it's in the JSON)
    const rawFontSize = config.style?.fontSize ? parseInt(String(config.style.fontSize)) : 24;
    const fontSize = rawFontSize * globalScale;

    const fontFamily = config.style?.fontFamily || 'Arial';
    // Font URL from JSON (if any)


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
                    includeFontPadding: false, // Removes extra padding on Android,
                    ...config.style,
                }}
            >
                {config.content}
            </Text>
        </View>
    );
};