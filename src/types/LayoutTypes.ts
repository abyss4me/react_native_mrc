import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

// A flexible style object that covers View, Text and Image style properties — used on typed component configs
export type AnyStyle = ViewStyle & TextStyle & ImageStyle;

// Style values coming from JSON — intentionally loose since fontWeight etc. arrive as plain strings
export type StyleValue = Record<string, unknown>;

// Named style presets — reusable style blocks referenced by key across elements
export type StyleMap = Record<string, StyleValue>;

// Base config for any element
export interface BaseElementConfig {
    type: "button" | "text" | "image" | "container" | "template" | "keyboard" | "touchpad" | "progressbar" | "joystick" | "dpad"; // Extend as needed
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number] /* and so on */;
    visible?: boolean;
    disabled?: boolean;
    style?: AnyStyle; // Styles can be flexible
}

// Defines the visual overrides for a single button state
export interface ButtonStateConfig {
    texture?: string;
    scale?: number;
    style?: AnyStyle;
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
    id?: string;
    action?: string;
    text?: string;
    texture?: string;
    disabled?: boolean;
    states?: ButtonStates;
    layout?: ElementConfig[]; // Recursion (children)
}

// DPad config
export interface DpadConfig extends BaseElementConfig {
    type: "dpad";
    buttonSize: [number, number];
    radius?: number;
    haptic?: "light" | "medium" | "heavy";
    hitbox?: number;
    autoRepeat?: boolean;
    repeatInterval?: number;
    texture?: string;
    states?: ButtonStates;
    text?: { up?: string; down?: string; left?: string; right?: string };
    style?: AnyStyle;
    keyCodes?: { up?: string; down?: string; left?: string; right?: string };
}

// Union type for all possible elements
export type ElementConfig = ButtonConfig | DpadConfig | BaseElementConfig; // Add TextConfig, ImageConfig here

// Background can be a URL string, color string, or an object with a texture
export type BackgroundConfig = string | { texture: string };



// Templates map: key is the template name, value is any element config
export type TemplateMap = Record<string, ElementConfig>;

// Per-orientation layout map used in "auto" mode
export type OrientationLayouts = {
    landscape?: ElementConfig[];
    portrait?: ElementConfig[];
};

// Screen config
// - `layout`  → legacy / locked-orientation: a single array of elements
// - `layouts` → auto mode: separate arrays per orientation (landscape / portrait)
export interface ScreenConfig {
    background?: BackgroundConfig;
    layout?: ElementConfig[];
    layouts?: OrientationLayouts;
}

// Global settings block from config.json
export interface LayoutSettings {
    orientation?: 'landscape' | 'portrait' | 'auto';
    keepAwake?: boolean;
    useSafeArea?: boolean;
    assetsBaseUrl?: string;
    defaultCooldown?: number; // ms — global button cooldown, overridable per button
    lockSafetyTimeout?: number; // ms — auto-unlock timeout if LOAD_SCREEN never arrives (default: 5000)
}

// Theme block: visual design tokens
export interface ThemeConfig {
    fonts?: Record<string, string>;
    background?: BackgroundConfig;
    styles?: StyleMap;
}

// Root config.json structure
export interface LayoutConfig {
    minClientVersion?: string;
    initialScreen?: string;
    settings?: LayoutSettings;
    theme?: ThemeConfig;
    templates?: TemplateMap;
    screens?: Record<string, ScreenConfig>;
}
