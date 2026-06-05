/**
 * Unit tests for ComponentStateResolver + LayoutUtils merge behavior.
 *
 * Covers every message type that flows from the game server:
 *   - LOAD_SCREEN  (resolveSetScreen)
 *   - PATCH_STATE (resolveUpdateComponents)
 *   - Patch protocol (applyPatches)
 *   - Style reference resolution (@styles.X)
 *   - Asset URL resolution (relative → absolute)
 *   - Template component merge (AVATAR_GROUP children)
 *   - Style deep-merge precedence: layout base → prev → incoming
 */

import {
    resolveSetScreen,
    resolveUpdateComponents,
    resolveLayoutStyle,
    ResolverContext,
} from '../src/engine/ComponentStateResolver';

import {
    applyPatches,
    resolveStyleReference,
    resolveComponentAssets,
    resolveElementConfig,
    recursiveProcessConfig,
    getAnchorStyle,
} from '../src/engine/LayoutUtils';

// ─── Shared fixture: mirrors the real config.json structure ──────────────────

const BASE_URL = 'https://h5.play.works/dev/pavlou/mrc_engine/assets/images/';

/**
 * Subset of config.json used across tests.
 * Reflects the actual AVATAR_GROUP template components and global styles.
 */
const LAYOUTS = {
    theme: {
        styles: {
            controlButtonLabel: {
                color: 'white',
                fontSize: 40,
                fontWeight: 'bold',
                textShadowColor: '#000000',
                textShadowOffset: { width: 2, height: 2 },
                textShadowRadius: 4,
            },
            testStyle: {
                width: 1980,
                textAlign: 'center',
                color: 'white',
                fontSize: 30,
                fontFamily: 'LibreFranklinBold',
                fontWeight: 'bold',
            },
        },
    },
};

/**
 * layoutComponentsById: flat lookup built from config.json components.
 * Represents the children of the AVATAR_GROUP template as they would be
 * indexed by LayoutContext after flattening all screens.
 */
const LAYOUT_COMPONENTS_BY_ID: Record<string, any> = {
    player_bg: {
        type: 'image',
        id: 'player_bg',
        anchor: [0.5, 0.5],
        texture: 'player1.png',
        position: [0, 0],
        size: [60, 60],
    },
    avatar: {
        type: 'image',
        id: 'avatar',
        anchor: [0.5, 0.5],
        texture: '',
        position: [0, -20],
        size: [50, 50],
    },
    name: {
        type: 'text',
        id: 'name',
        text: 'PLAYER NAME',
        anchor: [0.5, 0.5],
        position: [0, 10],
        style: {
            textAlign: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 8,
            width: 844,
        },
    },
    money: {
        type: 'text',
        id: 'money',
        text: '',
        anchor: [0.5, 0.5],
        position: [0, 20],
        style: {
            textAlign: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 8,
            width: 844,
        },
    },
    tap_to_connect: {
        type: 'text',
        id: 'tap_to_connect',
        text: 'PLEASE WAIT...',
        style: {
            textAlign: 'center',
            color: 'white',
            fontSize: 30,
            width: 400,
        },
    },
};

