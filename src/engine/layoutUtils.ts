// src/engine/layoutUtils.ts
import { ViewStyle, Dimensions } from 'react-native';

interface LayoutConfig {
    position?: { x: number; y: number };
    size?: { w: number; h: number };
    anchor?: string;
    style?: Record<string, any>;
    [key: string]: any;
}

export const getAnchorStyle = (
    config: LayoutConfig,
    globalScale: number = 1,
    parentWidth?: number,
    parentHeight?: number
): ViewStyle => {
    const { anchor = 'top-left', position = { x: 0, y: 0 }, size, style: customStyle } = config;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const containerWidth = parentWidth ?? screenWidth;
    const containerHeight = parentHeight ?? screenHeight;

    // --- FIX: Get element size from different sources ---
    // If there is no size.w, check style.width
    const rawW = size?.w || (customStyle?.width ? parseInt(String(customStyle.width)) : 0);
    // If there is no size.h, use fontSize as the approximate height for text
    const rawH = size?.h || (customStyle?.height ? parseInt(String(customStyle.height)) : (customStyle?.fontSize ? parseInt(String(customStyle.fontSize)) : 0));

    const elementWidth = rawW * globalScale;
    const elementHeight = rawH * globalScale;

    const offsetX = (position?.x || 0) * globalScale;
    const offsetY = (position?.y || 0) * globalScale;

    const style: ViewStyle = { position: 'absolute' };

    switch (anchor) {
        case 'top-left':
            style.left = offsetX;
            style.top = offsetY;
            break;
        case 'top-center':
            style.left = (containerWidth - elementWidth) / 2 + offsetX;
            style.top = offsetY;
            break;
        case 'top-right':
            style.right = offsetX;
            style.top = offsetY;
            break;
        case 'left-center':
            style.left = offsetX;
            style.top = (containerHeight - elementHeight) / 2 + offsetY;
            break;
        case 'center':
            style.left = (containerWidth - elementWidth) / 2 + offsetX;
            style.top = (containerHeight - elementHeight) / 2 + offsetY;
            break;
        case 'right-center':
            style.right = offsetX;
            style.top = (containerHeight - elementHeight) / 2 + offsetY;
            break;
        case 'bottom-left':
            style.left = offsetX;
            style.bottom = offsetY;
            break;
        case 'bottom-center':
            style.left = (containerWidth - elementWidth) / 2 + offsetX;
            style.bottom = offsetY;
            break;
        case 'bottom-right':
            style.right = offsetX;
            style.bottom = offsetY;
            break;
        default:
            style.left = offsetX;
            style.top = offsetY;
    }

    return style;
};