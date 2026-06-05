import { ViewStyle } from 'react-native';
import { StyleMap } from "../types/LayoutTypes";
import { GameState } from '../types/ProtocolTypes';
import { BASE_DESIGN_WIDTH, BASE_DESIGN_HEIGHT } from '../constants';

interface LayoutConfig {
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    style?: object;
}

/**
 * Returns a rotation transform array when `rotation` is defined, otherwise an empty array.
 * Use spread into a transform array: `[...rotationTransform(config.rotation), { scale: 1 }]`
 */
export const rotationTransform = (
    rotation: number | undefined
): { rotate: string }[] =>
    rotation !== undefined ? [{ rotate: `${rotation}deg` }] : [];

/**
 * Conditionally computes anchor-based absolute positioning.
 * Returns an empty object when the config has neither `position` nor `anchor`,
 * allowing the component to participate in its parent's flex layout instead.
 */
export const resolveAnchorStyle = (
    config: LayoutConfig,
    globalScale: number = 1,
    parentWidth?: number,
    parentHeight?: number,
): ViewStyle => {
    if (!config.position && !config.anchor) return {};
    return getAnchorStyle(config, globalScale, parentWidth, parentHeight);
};

export const getAnchorStyle = (
    config: LayoutConfig,
    globalScale: number = 1,
    parentWidth?: number,
    parentHeight?: number
): ViewStyle => {

    const { anchor = [0, 0], style: _rawStyle } = config;
    const customStyle = _rawStyle as { width?: number | string; height?: number | string; fontSize?: number | string } | undefined;

    const [width, height] = config.size || [ 0, 0 ];
    const [x, y] = config.position || [ 0, 0 ];

    // Fallback to design-space dims if no specific parent dims provided.
    // parentWidth/parentHeight must come from useWindowDimensions() (via useUIScale) so
    // that the component re-renders reactively on Android window-mode resize events.
    const containerWidth = parentWidth !== undefined ? parentWidth : BASE_DESIGN_WIDTH;
    const containerHeight = parentHeight !== undefined ? parentHeight : BASE_DESIGN_HEIGHT;

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
const resolveAssetUrls = (baseUrl: string, elementConfig: Record<string, unknown>): Record<string, unknown> => {
    if (!baseUrl) return elementConfig;

    const resolved = { ...elementConfig };
    const urlFields = ['texture', 'src', 'indicatorTexture'];

    urlFields.forEach(field => {
        const val = resolved[field];
        if (val && typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
            resolved[field] = `${baseUrl}${val}`;
        }
    });

    // Also resolve inside states (button state textures)
    if (resolved.states && typeof resolved.states === 'object') {
        const resolvedStates: Record<string, unknown> = {};
        for (const [stateName, stateConfig] of Object.entries(resolved.states as Record<string, Record<string, unknown>>)) {
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
    elementConfig: Record<string, unknown>
): ResolvedConfig => {
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
    elementConfig: Record<string, unknown>,
    baseUrl: string = ''
): ResolvedConfig => {
    let resolved: ResolvedConfig = resolveStyleReference(styles, elementConfig);
    resolved = resolveAssetUrls(baseUrl, resolved) as ResolvedConfig;

    if (Array.isArray(resolved.layout)) {
        resolved = {
            ...resolved,
            layout: (resolved.layout as Record<string, unknown>[]).map(child =>
                resolveElementConfig(styles, child, baseUrl)
            ),
        };
    }

    return resolved;
};

/**
 * Applies a server patch array onto a state map (mutates a clone — call with a cloned object).
 * Patches shallow-merge object-type props so existing style fields aren't wiped.
 */
interface Patch {
    target?: { ids?: string[] };
    props?: Record<string, unknown>;
}

export const applyPatches = (
    components: Record<string, Record<string, unknown>>,
    patches: Patch[]
): Record<string, Record<string, unknown>> => {
    patches.forEach((patch) => {
        const { target, props } = patch;
        if (target?.ids && Array.isArray(target.ids) && props) {
            target.ids.forEach((id: string) => {
                components[id] = components[id] || {};
                Object.keys(props).forEach(key => {
                    const val = props[key];
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        components[id][key] = { ...(components[id][key] as object || {}), ...(val as object) };
                    } else {
                        components[id][key] = val;
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
    components: Record<string, Record<string, unknown>>,
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
/**
 * Loosely typed resolved config — fields come from JSON and may contain
 * any combination of known and unknown keys.
 */
export type ResolvedConfig = {
    style?: Record<string, unknown>;
    states?: Record<string, Record<string, unknown>>;
    layout?: ResolvedConfig[];
    [key: string]: unknown;
};

export const recursiveProcessConfig = (rawConfig: ResolvedConfig, serverData: GameState): ResolvedConfig => {
    const finalConfig: ResolvedConfig = { ...rawConfig };

    const id = finalConfig.id as string | undefined;
    if (id && serverData.state?.[id]) {
        const updates = serverData.state[id];
        const baseStyle = finalConfig.style;
        Object.assign(finalConfig, updates);
        if (baseStyle) {
            finalConfig.style = { ...baseStyle, ...(updates.style || {}) };
        }
    }

    if (Array.isArray(finalConfig.layout)) {
        finalConfig.layout = finalConfig.layout.map(child =>
            recursiveProcessConfig(child, serverData)
        );
    }

    return finalConfig;
};