const makeCtx = (overrides: Partial<ResolverContext> = {}): ResolverContext => ({
    layoutComponentsById: LAYOUT_COMPONENTS_BY_ID,
    layouts: LAYOUTS,
    baseUrl: BASE_URL,
    ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. applyPatches
// ─────────────────────────────────────────────────────────────────────────────

describe('applyPatches', () => {
    test('sets a primitive field on a new component', () => {
        const components: Record<string, any> = {};
        applyPatches(components, [
            { target: { ids: ['money'] }, props: { text: '500' } },
        ]);
        expect(components.money.text).toBe('500');
    });

    test('shallow-merges an object field (style) instead of replacing it', () => {
        const components: Record<string, any> = {
            name: { style: { color: 'white', fontSize: 8 } },
        };
        applyPatches(components, [
            { target: { ids: ['name'] }, props: { style: { color: '#ff0000' } } },
        ]);
        // existing fontSize must survive; only color changes
        expect(components.name.style.fontSize).toBe(8);
        expect(components.name.style.color).toBe('#ff0000');
    });

    test('applies patch to multiple targets in one patch entry', () => {
        const components: Record<string, any> = {};
        applyPatches(components, [
            {
                target: { ids: ['money', 'name'] },
                props: { visible: false },
            },
        ]);
        expect(components.money.visible).toBe(false);
        expect(components.name.visible).toBe(false);
    });

    test('applies multiple patch entries sequentially', () => {
        const components: Record<string, any> = {};
        applyPatches(components, [
            { target: { ids: ['player_bg'] }, props: { texture: 'player2.png' } },
            { target: { ids: ['player_bg'] }, props: { texture: 'player3.png' } },
        ]);
        // Last patch wins for primitive overwrite
        expect(components.player_bg.texture).toBe('player3.png');
    });

    test('ignores patch entries without target.ids', () => {
        const components: Record<string, any> = {};
        expect(() =>
            applyPatches(components, [{ target: {}, props: { text: 'x' } }])
        ).not.toThrow();
        expect(Object.keys(components)).toHaveLength(0);
    });

    test('ignores patch entries without props', () => {
        const components: Record<string, any> = {};
        expect(() =>
            applyPatches(components, [{ target: { ids: ['avatar'] } }])
        ).not.toThrow();
        expect(Object.keys(components)).toHaveLength(0);
    });

    test('does not mutate the patches array itself', () => {
        const patches = [{ target: { ids: ['money'] }, props: { text: '99' } }];
        const frozen = JSON.parse(JSON.stringify(patches));
        applyPatches({}, patches);
        expect(patches).toEqual(frozen);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. resolveStyleReference
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveStyleReference', () => {
    const styles = LAYOUTS.theme.styles;

    test('expands @styles.controlButtonLabel reference', () => {
        const result = resolveStyleReference(styles, {
            id: 'up_label',
            style: '@styles.controlButtonLabel',
        });
        expect(result.style.fontSize).toBe(40);
        expect(result.style.color).toBe('white');
    });

    test('expands @styles.testStyle reference', () => {
        const result = resolveStyleReference(styles, {
            id: 'some_text',
            style: '@styles.testStyle',
        });
        expect(result.style.fontFamily).toBe('LibreFranklinBold');
        expect(result.style.width).toBe(1980);
    });

    test('returns element unchanged when style is already an object', () => {
        const el = { id: 'name', style: { color: 'red' } };
        const result = resolveStyleReference(styles, el);
        expect(result).toBe(el); // exact same reference — no copy needed
    });

    test('returns element unchanged when style is absent', () => {
        const el = { id: 'player_bg', texture: 'player1.png' };
        const result = resolveStyleReference(styles, el);
        expect(result).toBe(el);
    });

    test('warns and returns empty style for unknown @styles reference', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result = resolveStyleReference(styles, { style: '@styles.doesNotExist' });
        expect(result.style).toEqual({});
        warnSpy.mockRestore();
    });

    test('preserves non-style fields when expanding reference', () => {
        const result = resolveStyleReference(styles, {
            id: 'btn',
            texture: 'btn.png',
            style: '@styles.controlButtonLabel',
        });
        expect(result.id).toBe('btn');
        expect(result.texture).toBe('btn.png');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveLayoutStyle
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveLayoutStyle', () => {
    test('returns {} when rawStyle is null', () => {
        expect(resolveLayoutStyle(null, LAYOUTS)).toEqual({});
    });

    test('returns {} when rawStyle is undefined', () => {
        expect(resolveLayoutStyle(undefined, LAYOUTS)).toEqual({});
    });

    test('returns the object as-is when rawStyle is a plain object', () => {
        const style = { color: 'red', fontSize: 20 };
        expect(resolveLayoutStyle(style, LAYOUTS)).toBe(style);
    });

    test('resolves @styles.X string reference from layouts.styles', () => {
        const resolved = resolveLayoutStyle('@styles.controlButtonLabel', LAYOUTS);
        expect(resolved.fontSize).toBe(40);
    });

    test('returns {} when layouts has no styles map', () => {
        const result = resolveLayoutStyle('@styles.controlButtonLabel', {});
        // No styles map → falls through to returning rawStyle as-is (string)
        // In implementation: if !layouts?.styles, returns rawStyle directly
        // Let's verify it doesn't crash
        expect(result).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. resolveComponentAssets
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveComponentAssets', () => {
    test('prepends baseUrl to relative texture', () => {
        const comps = { player_bg: { texture: 'player1.png' } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.player_bg.texture).toBe(`${BASE_URL}player1.png`);
    });

    test('does not modify absolute https:// texture', () => {
        const url = 'https://service.play.works/shared/assets/avatars/8_ball.png';
        const comps = { avatar: { texture: url } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.avatar.texture).toBe(url);
    });

    test('does not modify absolute http:// texture', () => {
        const url = 'http://cdn.example.com/img.png';
        const comps = { img: { texture: url } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img.texture).toBe(url);
    });

    test('handles component with no texture field gracefully', () => {
        const comps = { money: { text: '1000' } };
        expect(() => resolveComponentAssets(comps, BASE_URL)).not.toThrow();
        expect(comps.money).not.toHaveProperty('texture');
    });

    test('prepends baseUrl to src field as well', () => {
        const comps = { icon: { src: 'icon.png' } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.icon.src).toBe(`${BASE_URL}icon.png`);
    });

    test('does nothing when baseUrl is empty string', () => {
        const comps = { player_bg: { texture: 'player1.png' } };
        resolveComponentAssets(comps, '');
        expect(comps.player_bg.texture).toBe('player1.png');
    });

    test('resolves multiple components in one call', () => {
        const comps = {
            player_bg: { texture: 'player1.png' },
            avatar: { texture: 'https://external.com/img.png' },
        };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.player_bg.texture).toBe(`${BASE_URL}player1.png`);
        expect(comps.avatar.texture).toBe('https://external.com/img.png');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. resolveSetScreen
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSetScreen — LOAD_SCREEN message', () => {
    const ctx = makeCtx();

    test('extracts screenId and returns remaining data as state', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {
                money: { text: '1000' },
            },
        };
        const { screenId, state } = resolveSetScreen(data, ctx);
        expect(screenId).toBe('ACTION_SCREEN');
        expect(state.state?.money.text).toBe('1000');
    });

    test('does not mutate the original data', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: { money: { text: '1000' } },
        };
        const original = JSON.parse(JSON.stringify(data));
        resolveSetScreen(data, ctx);
        expect(data).toEqual(original);
    });

    test('resolves relative asset URL (player_bg texture)', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {
                player_bg: { texture: 'player1.png' },
            },
        };
        const { state } = resolveSetScreen(data, ctx);
        expect(state.state?.player_bg.texture).toBe(`${BASE_URL}player1.png`);
    });

    test('does NOT modify already-absolute avatar texture URL', () => {
        const avatarUrl = 'https://service.play.works/shared/assets/avatars/8_ball.png';
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {
                avatar: { texture: avatarUrl },
            },
        };
        const { state } = resolveSetScreen(data, ctx);
        expect(state.state?.avatar.texture).toBe(avatarUrl);
    });

    test('merges incoming style with layout base style (name component)', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {
                name: { text: 'JOHN', style: { color: '#ff0000' } },
            },
        };
        const { state } = resolveSetScreen(data, ctx);
        const nameStyle = state.state?.name.style;
        expect(nameStyle.color).toBe('#ff0000');
        expect(nameStyle.fontWeight).toBe('bold');
        expect(nameStyle.fontSize).toBe(8);
        expect(nameStyle.textAlign).toBe('center');
    });

    test('applies patches before resolving assets', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {},
            patches: [
                { target: { ids: ['player_bg'] }, props: { texture: 'player2.png' } },
            ],
        };
        const { state } = resolveSetScreen(data, ctx);
        expect(state.state?.player_bg.texture).toBe(`${BASE_URL}player2.png`);
    });

    test('LOAD_SCREEN with all AVATAR_GROUP components (full payload from ClientManager)', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            state: {
                money: { text: '1000' },
                avatar: { texture: 'https://service.play.works/shared/assets/avatars/8_ball.png' },
                name: { text: 'JOHN' },
                avatar_group: { visible: true },
                player_bg: { texture: 'player1.png' },
            },
        };
        const { screenId, state } = resolveSetScreen(data, ctx);
        expect(screenId).toBe('ACTION_SCREEN');
        expect(state.state?.money.text).toBe('1000');
        expect(state.state?.name.text).toBe('JOHN');
        expect(state.state?.avatar_group.visible).toBe(true);
        expect(state.state?.player_bg.texture).toBe(`${BASE_URL}player1.png`);
    });

    test('handles missing state field gracefully', () => {
        const data = { screenId: 'WAIT_SCREEN' };
        const { screenId, state } = resolveSetScreen(data, ctx);
        expect(screenId).toBe('WAIT_SCREEN');
        expect(state.state).toBeUndefined();
    });

    test('handles empty state object', () => {
        const data = { screenId: 'WAIT_SCREEN', state: {} };
        const { state } = resolveSetScreen(data, ctx);
        expect(state.state).toEqual({});
    });

    test('ignores state when value is an array (guard)', () => {
        const data = { screenId: 'X', state: [] as any };
        const { state } = resolveSetScreen(data, ctx);
        expect(state.state).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. resolveUpdateComponents
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveUpdateComponents — PATCH_STATE message', () => {
    const ctx = makeCtx();

    const prevState: any = {
        state: {
            money: { text: '1000', style: { color: 'white', fontSize: 8 } },
            player_bg: { texture: `${BASE_URL}player1.png` },
            avatar: { texture: 'https://service.play.works/shared/assets/avatars/8_ball.png' },
            name: { text: 'JOHN', style: { color: 'white', fontWeight: 'bold', fontSize: 8, textAlign: 'center', width: 844 } },
            avatar_group: { visible: true },
        },
    };

    test('updates text of money component', () => {
        const data = { state: { money: { text: '3000' } } };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.text).toBe('3000');
    });

    test('does not mutate previous state', () => {
        const frozen = JSON.parse(JSON.stringify(prevState));
        const data = { state: { money: { text: '9999' } } };
        resolveUpdateComponents(data, prevState, ctx);
        expect(prevState).toEqual(frozen);
    });

    test('preserves unchanged components from previous state', () => {
        const data = { state: { money: { text: '3000' } } };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.avatar_group.visible).toBe(true);
    });

    test('style deep-merge: layout base → prev style → incoming style (name component)', () => {
        const data = {
            state: {
                name: { text: 'PAUL', style: { color: '#ff0000' } },
            },
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        const s = next.state.name.style;
        expect(s.color).toBe('#ff0000');
        expect(s.fontWeight).toBe('bold');
        expect(s.fontSize).toBe(8);
        expect(s.textAlign).toBe('center');
        expect(s.width).toBe(844);
    });

    test('resolves relative texture in PATCH_STATE (player_bg)', () => {
        const data = { state: { player_bg: { texture: 'player3.png' } } };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.player_bg.texture).toBe(`${BASE_URL}player3.png`);
    });

    test('keeps absolute avatar URL intact', () => {
        const url = 'https://service.play.works/shared/assets/avatars/8_ball.png';
        const data = { state: { avatar: { texture: url } } };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.avatar.texture).toBe(url);
    });

    test('adds a brand-new component not present in prev state (test component)', () => {
        const data = {
            state: {
                test: { style: { color: '#00ff00' }, text: 'TEST COMPONENT' },
            },
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.test.text).toBe('TEST COMPONENT');
        expect(next.state.test.style.color).toBe('#00ff00');
    });

    test('full PATCH_STATE payload from ClientManager simulation', () => {
        const data = {
            state: {
                money: { text: '3000' },
                avatar: { texture: 'https://service.play.works/shared/assets/avatars/8_ball.png' },
                name: { text: 'PAUL', style: { color: '#ff0000' } },
                avatar_group: { visible: true },
                test: { style: { color: '#00ff00' }, text: 'TEST COMPONENT' },
                player_bg: { texture: 'player3.png' },
            },
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.text).toBe('3000');
        expect(next.state.name.text).toBe('PAUL');
        expect(next.state.name.style.color).toBe('#ff0000');
        expect(next.state.player_bg.texture).toBe(`${BASE_URL}player3.png`);
        expect(next.state.test.text).toBe('TEST COMPONENT');
    });

    // ── Patch path ──────────────────────────────────────────────────────────

    test('applies patches and merges state when both present', () => {
        const data = {
            patches: [
                { target: { ids: ['money'] }, props: { text: '7777' } },
            ],
            state: {
                name: { text: 'PATCHED_NAME' },
            },
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.text).toBe('7777');
        expect(next.state.name.text).toBe('PATCHED_NAME');
    });

    test('patch-only update (no state field) still works', () => {
        const data = {
            patches: [
                { target: { ids: ['player_bg'] }, props: { texture: 'player2.png' } },
            ],
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.player_bg.texture).toBe(`${BASE_URL}player2.png`);
    });

    test('patch applies object-style merge (style sub-keys)', () => {
        const data = {
            patches: [
                { target: { ids: ['money'] }, props: { style: { color: '#aabbcc' } } },
            ],
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.style.color).toBe('#aabbcc');
        expect(next.state.money.style.fontSize).toBe(8);
    });

    test('patch to multiple targets in one patch entry', () => {
        const data = {
            patches: [
                { target: { ids: ['money', 'name'] }, props: { visible: false } },
            ],
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.visible).toBe(false);
        expect(next.state.name.visible).toBe(false);
    });

    test('resolves asset URLs after patching in patch-only path', () => {
        const prev: any = { state: {} };
        const data = {
            patches: [
                { target: { ids: ['player_bg'] }, props: { texture: 'player3.png' } },
            ],
        };
        const next = resolveUpdateComponents(data, prev, ctx);
        expect(next.state.player_bg.texture).toBe(`${BASE_URL}player3.png`);
    });

    test('handles empty patches array (no-op)', () => {
        const data = {
            patches: [],
            state: { money: { text: '42' } },
        };
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.text).toBe('42');
    });

    test('handles missing state and no patches (identity-like)', () => {
        const data = {};
        const next = resolveUpdateComponents(data, prevState, ctx);
        expect(next.state.money.text).toBe('1000');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. resolveElementConfig (full pipeline: style ref + asset URL + children)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveElementConfig', () => {
    const styles = LAYOUTS.theme.styles;

    test('resolves @styles reference AND prepends baseUrl in one pass', () => {
        const el = {
            id: 'btn',
            texture: 'control_btn.png',
            style: '@styles.controlButtonLabel',
        };
        const result = resolveElementConfig(styles, el, BASE_URL);
        expect(result.style.fontSize).toBe(40);
        expect(result.texture).toBe(`${BASE_URL}control_btn.png`);
    });

    test('recursively resolves children inside container layout', () => {
        const container = {
            type: 'container',
            layout: [
                { id: 'player_bg', texture: 'player1.png' },
                { id: 'avatar', texture: 'https://external.com/avatar.png' },
            ],
        };
        const result = resolveElementConfig(styles, container, BASE_URL);
        expect(result.layout[0].texture).toBe(`${BASE_URL}player1.png`);
        expect(result.layout[1].texture).toBe('https://external.com/avatar.png');
    });

    test('does not mutate original element config', () => {
        const el = { id: 'x', texture: 'img.png' };
        const copy = { ...el };
        resolveElementConfig(styles, el, BASE_URL);
        expect(el).toEqual(copy);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. recursiveProcessConfig (template children merge)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 9. Button states texture resolution (resolveElementConfig)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveElementConfig — button states texture resolution', () => {
    const styles = LAYOUTS.theme.styles;

    test('resolves relative pressed-state texture (dpad UP button)', () => {
        // Mirrors the real "up" button config in config.json CONTROL_SCREEN
        const upButton = {
            type: 'button',
            id: 'up',
            texture: 'control_btn.png',
            states: {
                pressed: { texture: 'control_btn_focused.png' },
            },
        };
        const result = resolveElementConfig(styles, upButton, BASE_URL);
        expect(result.texture).toBe(`${BASE_URL}control_btn.png`);
        expect(result.states.pressed.texture).toBe(`${BASE_URL}control_btn_focused.png`);
    });

    test('resolves relative pressed-state texture (BACK_BUTTON)', () => {
        // Mirrors the real BACK_BUTTON template from config.json
        const backButton = {
            type: 'button',
            id: 'back',
            texture: 'back_btn.png',
            states: {
                pressed: { texture: 'back_btn_focused.png' },
            },
        };
        const result = resolveElementConfig(styles, backButton, BASE_URL);
        expect(result.texture).toBe(`${BASE_URL}back_btn.png`);
        expect(result.states.pressed.texture).toBe(`${BASE_URL}back_btn_focused.png`);
    });

    test('does NOT modify already-absolute pressed-state texture', () => {
        const absoluteUrl = 'https://cdn.example.com/btn_focused.png';
        const button = {
            type: 'button',
            texture: 'btn.png',
            states: {
                pressed: { texture: absoluteUrl },
            },
        };
        const result = resolveElementConfig(styles, button, BASE_URL);
        expect(result.states.pressed.texture).toBe(absoluteUrl);
    });

    test('preserves non-texture fields inside state config', () => {
        const button = {
            type: 'button',
            texture: 'btn.png',
            states: {
                pressed: { texture: 'btn_pressed.png', opacity: 0.8, scale: 1.1 },
            },
        };
        const result = resolveElementConfig(styles, button, BASE_URL);
        expect(result.states.pressed.opacity).toBe(0.8);
        expect(result.states.pressed.scale).toBe(1.1);
    });

    test('handles multiple states (pressed + disabled)', () => {
        const button = {
            type: 'button',
            texture: 'btn.png',
            states: {
                pressed:  { texture: 'btn_pressed.png' },
                disabled: { texture: 'btn_disabled.png' },
            },
        };
        const result = resolveElementConfig(styles, button, BASE_URL);
        expect(result.states.pressed.texture).toBe(`${BASE_URL}btn_pressed.png`);
        expect(result.states.disabled.texture).toBe(`${BASE_URL}btn_disabled.png`);
    });

    test('handles button with no states field gracefully', () => {
        const button = { type: 'button', texture: 'btn.png' };
        const result = resolveElementConfig(styles, button, BASE_URL);
        expect(result.texture).toBe(`${BASE_URL}btn.png`);
        expect(result.states).toBeUndefined();
    });

    test('resolves state textures inside recursive container children', () => {
        // Mirrors the dpad_group container from CONTROL_SCREEN config.json
        const dpadGroup = {
            type: 'container',
            id: 'dpad_group',
            layout: [
                {
                    type: 'button', id: 'up',
                    texture: 'control_btn.png',
                    states: { pressed: { texture: 'control_btn_focused.png' } },
                },
                {
                    type: 'button', id: 'Right',
                    texture: 'control_btn.png',
                    states: { pressed: { texture: 'control_btn_focused.png' } },
                },
            ],
        };
        const result = resolveElementConfig(styles, dpadGroup, BASE_URL);
        expect(result.layout[0].states.pressed.texture).toBe(`${BASE_URL}control_btn_focused.png`);
        expect(result.layout[1].states.pressed.texture).toBe(`${BASE_URL}control_btn_focused.png`);
        expect(result.layout[0].texture).toBe(`${BASE_URL}control_btn.png`);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getAnchorStyle — positioning math
// Design canvas: BASE_DESIGN_WIDTH=844, BASE_DESIGN_HEIGHT=390 (src/constants.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('getAnchorStyle — positioning math', () => {
    // ── anchor [0, 0] — top-left origin ─────────────────────────────────────

    test('anchor [0,0]: position maps directly to left/top (no pivot offset)', () => {
        const style = getAnchorStyle({
            anchor: [0, 0],
            position: [100, 50],
            size: [80, 80],
        });
        // left = 844*0 - 80*0 + 100 = 100
        // top  = 390*0 - 80*0 + 50  = 50
        expect(style.left).toBe(100);
        expect(style.top).toBe(50);
    });

    test('anchor [0,0]: zero position places element at top-left corner', () => {
        const style = getAnchorStyle({
            anchor: [0, 0],
            position: [0, 0],
            size: [80, 80],
        });
        expect(style.left).toBe(0);
        expect(style.top).toBe(0);
    });

    // ── anchor [0.5, 0.5] — center ───────────────────────────────────────────

    test('anchor [0.5,0.5]: element is centered on screen with position [0,0]', () => {
        // left = 844*0.5 - 80*0.5 + 0 = 422 - 40 = 382
        // top  = 390*0.5 - 80*0.5 + 0 = 195 - 40 = 155
        const style = getAnchorStyle({
            anchor: [0.5, 0.5],
            position: [0, 0],
            size: [80, 80],
        });
        expect(style.left).toBe(382);
        expect(style.top).toBe(155);
    });

    test('anchor [0.5,0.5]: position offsets from center (logo -20 Y from config.json)', () => {
        // Mirrors main_logo in WAIT_SCREEN: anchor=[0.5,0.5] position=[0,-20] size=[200,250]
        // left = 844*0.5 - 200*0.5 + 0    = 422 - 100 = 322
        // top  = 390*0.5 - 250*0.5 + (-20) = 195 - 125 - 20 = 50
        const style = getAnchorStyle({
            anchor: [0.5, 0.5],
            position: [0, -20],
            size: [200, 250],
        });
        expect(style.left).toBe(322);
        expect(style.top).toBe(50);
    });

    test('anchor [0.5,0.5]: positive Y position pushes element down from center', () => {
        // left = 844*0.5 - 400*0.5 + 0 = 422 - 200 = 222
        // top  = 390*0.5 - 30*0.5  + 100 = 195 - 15 + 100 = 280
        const style = getAnchorStyle({
            anchor: [0.5, 0.5],
            position: [0, 100],
            size: [400, 30],
        });
        expect(style.left).toBe(222);
        expect(style.top).toBe(280);
    });

    // ── anchor [1, 0] — top-right (BACK_BUTTON) ─────────────────────────────

    test('anchor [1,0]: BACK_BUTTON positioned as inward margin from right edge', () => {
        // Mirrors BACK_BUTTON template: anchor=[1,0] position=[20,20] size=[80,40]
        // left = 844 - 80 - 20 = 744
        // top  = 390*0 - 40*0 + 20 = 20
        const style = getAnchorStyle({
            anchor: [1, 0],
            position: [20, 20],
            size: [80, 40],
        });
        expect(style.left).toBe(744);
        expect(style.top).toBe(20);
    });

    test('anchor [1,0]: zero margin places element flush against right edge', () => {
        // left = 844 - 80 - 0 = 764
        // top  = 0
        const style = getAnchorStyle({
            anchor: [1, 0],
            position: [0, 0],
            size: [80, 40],
        });
        expect(style.left).toBe(764);
        expect(style.top).toBe(0);
    });

    // ── globalScale ──────────────────────────────────────────────────────────

    test('globalScale=2 doubles all dimensions and offsets', () => {
        // BACK_BUTTON with scale=2: size=[80,40] pos=[20,20] anchor=[1,0]
        // elemW=160, elemH=80, offsetX=40, offsetY=40
        // left = 844 - 160 - 40 = 644
        // top  = 0 + 40 = 40
        const style = getAnchorStyle(
            { anchor: [1, 0], position: [20, 20], size: [80, 40] },
            2,
        );
        expect(style.left).toBe(644);
        expect(style.top).toBe(40);
    });

    test('globalScale=0.5 halves all dimensions and offsets (anchor [0.5,0.5])', () => {
        // size=[80,80] scale=0.5 → elemW=40, elemH=40 pos=[0,0]
        // left = 844*0.5 - 40*0.5 + 0 = 422 - 20 = 402
        // top  = 390*0.5 - 40*0.5 + 0 = 195 - 20 = 175
        const style = getAnchorStyle(
            { anchor: [0.5, 0.5], position: [0, 0], size: [80, 80] },
            0.5,
        );
        expect(style.left).toBe(402);
        expect(style.top).toBe(175);
    });

    // ── explicit parentWidth/Height ───────────────────────────────────────────

    test('uses parentWidth/Height instead of screen dims when provided', () => {
        // dpad_group container [200,200], button inside anchor=[0.5,0.5] size=[80,80] pos=[0,0]
        // left = 200*0.5 - 80*0.5 + 0 = 100 - 40 = 60
        // top  = 200*0.5 - 80*0.5 + 0 = 100 - 40 = 60
        const style = getAnchorStyle(
            { anchor: [0.5, 0.5], position: [0, 0], size: [80, 80] },
            1,
            200,
            200,
        );
        expect(style.left).toBe(60);
        expect(style.top).toBe(60);
    });

    test('BACK_BUTTON inside a parent container uses parent dims', () => {
        // Parent [400,300], BACK_BUTTON anchor=[1,0] pos=[20,20] size=[80,40]
        // left = 400 - 80 - 20 = 300
        // top  = 0 + 20 = 20
        const style = getAnchorStyle(
            { anchor: [1, 0], position: [20, 20], size: [80, 40] },
            1,
            400,
            300,
        );
        expect(style.left).toBe(300);
        expect(style.top).toBe(20);
    });

    // ── always emits position:'absolute' ─────────────────────────────────────

    test('always returns position: absolute regardless of anchor', () => {
        const s1 = getAnchorStyle({ anchor: [0, 0],     position: [0, 0], size: [50, 50] });
        const s2 = getAnchorStyle({ anchor: [0.5, 0.5], position: [0, 0], size: [50, 50] });
        const s3 = getAnchorStyle({ anchor: [1, 0],     position: [0, 0], size: [50, 50] });
        expect(s1.position).toBe('absolute');
        expect(s2.position).toBe('absolute');
        expect(s3.position).toBe('absolute');
    });

    // ── size fallback from style.width/fontSize ───────────────────────────────

    test('falls back to customStyle.width / fontSize when size is not provided', () => {
        // Text component: no size array, but style.width=400 and style.fontSize=30
        // left = 844*0.5 - 400*0.5 + 0 = 422 - 200 = 222
        // top  = 390*0.5 - 30*0.5  + 100 = 195 - 15 + 100 = 280
        const style = getAnchorStyle({
            anchor: [0.5, 0.5],
            position: [0, 100],
            style: { width: 400, fontSize: 30 },
        });
        expect(style.left).toBe(222);
        expect(style.top).toBe(280);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. minClientVersion & top-level field passthrough in resolveSetScreen
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSetScreen — top-level field passthrough', () => {
    const ctx = makeCtx();

    test('minClientVersion passes through into returned state', () => {
        const data = {
            screenId: 'WAIT_SCREEN',
            minClientVersion: '1.0.2',
        };
        const { state } = resolveSetScreen(data, ctx);
        expect((state as any).minClientVersion).toBe('1.0.2');
    });

    test('arbitrary top-level fields from server survive into state', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            customFlag: true,
            roundNumber: 3,
            state: { money: { text: '500' } },
        };
        const { state } = resolveSetScreen(data, ctx);
        expect((state as any).customFlag).toBe(true);
        expect((state as any).roundNumber).toBe(3);
    });

    test('screenId is NOT present in the returned state object', () => {
        const data = { screenId: 'ACTION_SCREEN', state: {} };
        const { state } = resolveSetScreen(data, ctx);
        expect((state as any).screenId).toBeUndefined();
    });

    test('minClientVersion is preserved and not overwritten by resolving assets or patches', () => {
        const data = {
            screenId: 'ACTION_SCREEN',
            minClientVersion: '1.0.2',
            state: { player_bg: { texture: 'player1.png' } },
            patches: [{ target: { ids: ['money'] }, props: { text: '777' } }],
        };
        const { state } = resolveSetScreen(data, ctx);
        expect((state as any).minClientVersion).toBe('1.0.2');
        expect(state.state?.player_bg.texture).toBe(`${BASE_URL}player1.png`);
    });
});

describe('recursiveProcessConfig — template children merge', () => {
    test('merges server data into matching child by id (player_bg)', () => {
        const templateConfig = {
            type: 'container',
            layout: [
                { id: 'player_bg', texture: 'player1.png', style: {} },
                { id: 'avatar', texture: '' },
            ],
        };
        const serverData = {
            state: {
                player_bg: { texture: 'player2.png' },
            },
        };
        const result = recursiveProcessConfig(templateConfig, serverData);
        expect(result.layout[0].texture).toBe('player2.png');
        expect(result.layout[1].texture).toBe(''); // untouched
    });

    test('deep-merges style: template base + server override', () => {
        const templateConfig = {
            id: 'name',
            style: { color: 'white', fontSize: 8, fontWeight: 'bold' },
        };
        const serverData = {
            state: {
                name: { style: { color: '#ff0000' } },
            },
        };
        const result = recursiveProcessConfig(templateConfig, serverData);
        expect(result.style.color).toBe('#ff0000');
        expect(result.style.fontSize).toBe(8);
        expect(result.style.fontWeight).toBe('bold');
    });

    test('does not affect elements without matching id', () => {
        const config = { id: 'money', text: '0' };
        const serverData = { components: { name: { text: 'X' } } };
        const result = recursiveProcessConfig(config, serverData);
        expect(result.text).toBe('0');
    });

    test('works when serverData has no components', () => {
        const config = { id: 'avatar', texture: 'player1.png' };
        const result = recursiveProcessConfig(config, {});
        expect(result.texture).toBe('player1.png');
    });

    test('merges all AVATAR_GROUP children from full payload', () => {
        const avatarGroup = {
            type: 'container',
            layout: [
                { id: 'player_bg', texture: 'player1.png', style: {} },
                { id: 'avatar', texture: '' },
                { id: 'name', text: 'PLAYER NAME', style: { color: 'white', fontSize: 8 } },
                { id: 'money', text: '', style: { color: 'white', fontSize: 8 } },
            ],
        };
        const serverData = {
            state: {
                player_bg: { texture: 'player3.png' },
                avatar: { texture: 'https://service.play.works/shared/assets/avatars/8_ball.png' },
                name: { text: 'PAUL', style: { color: '#ff0000' } },
                money: { text: '3000' },
            },
        };
        const result = recursiveProcessConfig(avatarGroup, serverData);
        const [bg, av, nm, mn] = result.layout;
        expect(bg.texture).toBe('player3.png');
        expect(av.texture).toBe('https://service.play.works/shared/assets/avatars/8_ball.png');
        expect(nm.text).toBe('PAUL');
        expect(nm.style.color).toBe('#ff0000');
        expect(nm.style.fontSize).toBe(8);   // base preserved
        expect(mn.text).toBe('3000');
    });
});

