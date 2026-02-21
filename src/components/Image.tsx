import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';

export const ImageComponent = ({ config, globalScale = 1, parentWidth, parentHeight }: any) => {
    const anchorStyle = getAnchorStyle(config, globalScale, parentWidth, parentHeight);
    const width = (config.size?.w || 100) * globalScale;
    const height = (config.size?.h || 100) * globalScale;

    // Determine the image source
    const source = config.src || config.texture;
    if (!source) return null;

    const imageSource = { uri: source };

    let finalScaleX: number = config.scaleX !== undefined ? config.scaleX : 1;
    let finalScaleY: number = config.scaleY !== undefined ? config.scaleY : 1;

    //if there is a global scale
    if (config.scale !== undefined) {
        finalScaleX *= config.scale;
        finalScaleY *= config.scale;
    }



    const transforms: any[] = [];
    // ===============================================
    if (finalScaleX !== 1 || finalScaleY !== 1) {
        // In React Native, it's not necessary to push {scaleX} and {scaleY} separately,
        // if both exist, it's better this way:
        transforms.push({ scaleX: finalScaleX });
        transforms.push({ scaleY: finalScaleY });
    }

    //rotation
    if (config.rotation !== undefined) {
        transforms.push({ rotate: `${config.rotation}deg` });
    }

    const finalImageStyle = [
        config.style, // Styles from JSON (borderRadius, opacity, etc.)
        {
            width: '100%', // Stretch to the entire container
            height: '100%',
            // Add transform if it exists
            transform: transforms.length > 0 ? transforms : undefined
        }
    ];

    return (
        <View style={[
            anchorStyle,
            {
                width,
                height,
                position: 'absolute',
                // In RN, borderRadius is applied to the container,
                // if we want to crop the image
                borderRadius: (config.style?.borderRadius ? parseInt(config.style.borderRadius) : 0) * globalScale,
                overflow: 'hidden',
                opacity: config.style?.opacity !== undefined ? config.style.opacity : 1
            }
        ]}>
            <Image
                source={imageSource}
                style={finalImageStyle}
                resizeMode={config.style?.objectFit === 'cover' ? 'cover' : 'contain'}
            />
        </View>
    );
};