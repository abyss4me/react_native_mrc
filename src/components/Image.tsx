import React from 'react';
import { Image, View, ImageStyle, ViewStyle } from 'react-native';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';

interface ImageComponentConfig {
    type: 'image';
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    rotation?: number;
    visible?: boolean;
    src?: string;
    texture?: string;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    style?: ImageStyle;
}

interface ImageComponentProps {
    config: ImageComponentConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
}

export const ImageComponent = ({ config, globalScale = 1, parentWidth, parentHeight }: ImageComponentProps) => {
    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const [w, h] = config.size || [100, 100];
    const width = w * globalScale;
    const height = h * globalScale;

    const source = config.src || config.texture;
    if (!source) return null;

    const imageSource = { uri: source };

    let finalScaleX: number = config.scaleX !== undefined ? config.scaleX : 1;
    let finalScaleY: number = config.scaleY !== undefined ? config.scaleY : 1;

    if (config.scale !== undefined) {
        finalScaleX *= config.scale;
        finalScaleY *= config.scale;
    }

    const transforms: ({ scaleX: number } | { scaleY: number } | { rotate: string })[] = [];
    if (finalScaleX !== 1 || finalScaleY !== 1) {
        transforms.push({ scaleX: finalScaleX });
        transforms.push({ scaleY: finalScaleY });
    }
    transforms.push(...rotationTransform(config.rotation));

    const imageStyle: ImageStyle = {
        ...config.style,
        width: '100%',
        height: '100%',
        ...(transforms.length > 0 ? { transform: transforms } : {}),
    };

    const rawBorderRadius = config.style?.borderRadius;
    const borderRadius = typeof rawBorderRadius === 'number'
        ? rawBorderRadius * globalScale
        : 0;

    const rawOpacity = config.style?.opacity;
    const opacity = typeof rawOpacity === 'number' ? rawOpacity : 1;

    const containerStyle: ViewStyle = {
        width,
        height,
        position: 'absolute',
        borderRadius,
        overflow: 'hidden',
        opacity,
    };

    return (
        <View style={[anchorStyle, containerStyle]}>
            <Image
                source={imageSource}
                style={imageStyle}
                resizeMode={config.style?.resizeMode ?? 'contain'}
            />
        </View>
    );
};