// Base config for any element
export interface BaseElementConfig {
    type: "button" | "text" | "image" | "container" | "template" | "keyboard"; // Extend as needed
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number] /* and so on */;
    visible?: boolean;
    disabled?: boolean;
    style?: Record<string, any>; // Styles can be flexible
}

// Defines the visual overrides for a single button state
export interface ButtonStateConfig {
    texture?: string;
    scale?: number;
    style?: Record<string, any>;
}

// All possible named states a button can be in
export interface ButtonStates {
    normal?: ButtonStateConfig;
    pressed?: ButtonStateConfig;
    disabled?: ButtonStateConfig;
}

// Button config
export interface ButtonConfig extends BaseElementConfig {
    type: "button";
    id: string;
    action?: string;
    content?: string;
    texture?: string;
    disabled?: boolean;
    states?: ButtonStates;
    layout?: ElementConfig[]; // Recursion (children)
}

// Union type for all possible elements
export type ElementConfig = ButtonConfig | BaseElementConfig; // Add TextConfig, ImageConfig here

// Background can be a URL string, color string, or an object with a texture
export type BackgroundConfig = string | { texture: string };

// Templates map: key is the template name, value is any element config
export type TemplateMap = Record<string, ElementConfig>;

// Screen config
export interface ScreenConfig {
    background?: BackgroundConfig;
    layout: ElementConfig[];
}