// src/engine/LayoutUtils.ts
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

    // Fallback to screenDims if no specific parent dims provided
    // BUT we must use the active prop if defined, so React Native properly reflows component upon resize.
    const containerWidth = parentWidth !== undefined ? parentWidth : screenWidth;
    const containerHeight = parentHeight !== undefined ? parentHeight : screenHeight;

    const rawW = width || (customStyle?.width ? parseInt(String(customStyle.width)) : 0);
    const rawH = height || (customStyle?.height ? parseInt(String(customStyle.height)) : (customStyle?.fontSize ? parseInt(String(customStyle.fontSize)) : 0));

    const elementWidth = rawW * globalScale;
    const elementHeight = rawH * globalScale;

    const offsetX = (x || 0) * globalScale;
    const offsetY = (y || 0) * globalScale;

    const style: ViewStyle = { position: 'absolute' };

    const [anchorX, anchorY] = anchor;

    // --- Anchor + Position math ---
    // Generic formula: containerSize * anchorA - elemSize * anchorA + offset
    //   anchorX=0   → left edge,   offset moves right
    //   anchorX=0.5 → center,      offset moves right
    //   anchorX=1   → right edge,  offset moves LEFT (inward margin from right edge)
    //
    // Special case for anchorX/Y = 1: position is treated as inward margin,
    // so offset is subtracted (matches BACK_BUTTON pattern: anchor=[1,0] position=[20,20]).

    // --- Math for X axis ---
    if (anchorX >= 1) {
        // right edge: position acts as inward margin from the right
        style.left = containerWidth - elementWidth - offsetX;
    } else {
        // generic pivot formula works for anchor 0, 0.5, or any value in between
        style.left = containerWidth * anchorX - elementWidth * anchorX + offsetX;
    }

    // --- Math for Y axis ---
    if (anchorY >= 1) {
        // bottom edge: position acts as inward margin from the bottom
        style.top = containerHeight - elementHeight - offsetY;
    } else {
        // generic pivot formula
        style.top = containerHeight * anchorY - elementHeight * anchorY + offsetY;
    }

    return style;
};