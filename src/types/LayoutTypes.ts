// Базовий конфіг для будь-якого елемента
export interface BaseElementConfig {
    type: "button" | "text" | "image" | "container";
    id?: string;
    pos?: { x: number; y: number };
    size?: { w: number; h: number };
    align?: "center" | "top-left" | "top-right" /* і так далі */;
    visible?: boolean;
    style?: Record<string, any>; // Стилі можуть бути гнучкими
}

// Конфіг кнопки
export interface ButtonConfig extends BaseElementConfig {
    type: "button";
	id: string;
    action?: string;
    content?: string;
    texture?: string;
    textureFocused?: string;
    textureDisabled?: string;
    disabled?: boolean;
    layout?: ElementConfig[]; // Рекурсія (діти)
}

// Union тип для всіх можливих елементів
export type ElementConfig = ButtonConfig | BaseElementConfig; // Додай сюди TextConfig, ImageConfig

// Конфіг екрану
export interface ScreenConfig {
    background?: string;
    layout: ElementConfig[];
}