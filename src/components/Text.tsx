import React from 'react';
import { Text, View, ViewStyle, TextStyle, DimensionValue } from 'react-native';
import { resolveAnchorStyle } from '../engine/LayoutUtils';

interface TextComponentConfig {
    type: 'text';
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    visible?: boolean;
    text?: string | number;
    style?: TextStyle;
}

interface TextComponentProps {
    config: TextComponentConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
}

export const TextComponent = ({ config, globalScale = 1, parentWidth, parentHeight }: TextComponentProps) => {

    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const rawFontSize = config.style?.fontSize ? parseInt(String(config.style.fontSize)) : 22;
    const fontSize = rawFontSize * globalScale;

    const getScaledValue = (val: string | number | undefined): DimensionValue => {
        if (val === undefined) return undefined;
        if (typeof val === 'string' && val.endsWith('%')) return val as DimensionValue;
        return parseInt(String(val)) * globalScale;
    };

    const containerStyle: ViewStyle = {
        position: 'absolute',
        width: getScaledValue(config.style?.width as string | number | undefined),
        height: getScaledValue(config.style?.height as string | number | undefined),
        padding: getScaledValue(config.style?.padding as string | number | undefined),
        justifyContent: (config.style?.justifyContent as ViewStyle['justifyContent']) ?? 'center',
        alignItems: (config.style?.alignItems as ViewStyle['alignItems']) ?? 'center',
        opacity: typeof config.style?.opacity === 'number' ? config.style.opacity : 1,
    };

    return (
        <View style={[anchorStyle, containerStyle]}>
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                    ...config.style,
                    fontSize,
                    includeFontPadding: false,
                }}
            >
                {config.text}
            </Text>
        </View>
    );
};