/**
 * Unit tests for applyServerData.ts — applyServerDataToChild.
 *
 * The function has two injection paths:
 *   Path 1: serverData.state[id] — structured overrides, style deep-merged.
 *   Path 2: serverData[id]       — legacy scalar: text → .text, image → .texture.
 *
 * Both paths can fire on the same call when server sends both forms simultaneously.
 */

import { applyServerDataToChild } from '../src/utils/applyServerData';
import { GameState } from '../src/types/ProtocolTypes';

// ─── Guard: no id ─────────────────────────────────────────────────────────────

describe('no id — early return', () => {
    test('element without id is not mutated', () => {
        const config: Record<string, unknown> = { type: 'text', text: 'hello' };
        applyServerDataToChild(config, { state: { btn: { text: 'world' } } });
        expect(config.text).toBe('hello');
    });

    test('element with empty string id is not mutated', () => {
        const config: Record<string, unknown> = { id: '', type: 'text', text: 'hello' };
        applyServerDataToChild(config, { state: { '': { text: 'world' } } });
        expect(config.text).toBe('hello');
    });
});

// ─── Guard: id present but no matching server data ────────────────────────────

describe('id present but no matching server data', () => {
    test('unknown id in state map → no mutation', () => {
        const config: Record<string, unknown> = { id: 'btn1', type: 'text', text: 'hello' };
        applyServerDataToChild(config, { state: { btn2: { text: 'world' } } });
        expect(config.text).toBe('hello');
    });

    test('empty serverData → no mutation', () => {
        const config: Record<string, unknown> = { id: 'btn1', type: 'text', text: 'hello' };
        applyServerDataToChild(config, {});
        expect(config.text).toBe('hello');
    });

    test('serverData.state is undefined → no mutation', () => {
        const config: Record<string, unknown> = { id: 'btn1', type: 'text', text: 'hello' };
        applyServerDataToChild(config, { someOtherKey: 'value' } as GameState);
        expect(config.text).toBe('hello');
    });
});

// ─── Path 1: structured state overrides ──────────────────────────────────────

describe('Path 1 — structured state overrides (serverData.state[id])', () => {
    test('overrides a single field', () => {
        const config: Record<string, unknown> = { id: 'lbl', type: 'text', text: 'old' };
        applyServerDataToChild(config, { state: { lbl: { text: 'new' } } });
        expect(config.text).toBe('new');
    });

    test('overrides multiple fields at once', () => {
        const config: Record<string, unknown> = { id: 'btn', type: 'button', visible: true, disabled: false };
        applyServerDataToChild(config, { state: { btn: { visible: false, disabled: true } } });
        expect(config.visible).toBe(false);
        expect(config.disabled).toBe(true);
    });

    test('adds a new field that did not exist before', () => {
        const config: Record<string, unknown> = { id: 'btn', type: 'button' };
        applyServerDataToChild(config, { state: { btn: { customProp: 'injected' } } });
        expect(config.customProp).toBe('injected');
    });

    test('style is deep-merged: base fields are preserved, updates win on conflict', () => {
        const config: Record<string, unknown> = {
            id: 'lbl',
            style: { color: 'red', fontSize: 12, fontWeight: 'normal' },
        };
        applyServerDataToChild(config, {
            state: { lbl: { style: { fontSize: 20, fontWeight: 'bold' } } },
        });
        expect(config.style).toEqual({
            color: 'red',       // preserved from base
            fontSize: 20,       // overridden by update
            fontWeight: 'bold', // overridden by update
        });
    });

    test('style is set directly when element had no base style', () => {
        const config: Record<string, unknown> = { id: 'lbl', type: 'text' };
        applyServerDataToChild(config, {
            state: { lbl: { style: { color: 'blue' } } },
        });
        expect(config.style).toEqual({ color: 'blue' });
    });

    test('update without style field does not wipe existing style', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            style: { color: 'green' },
            visible: true,
        };
        applyServerDataToChild(config, { state: { btn: { visible: false } } });
        expect(config.style).toEqual({ color: 'green' });
        expect(config.visible).toBe(false);
    });

    test('numeric value overrides string value', () => {
        const config: Record<string, unknown> = { id: 'score', type: 'text', text: 'N/A' };
        applyServerDataToChild(config, { state: { score: { text: 99 } } });
        expect(config.text).toBe(99);
    });
});

