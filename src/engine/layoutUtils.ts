// src/engine/layoutUtils.ts
import { ViewStyle, Dimensions } from 'react-native';

interface LayoutConfig {
    pos?: { x: number; y: number };
    size?: { w: number; h: number };
    align?: string;
    style?: Record<string, any>;
    [key: string]: any;
}

export const getAnchorStyle = (
    config: LayoutConfig,
    globalScale: number = 1,
    parentWidth?: number,
    parentHeight?: number
): ViewStyle => {
    const { align = 'top-left', pos = { x: 0, y: 0 }, size, style: customStyle } = config;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const containerWidth = parentWidth ?? screenWidth;
    const containerHeight = parentHeight ?? screenHeight;

    // --- ФІКС: Отримуємо розмір елемента з різних джерел ---
    // Якщо немає size.w, перевіряємо style.width
    const rawW = size?.w || (customStyle?.width ? parseInt(String(customStyle.width)) : 0);
    // Якщо немає size.h, використовуємо fontSize як приблизну висоту для тексту
    const rawH = size?.h || (customStyle?.height ? parseInt(String(customStyle.height)) : (customStyle?.fontSize ? parseInt(String(customStyle.fontSize)) : 0));

    const elementWidth = rawW * globalScale;
    const elementHeight = rawH * globalScale;

    const offsetX = (pos?.x || 0) * globalScale;
    const offsetY = (pos?.y || 0) * globalScale;

    const style: ViewStyle = { position: 'absolute' };

    switch (align) {
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