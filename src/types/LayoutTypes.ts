// Base config for any element
export interface BaseElementConfig {
    type: "button" | "text" | "image" | "container";
    id?: string;
    pos?: { x: number; y: number };
    size?: { w: number; h: number };
    align?: "center" | "top-left" | "top-right" /* and so on */;
    visible?: boolean;
    style?: Record<string, any>; // Styles can be flexible
}

// Button config
export interface ButtonConfig extends BaseElementConfig {
    type: "button";
	id: string;
    action?: string;
    content?: string;
    texture?: string;
    textureFocused?: string;
    textureDisabled?: string;
    disabled?: boolean;
    layout?: ElementConfig[]; // Recursion (children)
}

// Union type for all possible elements
export type ElementConfig = ButtonConfig | BaseElementConfig; // Add TextConfig, ImageConfig here

// Screen config
export interface ScreenConfig {
    background?: string;
    layout: ElementConfig[];
}