// ─── Path 2: legacy scalar binding ───────────────────────────────────────────

describe('Path 2 — legacy scalar binding (serverData[id])', () => {
    test('text component: scalar sets .text', () => {
        const config: Record<string, unknown> = { id: 'score', type: 'text', text: '' };
        applyServerDataToChild(config, { score: 'Player 1' });
        expect(config.text).toBe('Player 1');
    });

    test('text component: numeric scalar sets .text as a number', () => {
        const config: Record<string, unknown> = { id: 'score', type: 'text', text: 0 };
        applyServerDataToChild(config, { score: 42 });
        expect(config.text).toBe(42);
    });

    test('image component: scalar sets .texture', () => {
        const config: Record<string, unknown> = { id: 'avatar', type: 'image', texture: 'default.png' };
        applyServerDataToChild(config, { avatar: 'custom.png' });
        expect(config.texture).toBe('custom.png');
    });

    test('button type: scalar does NOT set .text or .texture', () => {
        const config: Record<string, unknown> = { id: 'btn', type: 'button', text: 'Click' };
        applyServerDataToChild(config, { btn: 'ignored' });
        expect(config.text).toBe('Click');
        expect(config.texture).toBeUndefined();
    });

    test('unknown type: scalar is ignored', () => {
        const config: Record<string, unknown> = { id: 'widget', type: 'dpad' };
        applyServerDataToChild(config, { widget: 'something' });
        expect(config.text).toBeUndefined();
        expect(config.texture).toBeUndefined();
    });
});

// ─── Both paths simultaneously ────────────────────────────────────────────────

describe('Both paths fire simultaneously', () => {
    test('Path 1 sets visible, Path 2 sets text — both applied', () => {
        const config: Record<string, unknown> = { id: 'score', type: 'text', text: '', visible: true };
        applyServerDataToChild(config, {
            state: { score: { visible: false } },
            score: 'Player 1',
        });
        expect(config.visible).toBe(false);
        expect(config.text).toBe('Player 1');
    });

    test('Path 1 style deep-merge + Path 2 texture on image', () => {
        const config: Record<string, unknown> = {
            id: 'avatar',
            type: 'image',
            texture: 'default.png',
            style: { opacity: 1 },
        };
        applyServerDataToChild(config, {
            state: { avatar: { style: { opacity: 0.5 } } },
            avatar: 'new_avatar.png',
        });
        expect(config.style).toEqual({ opacity: 0.5 });
        expect(config.texture).toBe('new_avatar.png');
    });
});

// ─── Container elements ───────────────────────────────────────────────────────

describe('Container elements', () => {
    test('container visible toggle via Path 1', () => {
        const config: Record<string, unknown> = {
            id: 'panel',
            type: 'container',
            visible: true,
            layout: [{ type: 'text', id: 'child', text: 'unchanged' }],
        };
        applyServerDataToChild(config, { state: { panel: { visible: false } } });
        expect(config.visible).toBe(false);
    });

    test('container style deep-merged, children layout array untouched', () => {
        const childEl = { type: 'text', id: 'child', text: 'hello' };
        const config: Record<string, unknown> = {
            id: 'panel',
            type: 'container',
            style: { backgroundColor: 'black', opacity: 1 },
            layout: [childEl],
        };
        applyServerDataToChild(config, {
            state: { panel: { style: { opacity: 0.5 } } },
        });
        expect(config.style).toEqual({ backgroundColor: 'black', opacity: 0.5 });
        // layout array itself is not touched by the function — children keep their data
        expect((config.layout as typeof childEl[])[0].text).toBe('hello');
    });

    test('function does NOT recurse into layout children — child id in state is ignored', () => {
        const config: Record<string, unknown> = {
            id: 'panel',
            type: 'container',
            layout: [{ type: 'text', id: 'child', text: 'old' }],
        };
        // server has state for 'child', but we pass the parent container
        applyServerDataToChild(config, { state: { child: { text: 'new' } } });
        expect((config.layout as Record<string, unknown>[])[0].text).toBe('old');
    });
});

