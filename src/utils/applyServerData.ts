import { GameState } from '../types/ProtocolTypes';

/**
 * Merges server state into a child element config (shallow clone expected — mutates in place).
 *
 * Two injection paths:
 *  1. `serverData.state[id]` — structured component overrides (any field, style deep-merged).
 *  2. `serverData[id]`       — legacy scalar binding: text → ButtonConfig.text, image → ButtonConfig.texture.
 */
export const applyServerDataToChild = (
    childConfig: Record<string, unknown>,
    serverData: GameState,
): void => {
    const id = childConfig.id as string | undefined;
    if (!id) return;

    // Path 1: structured state overrides
    if (serverData?.state?.[id]) {
        const updates = serverData.state[id] as Record<string, unknown>;
        const baseStyle = childConfig.style;
        Object.assign(childConfig, updates);
        if (baseStyle) {
            childConfig.style = { ...(baseStyle as object), ...((updates.style as object) || {}) };
        }
    }

    // Path 2: legacy scalar binding
    const scalar = serverData?.[id];
    if (scalar !== undefined) {
        if (childConfig.type === 'text')  childConfig.text    = scalar;
        if (childConfig.type === 'image') childConfig.texture = scalar;
    }
};


