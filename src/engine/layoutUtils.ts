// src/engine/layoutUtils.ts
import { ViewStyle, Dimensions } from 'react-native';

interface LayoutConfig {
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    style?: Record<string, any>;
    [key: string]: any;
}

export const getAnchorStyle = (
    config: LayoutConfig,
    globalScale: number = 1,
    parentWidth?: number,
    parentHeight?: number
): ViewStyle => {

    const { anchor = [0, 0], style: customStyle } = config;

    const [width, height] = config.size || [ 0, 0 ];
    const [x, y] = config.position || [ 0, 0 ];

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const containerWidth = parentWidth ?? screenWidth;
    const containerHeight = parentHeight ?? screenHeight;

    const rawW = width || (customStyle?.width ? parseInt(String(customStyle.width)) : 0);
    const rawH = height || (customStyle?.height ? parseInt(String(customStyle.height)) : (customStyle?.fontSize ? parseInt(String(customStyle.fontSize)) : 0));

    const elementWidth = rawW * globalScale;
    const elementHeight = rawH * globalScale;

    const offsetX = (x || 0) * globalScale;
    const offsetY = (y || 0) * globalScale;

    const style: ViewStyle = { position: 'absolute' };

    const [anchorX, anchorY] = anchor;

    // --- Math for X axis---
    if (anchorX === 0.5) {
        // center X
        style.left = (containerWidth - elementWidth) / 2 + offsetX;
    } else if (anchorX > 0.5) {
        // top right edge (1.0)
        style.right = offsetX;
    } else {
        // left edge (0.0)
        style.left = offsetX;
    }

    // --- Math for Y axis ---
    if (anchorY === 0.5) {
        // center Y
        style.top = (containerHeight - elementHeight) / 2 + offsetY;
    } else if (anchorY > 0.5) {
        // Bottom edge (1.0)
        style.bottom = offsetY;
    } else {
        // Top edge (0.0)
        style.top = offsetY;
    }

    return style;
};