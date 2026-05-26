// src/engine/LayoutUtils.ts
import { ViewStyle, Dimensions } from 'react-native';
import {StyleMap} from "../types/LayoutTypes";

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

/**
 * Prepends assetsBaseUrl to any relative texture/src URLs found on an element config.
 * Only modifies URLs that don't already start with http/https.
 */
const resolveAssetUrls = (baseUrl: string, elementConfig: Record<string, any>): Record<string, any> => {
    if (!baseUrl) return elementConfig;

    const resolved = { ...elementConfig };
    const urlFields = ['texture', 'src'];

    urlFields.forEach(field => {
        const val = resolved[field];
        if (val && typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
            resolved[field] = `${baseUrl}${val}`;
        }
    });

    // Also resolve inside states (button state textures)
    if (resolved.states && typeof resolved.states === 'object') {
        const resolvedStates: Record<string, any> = {};
        for (const [stateName, stateConfig] of Object.entries(resolved.states as Record<string, any>)) {
            if (stateConfig?.texture && typeof stateConfig.texture === 'string'
                && !stateConfig.texture.startsWith('http://') && !stateConfig.texture.startsWith('https://')) {
                resolvedStates[stateName] = { ...stateConfig, texture: `${baseUrl}${stateConfig.texture}` };
            } else {
                resolvedStates[stateName] = stateConfig;
            }
        }
        resolved.states = resolvedStates;
    }

    return resolved;
};

/**
 * Resolves the "style" field of an element config:
 * - If style is a "@styles.X" string reference → expands it from the styles map.
 * Returns a new element config with the resolved style — other fields are preserved.
 */
export const resolveStyleReference = (
    styles: StyleMap,
    elementConfig: Record<string, any>
): Record<string, any> => {
    const { style } = elementConfig;

    // Only act if style is a @styles.X string reference
    if (typeof style !== 'string' || !style.startsWith('@styles.')) {
        return elementConfig; // Nothing to resolve — return as-is, no mutation
    }

    const styleKey = style.replace('@styles.', '');
    const preset = styles[styleKey];
    if (preset) {
        return { ...elementConfig, style: { ...preset } };
    }

    console.warn(`Style reference "${styleKey}" not found in styles map.`);
    return { ...elementConfig, style: {} };
};

/**
 * Fully resolves an element config — handles style references and asset URL prepending.
 * Should be called from ScreenRenderer (per element) and from the network patch resolver.
 */
export const resolveElementConfig = (
    styles: StyleMap,
    elementConfig: Record<string, any>,
    baseUrl: string = ''
): Record<string, any> => {
    let resolved = resolveStyleReference(styles, elementConfig);
    resolved = resolveAssetUrls(baseUrl, resolved);

    // Recursively resolve children (e.g. container layout or button layout)
    if (Array.isArray(resolved.layout)) {
        resolved = {
            ...resolved,
            layout: resolved.layout.map((child: Record<string, any>) =>
                resolveElementConfig(styles, child, baseUrl)
            ),
        };
    }

    return resolved;
};

/**
 * Applies a server patch array onto a components map (mutates a clone — call with a cloned object).
 * Patches shallow-merge object-type props so existing style fields aren't wiped.
 */
export const applyPatches = (
    components: Record<string, any>,
    patches: any[]
): Record<string, any> => {
    patches.forEach((patch: any) => {
        const { target, props } = patch;
        if (target?.ids && Array.isArray(target.ids) && props) {
            target.ids.forEach((id: string) => {
                components[id] = components[id] || {};
                Object.keys(props).forEach(key => {
                    if (typeof props[key] === 'object' && props[key] !== null && !Array.isArray(props[key])) {
                        components[id][key] = { ...(components[id][key] || {}), ...props[key] };
                    } else {
                        components[id][key] = props[key];
                    }
                });
            });
        }
    });
    return components;
};

/**
 * Prepends assetsBaseUrl to relative texture/src fields on every component in the map.
 * Mutates in place — call after cloning.
 */
export const resolveComponentAssets = (
    components: Record<string, any>,
    baseUrl: string
): void => {
    if (!baseUrl) return;
    const fields = ['texture', 'src'];
    Object.values(components).forEach(comp => {
        fields.forEach(field => {
            const val = comp[field];
            if (val && typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
                comp[field] = `${baseUrl}${val}`;
            }
        });
    });
};

/**
 * Recursively merges server state data into an element config tree.
 * Server data can override any field; styles are deep-merged (template base + server override).
 */
export const recursiveProcessConfig = (rawConfig: any, serverData: any): any => {
    const finalConfig = { ...rawConfig };

    if (finalConfig.id && serverData.components && serverData.components[finalConfig.id]) {
        const updates = serverData.components[finalConfig.id];
        const baseStyle = finalConfig.style;
        Object.assign(finalConfig, updates);
        if (baseStyle) {
            finalConfig.style = { ...baseStyle, ...(updates.style || {}) };
        }
    }

    if (finalConfig.layout && Array.isArray(finalConfig.layout)) {
        finalConfig.layout = finalConfig.layout.map((child: any) =>
            recursiveProcessConfig(child, serverData)
        );
    }

    return finalConfig;
};