// ─── Button states ────────────────────────────────────────────────────────────

describe('Button states — states object behaviour', () => {
    test('server can set the entire states object via Path 1', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            type: 'button',
            states: { normal: { texture: 'n.png' }, pressed: { texture: 'p.png' } },
        };
        applyServerDataToChild(config, {
            state: { btn: { states: { pressed: { texture: 'p_new.png' } } } },
        });
        // Object.assign replaces states entirely — normal state is gone
        expect(config.states).toEqual({ pressed: { texture: 'p_new.png' } });
    });

    test('states is NOT deep-merged — unmentioned states are wiped', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            type: 'button',
            states: {
                normal:   { texture: 'n.png' },
                pressed:  { texture: 'p.png' },
                disabled: { texture: 'd.png' },
            },
        };
        applyServerDataToChild(config, {
            state: { btn: { states: { disabled: { texture: 'd_new.png' } } } },
        });
        const states = config.states as Record<string, unknown>;
        expect(states.disabled).toEqual({ texture: 'd_new.png' }); // updated
        expect(states.normal).toBeUndefined();   // wiped — states is NOT deep-merged
        expect(states.pressed).toBeUndefined();  // wiped — states is NOT deep-merged
    });

    test('state style within states is not auto-merged by this function', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            type: 'button',
            states: {
                normal: { texture: 'n.png', style: { color: 'red' } },
            },
        };
        applyServerDataToChild(config, {
            state: { btn: { states: { normal: { style: { color: 'blue' } } } } },
        });
        const states = config.states as Record<string, Record<string, unknown>>;
        // the whole states object is replaced — base style inside state is gone
        expect(states.normal.style).toEqual({ color: 'blue' });
        expect(states.normal.texture).toBeUndefined();
    });
});

// ─── Button layout (inline children) ─────────────────────────────────────────

describe('Button layout — inline children array', () => {
    test('server can replace layout array via Path 1', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            type: 'button',
            layout: [{ type: 'image', id: 'icon', texture: 'icon.png' }],
        };
        const newLayout = [{ type: 'text', id: 'label', text: 'OK' }];
        applyServerDataToChild(config, { state: { btn: { layout: newLayout } } });
        expect(config.layout).toEqual(newLayout);
    });

    test('layout replacement does not affect style deep-merge', () => {
        const config: Record<string, unknown> = {
            id: 'btn',
            type: 'button',
            style: { opacity: 1 },
            layout: [{ type: 'image', id: 'icon', texture: 'icon.png' }],
        };
        const newLayout = [{ type: 'text', id: 'label', text: 'OK' }];
        applyServerDataToChild(config, {
            state: { btn: { layout: newLayout, style: { opacity: 0 } } },
        });
        expect(config.layout).toEqual(newLayout);
        expect(config.style).toEqual({ opacity: 0 }); // style still deep-merged
    });
});

// ─── Mutation behaviour ───────────────────────────────────────────────────────

describe('Mutation behaviour', () => {
    test('function mutates the passed object in place', () => {
        const config: Record<string, unknown> = { id: 'btn', type: 'text', text: 'before' };
        const ref = config; // same reference
        applyServerDataToChild(config, { state: { btn: { text: 'after' } } });
        expect(ref.text).toBe('after'); // same object was mutated
    });
});

