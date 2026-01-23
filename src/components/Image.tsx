import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';

export const ImageComponent = ({ config, globalScale = 1 }: any) => {
    const anchorStyle = getAnchorStyle(config, globalScale);
    const width = (config.size?.w || 100) * globalScale;
    const height = (config.size?.h || 100) * globalScale;

    // Визначаємо джерело картинки
    const source = config.src || config.texture;
    if (!source) return null;

    const imageSource = { uri: source };

    return (
        <View style={[
            anchorStyle, 
            { 
                width, 
                height, 
                position: 'absolute',
                // В RN borderRadius застосовується до контейнера,
                // якщо ми хочемо обрізати картинку
                borderRadius: (config.style?.borderRadius ? parseInt(config.style.borderRadius) : 0) * globalScale,
                overflow: 'hidden',
                opacity: config.style?.opacity !== undefined ? config.style.opacity : 1
            } 
        ]}>
            <Image
                source={imageSource}
                style={{ width: '100%', height: '100%' }}
                resizeMode={config.style?.objectFit === 'cover' ? 'cover' : 'contain'}
            />
        </View>
    );
};