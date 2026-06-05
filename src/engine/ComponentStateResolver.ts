/**
 * ComponentStateResolver.ts
 *
 * Pure functions for merging server messages into local component state.
 * No React, no side effects — fully testable in isolation.
 *
 * Responsibilities:
 *  - Apply JSON patches to component map
 *  - Merge server component overrides with layout base styles
 *  - Resolve asset URLs
 */

import { GameState, ComponentState, PatchStateMessage } from '../types/ProtocolTypes';
import { LayoutConfig, ElementConfig } from '../types/LayoutTypes';
import { resolveStyleReference, applyPatches, resolveComponentAssets } from './LayoutUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolverContext {
    /** Pre-built flat lookup: componentId → layout component config. */
    layoutComponentsById: Record<string, ElementConfig>;
    /** Full layouts object (used for style reference resolution). */
    layouts: LayoutConfig | undefined;
    /** Base URL prepended to relative asset paths. */
    baseUrl: string;
}

// ─── Style Helper ─────────────────────────────────────────────────────────────

export const resolveLayoutStyle = (
    rawStyle: Record<string, unknown> | string | undefined,
    layouts: LayoutConfig | undefined,
): Record<string, unknown> => {
    if (!rawStyle) return {};
    if (layouts?.theme?.styles && typeof rawStyle === 'string') {
        const result = resolveStyleReference(layouts.theme.styles, { style: rawStyle });
        return (result.style as Record<string, unknown>) ?? {};
    }
    return typeof rawStyle === 'object' ? rawStyle as Record<string, unknown> : {};
};

// ─── LOAD_SCREEN resolver ─────────────────────────────────────────────────────

type LoadScreenData = {
    screenId?: string;
    state?: Record<string, ComponentState>;
    patches?: { target?: { ids?: string[] }; props?: Record<string, unknown> }[];
    [key: string]: unknown;
};

export const resolveSetScreen = (
    data: LoadScreenData,
    ctx: ResolverContext,
): { screenId: string | undefined; state: GameState } => {
    const { screenId, ...restOfData } = data;
    const clonedData = JSON.parse(JSON.stringify(restOfData));

    // Apply patches
    if (data.patches && Array.isArray(data.patches)) {
        clonedData.state = clonedData.state || {};
        applyPatches(clonedData.state, data.patches);
    }

    // Guard: state must be a plain object
    const hasState = data.state && typeof data.state === 'object' && !Array.isArray(data.state);

    // Merge server component overrides with layout base styles
    if (hasState) {
        for (const componentId in data.state) {
            const incomingComponent = data.state[componentId];
            if (incomingComponent?.style) {
                const layoutComponent = ctx.layoutComponentsById[componentId];
                const resolvedBase = resolveLayoutStyle(layoutComponent?.style as Record<string, unknown> | undefined, ctx.layouts);
                clonedData.state[componentId] = clonedData.state[componentId] || {};
                clonedData.state[componentId].style = { ...resolvedBase, ...incomingComponent.style };
            }
        }
    }

    // Resolve asset URLs
    if (clonedData.state) {
        resolveComponentAssets(clonedData.state, ctx.baseUrl);
    }

    return { screenId, state: clonedData as GameState };
};

// ─── PATCH_STATE resolver ─────────────────────────────────────────────────────

/**
 * Processes a PATCH_STATE message payload against the previous state.
 * Returns the next GameState; does NOT mutate prev.
 */
export const resolveUpdateComponents = (
    data: PatchStateMessage['data'],
    prev: GameState,
    ctx: ResolverContext,
): GameState => {
    const hasPatch = data.patches && Array.isArray(data.patches) && data.patches.length > 0;

    // Fast path: shallow copy. Slow path (patches): full deep clone.
    const updatedState: Record<string, ComponentState> = hasPatch
        ? JSON.parse(JSON.stringify(prev.state || {}))
        : { ...(prev.state || {}) };

    if (hasPatch) {
        applyPatches(updatedState, data.patches);
    }

    // Guard: state must be a plain object
    const hasState = data.state && typeof data.state === 'object' && !Array.isArray(data.state);

    if (hasState) {
        for (const componentId in data.state) {
            const incomingComponent = data.state[componentId];
            const layoutComponent = ctx.layoutComponentsById[componentId];
            const prevComponent = prev.state?.[componentId] || {};
            const patchedComponent = hasPatch ? (updatedState[componentId] || {}) : {};

            const resolvedBaseStyle = resolveLayoutStyle(layoutComponent?.style as Record<string, unknown> | undefined, ctx.layouts);

            const { text: _layoutText, ...layoutComponentBase } = (layoutComponent as (ElementConfig & { text?: unknown }) | undefined) ?? {};
            updatedState[componentId] = {
                ...layoutComponentBase,
                ...prevComponent,
                ...patchedComponent,
                ...incomingComponent,
                style: {
                    ...resolvedBaseStyle,
                    ...(prevComponent.style || {}),
                    ...(incomingComponent.style || {}),
                } as ComponentState['style'],
            };
        }
    }

    const stateToResolve = hasPatch
        ? updatedState
        : Object.fromEntries(
            Object.keys(hasState ? data.state : {}).map(id => [id, updatedState[id]])
          );
    resolveComponentAssets(stateToResolve, ctx.baseUrl);

    return { ...prev, ...data, state: updatedState };
};
