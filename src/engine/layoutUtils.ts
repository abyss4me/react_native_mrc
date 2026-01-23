import { ViewStyle } from 'react-native';

// Інтерфейс для вхідного конфіга (спрощений)
interface LayoutConfig {
    pos?: { x: number; y: number };
    align?: string;
    [key: string]: any;
}

export const getAnchorStyle = (config: LayoutConfig, scale: number = 1): ViewStyle => {
    const { align, pos } = config;
    const x = (pos?.x || 0) * scale;
    const y = (pos?.y || 0) * scale;

    const style: ViewStyle = { position: 'absolute' };

    switch (align) {
        case 'top-left':
            style.left = x;
            style.top = y;
            break;
        case 'top-right':
            style.right = x;
            style.top = y;
            break;
        case 'bottom-left':
            style.left = x;
            style.bottom = y;
            break;
        case 'bottom-right':
            style.right = x;
            style.bottom = y;
            break;
        case 'center':
            style.left = '50%';
            style.top = '50%';
            // У React Native центрування через transform робиться інакше, ніж у CSS.
            // Тут ми зміщуємо точку відліку, але саме зміщення контенту на -50%
            // краще робити через margin, якщо відомі розміри, або через alignSelf у батька.
            // Для абсолютної позиції найчастіше використовують такий хак або відомі розміри:
            style.marginLeft = x;
            style.marginTop = y;
            // style.transform = [{ translateX: -50% }] - RN не підтримує % у translate без танців з бубном.
            // Тому зазвичай для 'center' ми розраховуємо, що компонент сам відцентрує свій вміст,
            // або використовуємо negative margins у компоненті, якщо знаємо розмір.
            break;
        case 'top-center':
            style.left = '50%';
            style.top = y;
            style.marginLeft = x; 
            break;
        case 'bottom-center':
            style.left = '50%';
            style.bottom = y;
            style.marginLeft = x;
            break;
        case 'left-center':
            style.left = x;
            style.top = '50%';
            style.marginTop = y;
            break;
        case 'right-center':
            style.right = x;
            style.top = '50%';
            style.marginTop = y;
            break;
        default:
            // Default: top-left logic
            style.left = x;
            style.top = y;
    }

    return style;
};