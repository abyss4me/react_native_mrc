import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ImageStyle
} from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './index'; // Імпорт мапи компонентів для рекурсії

// --- Типи (Можна винести в types/LayoutTypes.ts) ---
interface ButtonConfig {
    type: "button";
    id?: string;
    action?: string;
    content?: string;
    disabled?: boolean;
    visible?: boolean;

    // Текстури
    texture?: string;
    textureFocused?: string;
    textureDisabled?: string;

    // Розміщення
    pos?: { x: number; y: number };
    size?: { w: number; h: number };
    rotate?: number;
    align?: string;

    // Стилі
    style?: Record<string, any>;

    // Вкладені елементи
    layout?: any[];
}

interface ButtonProps {
    config: ButtonConfig;
    globalScale?: number;
    onInteract?: (type: string, payload: any) => void;
}

export const Button: React.FC<ButtonProps> = ({ config, globalScale = 1, onInteract }) => {
    const { serverData } = useNetwork();
    const [isPressed, setIsPressed] = useState(false);

    // 1. Перевірка стану (Disabled)
    // Сервер може надіслати disabled через serverData або це може бути в початковому config
    const isDisabled = config.disabled === true;

    // 2. Розрахунок розмірів
    const width = (config.size?.w || 100) * globalScale;
    const height = (config.size?.h || 100) * globalScale;

    // 3. Вибір текстури
    const currentTexture = (isDisabled && config.textureDisabled)
        ? config.textureDisabled
        : (isPressed && config.textureFocused ? config.textureFocused : config.texture);

    // 4. Позиціювання
    const isAbsolute = !!config.pos || !!config.align;
    const anchorStyle = isAbsolute ? getAnchorStyle(config, globalScale) : {};

    // 5. Трансформації (React Native використовує масив об'єктів)
    const transformStyles = [
        { rotate: `${config.rotate || 0}deg` },
        { scale: isPressed ? 0.95 : 1 } // Легке зменшення при натисканні
    ];

    // --- Обробники подій ---
    const handlePressIn = () => {
        if (isDisabled) return;
        setIsPressed(true);
        // Емуляція натискання клавіші (якщо немає action)
        if (!config.action && onInteract && config.id) {
            onInteract("keyDown", { keyCode: config.id });
        }
    };

    const handlePressOut = () => {
        if (isDisabled) return;
        setIsPressed(false);
        // Емуляція відпускання клавіші
        if (!config.action && onInteract && config.id) {
            onInteract("keyUp", { keyCode: config.id });
        }
    };

    const handlePress = () => {
        if (isDisabled) return;
        // Виконання дії (якщо є action)
        if (config.action && onInteract) {
            onInteract("action", { action: config.action });
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={1} // Вимикаємо стандартне мигання, бо у нас своя анімація scale/texture
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={isDisabled}
            style={[
                anchorStyle as ViewStyle, // casting для TS
                {
                    width,
                    height,
                    position: isAbsolute ? 'absolute' : 'relative',
                    opacity: (isDisabled && !config.textureDisabled) ? 0.5 : 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: transformStyles,
                    // Додаємо кастомні стилі з JSON, якщо вони сумісні з RN
                    ...(config.style as ViewStyle)
                }
            ]}
        >
            {/* A. Фон-картинка (аналог backgroundImage) */}
            {currentTexture && (
                <Image
                    source={{ uri: currentTexture }}
                    style={StyleSheet.absoluteFill} // Розтягує на весь розмір кнопки
                    resizeMode="stretch" // Або 'contain', залежно від дизайну
                />
            )}

            {/* B. Простий текст (якщо немає layout) */}
            {!config.layout && config.content && (
                <Text style={{
                    color: config.style?.color || 'white',
                    fontSize: config.style?.fontSize ? (parseInt(config.style.fontSize) * globalScale) : (20 * globalScale),
                    fontWeight: 'bold',
                    fontFamily: 'LibreFranklinBold', // Переконайся, що шрифт завантажено в App.tsx
                    textAlign: 'center',
                    // Тінь тексту в RN
                    textShadowColor: 'rgba(0, 0, 0, 0.8)',
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 2,
                    // Компенсація повороту контейнера, щоб текст був рівним (опціонально)
                    transform: [{ rotate: `-${config.rotate || 0}deg` }]
                }}>
                    {config.content}
                </Text>
            )}

            {/* C. Вкладені елементи (Recursion) */}
            {config.layout && config.layout.map((el: any, i: number) => {
                // 1. Перевірка видимості
                if (el.visible === false) return null;

                // 2. Отримання компонента
                const Component = ComponentMap[el.type];
                if (!Component) return null;

                const childConfig = { ...el };

                // 3. Ін'єкція даних з сервера (Data Binding)
                // Якщо сервер надіслав оновлення для цього ID
                if (serverData?.components?.[childConfig.id]) {
                    Object.assign(childConfig, serverData.components[childConfig.id]);
                }

                // 4. Fallback для старої логіки (прості значення)
                if (serverData && childConfig.id && serverData[childConfig.id] !== undefined) {
                     if (childConfig.type === 'text') childConfig.content = serverData[childConfig.id];
                     if (childConfig.type === 'image') childConfig.src = serverData[childConfig.id];
                }

                return (
                    <Component
                        key={i}
                        config={childConfig}
                        globalScale={globalScale}
                        onInteract={onInteract}
                    />
                );
            })}
        </TouchableOpacity>
    );
};