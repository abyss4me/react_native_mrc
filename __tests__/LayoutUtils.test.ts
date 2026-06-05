/**
 * Unit tests for LayoutUtils.ts
 *
 * Covers all exported functions:
 *   - rotationTransform
 *   - resolveAnchorStyle
 *   - getAnchorStyle          (anchor math: top-left / center / right / bottom edges + scale)
 *   - resolveStyleReference   (@styles.X expansion)
 *   - resolveElementConfig    (style ref + asset URL + recursive layout children)
 *   - applyPatches            (object deep-merge vs scalar replace, multi-id, unknown id)
 *   - resolveComponentAssets  (relative → prepend, absolute → unchanged, empty baseUrl guard)
 *   - recursiveProcessConfig  (top-level override, style deep-merge, recursive children)
 *
 * BASE_DESIGN_WIDTH = 844, BASE_DESIGN_HEIGHT = 390  (from constants.ts)
 */

import {
    rotationTransform,
    resolveAnchorStyle,
    getAnchorStyle,
    resolveStyleReference,
    resolveElementConfig,
    applyPatches,
    resolveComponentAssets,
    recursiveProcessConfig,
    ResolvedConfig,
} from '../src/engine/LayoutUtils';

import { BASE_DESIGN_WIDTH, BASE_DESIGN_HEIGHT } from '../src/constants';
import { GameState } from '../src/types/ProtocolTypes';

const BASE_URL = 'https://cdn.example.com/assets/';

// ─── rotationTransform ────────────────────────────────────────────────────────

describe('rotationTransform', () => {
    test('undefined → empty array', () => {
        expect(rotationTransform(undefined)).toEqual([]);
    });

    test('0 degrees → [{ rotate: "0deg" }]', () => {
        expect(rotationTransform(0)).toEqual([{ rotate: '0deg' }]);
    });

    test('positive angle → correct string', () => {
        expect(rotationTransform(45)).toEqual([{ rotate: '45deg' }]);
    });

    test('negative angle → correct string', () => {
        expect(rotationTransform(-90)).toEqual([{ rotate: '-90deg' }]);
    });

    test('float angle → correct string', () => {
        expect(rotationTransform(22.5)).toEqual([{ rotate: '22.5deg' }]);
    });
});

// ─── resolveAnchorStyle ───────────────────────────────────────────────────────

describe('resolveAnchorStyle — guard: no position & no anchor', () => {
    test('empty config → returns empty object (flex layout mode)', () => {
        expect(resolveAnchorStyle({})).toEqual({});
    });

    test('config with only size → returns empty object', () => {
        expect(resolveAnchorStyle({ size: [100, 50] })).toEqual({});
    });

    test('config with position → returns absolute style', () => {
        const result = resolveAnchorStyle({ position: [10, 20], size: [100, 50] }, 1, 800, 400);
        expect(result.position).toBe('absolute');
    });

    test('config with anchor → returns absolute style', () => {
        const result = resolveAnchorStyle({ anchor: [0.5, 0.5], size: [100, 50] }, 1, 800, 400);
        expect(result.position).toBe('absolute');
    });
});

// ─── getAnchorStyle — positioning math ───────────────────────────────────────

describe('getAnchorStyle — anchor [0, 0] (top-left origin)', () => {
    test('position offset is applied directly', () => {
        const r = getAnchorStyle({ anchor: [0, 0], position: [10, 20], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(10);
        expect(r.top).toBe(20);
    });

    test('zero position → left=0, top=0', () => {
        const r = getAnchorStyle({ anchor: [0, 0], position: [0, 0], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(0);
        expect(r.top).toBe(0);
    });
});

describe('getAnchorStyle — anchor [0.5, 0.5] (center)', () => {
    test('element is centered in parent when position=[0,0]', () => {
        // left = 800*0.5 - 100*0.5 + 0 = 350
        // top  = 400*0.5 -  50*0.5 + 0 = 175
        const r = getAnchorStyle({ anchor: [0.5, 0.5], position: [0, 0], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(350);
        expect(r.top).toBe(175);
    });

    test('position offsets are added after centering', () => {
        // left = 350 + 30 = 380
        // top  = 175 + 10 = 185
        const r = getAnchorStyle({ anchor: [0.5, 0.5], position: [30, 10], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(380);
        expect(r.top).toBe(185);
    });
});

describe('getAnchorStyle — anchor [1, 0] (right edge)', () => {
    test('position acts as inward margin from right', () => {
        // left = 800 - 100 - 20 = 680
        // top  = 0*400 - 0*50 + 20 = 20
        const r = getAnchorStyle({ anchor: [1, 0], position: [20, 20], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(680);
        expect(r.top).toBe(20);
    });

    test('zero margin → element flush to right edge', () => {
        // left = 800 - 100 - 0 = 700
        const r = getAnchorStyle({ anchor: [1, 0], position: [0, 0], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(700);
    });
});

describe('getAnchorStyle — anchor [0, 1] (bottom edge)', () => {
    test('position acts as inward margin from bottom', () => {
        // left = 0 + 20 = 20
        // top  = 400 - 50 - 20 = 330
        const r = getAnchorStyle({ anchor: [0, 1], position: [20, 20], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(20);
        expect(r.top).toBe(330);
    });
});

describe('getAnchorStyle — anchor [1, 1] (bottom-right corner)', () => {
    test('both axes use inward margin', () => {
        // left = 800 - 100 - 20 = 680
        // top  = 400 -  50 - 20 = 330
        const r = getAnchorStyle({ anchor: [1, 1], position: [20, 20], size: [100, 50] }, 1, 800, 400);
        expect(r.left).toBe(680);
        expect(r.top).toBe(330);
    });
});

describe('getAnchorStyle — globalScale', () => {
    test('scale=2 doubles element size and offsets', () => {
        // elementWidth=200, elementHeight=100, offsetX=20, offsetY=40
        // left = 0 + 20 = 20
        // top  = 0 + 40 = 40
        const r = getAnchorStyle({ anchor: [0, 0], position: [10, 20], size: [100, 50] }, 2, 800, 400);
        expect(r.left).toBe(20);
        expect(r.top).toBe(40);
    });

    test('scale=2 centered: element size and offsets scale together', () => {
        // elementWidth=200, elementHeight=100
        // left = 800*0.5 - 200*0.5 + 0 = 400 - 100 = 300
        // top  = 400*0.5 - 100*0.5 + 0 = 200 -  50 = 150
        const r = getAnchorStyle({ anchor: [0.5, 0.5], position: [0, 0], size: [100, 50] }, 2, 800, 400);
        expect(r.left).toBe(300);
        expect(r.top).toBe(150);
    });
});

describe('getAnchorStyle — BASE_DESIGN fallback when no parent dimensions given', () => {
    test('falls back to BASE_DESIGN_WIDTH / BASE_DESIGN_HEIGHT', () => {
        // left = 844*0.5 - 100*0.5 = 422 - 50 = 372
        // top  = 390*0.5 -  50*0.5 = 195 - 25 = 170
        const r = getAnchorStyle({ anchor: [0.5, 0.5], position: [0, 0], size: [100, 50] }, 1);
        expect(r.left).toBe(BASE_DESIGN_WIDTH * 0.5 - 50);
        expect(r.top).toBe(BASE_DESIGN_HEIGHT * 0.5 - 25);
    });
});

describe('getAnchorStyle — size from style.width / style.height', () => {
    test('uses style.width and style.height when size is not provided', () => {
        // rawW=200, rawH=100, anchor=[0,0], position=[0,0]
        // left=0, top=0
        const r = getAnchorStyle({ anchor: [0, 0], position: [0, 0], style: { width: 200, height: 100 } }, 1, 800, 400);
        expect(r.left).toBe(0);
        expect(r.top).toBe(0);
    });

    test('style.width/height participates in anchor centering', () => {
        // rawW=200 → elementWidth=200, rawH=100 → elementHeight=100
        // anchor [0.5,0.5]: left = 800*0.5 - 200*0.5 = 400-100=300, top = 400*0.5 - 100*0.5 = 200-50=150
        const r = getAnchorStyle({ anchor: [0.5, 0.5], position: [0, 0], style: { width: 200, height: 100 } }, 1, 800, 400);
        expect(r.left).toBe(300);
        expect(r.top).toBe(150);
    });

    test('always returns position: "absolute"', () => {
        const r = getAnchorStyle({ anchor: [0, 0], position: [0, 0], size: [10, 10] }, 1, 800, 400);
        expect(r.position).toBe('absolute');
    });
});

// ─── resolveStyleReference ────────────────────────────────────────────────────

const STYLES = {
    primaryBtn: { color: 'white', fontSize: 40, fontWeight: 'bold' },
    secondaryBtn: { color: 'grey', fontSize: 20 },
};

describe('resolveStyleReference', () => {
    test('@styles.X → expands to the preset object', () => {
        const config = { id: 'btn', style: '@styles.primaryBtn' };
        const result = resolveStyleReference(STYLES, config);
        expect(result.style).toEqual(STYLES.primaryBtn);
    });

    test('@styles.X → original config fields are preserved', () => {
        const config = { id: 'btn', type: 'button', style: '@styles.primaryBtn' };
        const result = resolveStyleReference(STYLES, config);
        expect(result.id).toBe('btn');
        expect(result.type).toBe('button');
    });

    test('@styles.X → returns a copy of the preset (not the same reference)', () => {
        const config = { id: 'btn', style: '@styles.primaryBtn' };
        const result = resolveStyleReference(STYLES, config);
        expect(result.style).not.toBe(STYLES.primaryBtn);
        expect(result.style).toEqual(STYLES.primaryBtn);
    });

    test('@styles.nonExistent → returns empty style object', () => {
        const config = { id: 'btn', style: '@styles.doesNotExist' };
        const result = resolveStyleReference(STYLES, config);
        expect(result.style).toEqual({});
    });

    test('style is an object (not a string) → returned as-is, no mutation', () => {
        const styleObj = { color: 'red' };
        const config = { id: 'btn', style: styleObj };
        const result = resolveStyleReference(STYLES, config);
        expect(result.style).toBe(styleObj); // same reference
    });

    test('style is a plain string (not @styles.) → returned as-is', () => {
        const config = { id: 'btn', style: 'some-class-name' };
        const result = resolveStyleReference(STYLES, config);
        expect(result.style).toBe('some-class-name');
    });

    test('no style field → config returned unchanged', () => {
        const config = { id: 'btn', type: 'button' };
        const result = resolveStyleReference(STYLES, config);
        expect(result).toBe(config); // same reference — no copy made
    });

    test('does NOT mutate the original config', () => {
        const config = { id: 'btn', style: '@styles.primaryBtn' };
        resolveStyleReference(STYLES, config);
        expect(config.style).toBe('@styles.primaryBtn'); // original unchanged
    });
});

// ─── resolveElementConfig ─────────────────────────────────────────────────────

describe('resolveElementConfig — style reference + asset resolution combined', () => {
    test('@styles ref is expanded and texture URL is resolved', () => {
        const config = { id: 'btn', style: '@styles.primaryBtn', texture: 'icon.png' };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        expect(result.style).toEqual(STYLES.primaryBtn);
        expect(result.texture).toBe(`${BASE_URL}icon.png`);
    });

    test('absolute texture URL is not modified', () => {
        const config = { id: 'img', texture: 'https://cdn.example.com/already.png' };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        expect(result.texture).toBe('https://cdn.example.com/already.png');
    });

    test('src field is resolved like texture', () => {
        const config = { id: 'img', src: 'photo.jpg' };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        expect(result.src).toBe(`${BASE_URL}photo.jpg`);
    });

    test('indicatorTexture field is resolved', () => {
        const config = { id: 'bar', indicatorTexture: 'indicator.png' };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        expect(result.indicatorTexture).toBe(`${BASE_URL}indicator.png`);
    });

    test('states textures are resolved for each state', () => {
        const config = {
            id: 'btn',
            states: {
                normal:  { texture: 'n.png' },
                pressed: { texture: 'p.png' },
            },
        };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        const states = result.states as Record<string, Record<string, unknown>>;
        expect(states.normal.texture).toBe(`${BASE_URL}n.png`);
        expect(states.pressed.texture).toBe(`${BASE_URL}p.png`);
    });

    test('states absolute texture URL is not modified', () => {
        const abs = 'https://cdn.example.com/btn_pressed.png';
        const config = { id: 'btn', states: { pressed: { texture: abs } } };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        const states = result.states as Record<string, Record<string, unknown>>;
        expect(states.pressed.texture).toBe(abs);
    });

    test('layout children are resolved recursively', () => {
        const config = {
            id: 'container',
            layout: [
                { id: 'icon', texture: 'child_icon.png' },
                { id: 'label', style: '@styles.primaryBtn' },
            ],
        };
        const result = resolveElementConfig(STYLES, config, BASE_URL);
        expect(result.layout![0].texture).toBe(`${BASE_URL}child_icon.png`);
        expect(result.layout![1].style).toEqual(STYLES.primaryBtn);
    });

    test('empty baseUrl → textures are not modified', () => {
        const config = { id: 'btn', texture: 'relative.png' };
        const result = resolveElementConfig(STYLES, config, '');
        expect(result.texture).toBe('relative.png');
    });
});

// ─── applyPatches ─────────────────────────────────────────────────────────────

describe('applyPatches', () => {
    test('scalar prop is replaced', () => {
        const comps = { btn: { visible: true } };
        applyPatches(comps, [{ target: { ids: ['btn'] }, props: { visible: false } }]);
        expect(comps.btn.visible).toBe(false);
    });

    test('object prop is deep-merged (existing keys preserved)', () => {
        const comps = { btn: { style: { color: 'red', fontSize: 12 } } };
        applyPatches(comps, [{ target: { ids: ['btn'] }, props: { style: { fontSize: 20 } } }]);
        expect(comps.btn.style).toEqual({ color: 'red', fontSize: 20 });
    });

    test('array prop is replaced entirely (not merged)', () => {
        const comps = { btn: { items: ['a', 'b', 'c'] } };
        applyPatches(comps, [{ target: { ids: ['btn'] }, props: { items: ['x'] } }]);
        expect(comps.btn.items).toEqual(['x']);
    });

    test('null prop is replaced (null is not deep-merged)', () => {
        const comps = { btn: { style: { color: 'red' } } };
        applyPatches(comps, [{ target: { ids: ['btn'] }, props: { style: null } }]);
        expect(comps.btn.style).toBeNull();
    });

    test('patch targeting multiple ids updates all of them', () => {
        const comps = { btn1: { visible: true }, btn2: { visible: true } };
        applyPatches(comps, [{ target: { ids: ['btn1', 'btn2'] }, props: { visible: false } }]);
        expect(comps.btn1.visible).toBe(false);
        expect(comps.btn2.visible).toBe(false);
    });

    test('unknown id — creates new entry in components map', () => {
        const comps: Record<string, Record<string, unknown>> = {};
        applyPatches(comps, [{ target: { ids: ['new_btn'] }, props: { text: 'hello' } }]);
        expect(comps.new_btn).toEqual({ text: 'hello' });
    });

    test('multiple patches applied in order', () => {
        const comps = { btn: { text: 'a', visible: true } };
        applyPatches(comps, [
            { target: { ids: ['btn'] }, props: { text: 'b' } },
            { target: { ids: ['btn'] }, props: { text: 'c', visible: false } },
        ]);
        expect(comps.btn.text).toBe('c');
        expect(comps.btn.visible).toBe(false);
    });

    test('patch without target.ids → skipped', () => {
        const comps = { btn: { text: 'original' } };
        applyPatches(comps, [{ props: { text: 'changed' } }]);
        expect(comps.btn.text).toBe('original');
    });

    test('patch without props → skipped', () => {
        const comps = { btn: { text: 'original' } };
        applyPatches(comps, [{ target: { ids: ['btn'] } }]);
        expect(comps.btn.text).toBe('original');
    });

    test('empty patches array → no change', () => {
        const comps = { btn: { text: 'original' } };
        applyPatches(comps, []);
        expect(comps.btn.text).toBe('original');
    });

    test('returns the same components object reference', () => {
        const comps = { btn: { text: 'a' } };
        const result = applyPatches(comps, [{ target: { ids: ['btn'] }, props: { text: 'b' } }]);
        expect(result).toBe(comps);
    });
});

// ─── resolveComponentAssets ───────────────────────────────────────────────────

describe('resolveComponentAssets', () => {
    test('relative texture → baseUrl prepended', () => {
        const comps = { img: { texture: 'avatar.png' } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img.texture).toBe(`${BASE_URL}avatar.png`);
    });

    test('relative src → baseUrl prepended', () => {
        const comps = { img: { src: 'photo.jpg' } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img.src).toBe(`${BASE_URL}photo.jpg`);
    });

    test('http absolute URL → unchanged', () => {
        const abs = 'http://cdn.example.com/img.png';
        const comps = { img: { texture: abs } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img.texture).toBe(abs);
    });

    test('https absolute URL → unchanged', () => {
        const abs = 'https://cdn.example.com/img.png';
        const comps = { img: { texture: abs } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img.texture).toBe(abs);
    });

    test('empty baseUrl → early return, nothing is changed', () => {
        const comps = { img: { texture: 'relative.png', src: 'relative.jpg' } };
        resolveComponentAssets(comps, '');
        expect(comps.img.texture).toBe('relative.png');
        expect(comps.img.src).toBe('relative.jpg');
    });

    test('multiple components resolved in one call', () => {
        const comps = {
            img1: { texture: 'a.png' },
            img2: { texture: 'b.png' },
        };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.img1.texture).toBe(`${BASE_URL}a.png`);
        expect(comps.img2.texture).toBe(`${BASE_URL}b.png`);
    });

    test('component without texture/src → untouched', () => {
        const comps = { btn: { text: 'click me', visible: true } };
        resolveComponentAssets(comps, BASE_URL);
        expect(comps.btn.text).toBe('click me');
        expect(comps.btn.visible).toBe(true);
    });

    test('mutates in place', () => {
        const comps = { img: { texture: 'icon.png' } };
        const ref = comps.img;
        resolveComponentAssets(comps, BASE_URL);
        expect(ref.texture).toBe(`${BASE_URL}icon.png`);
    });
});

// ─── recursiveProcessConfig ───────────────────────────────────────────────────

describe('recursiveProcessConfig', () => {
    test('element without id → not modified', () => {
        const config: ResolvedConfig = { type: 'text', text: 'hello' };
        const result = recursiveProcessConfig(config, { state: { lbl: { text: 'world' } } });
        expect(result.text).toBe('hello');
    });

    test('id with matching state → field overridden', () => {
        const config: ResolvedConfig = { id: 'lbl', type: 'text', text: 'old' };
        const result = recursiveProcessConfig(config, { state: { lbl: { text: 'new' } } });
        expect(result.text).toBe('new');
    });

    test('style is deep-merged: base fields preserved, server wins on conflict', () => {
        const config: ResolvedConfig = {
            id: 'lbl',
            style: { color: 'red', fontSize: 12 },
        };
        const result = recursiveProcessConfig(config, {
            state: { lbl: { style: { fontSize: 24, fontWeight: 'bold' } } },
        });
        expect(result.style).toEqual({ color: 'red', fontSize: 24, fontWeight: 'bold' });
    });

    test('no base style → server style is applied directly', () => {
        const config: ResolvedConfig = { id: 'lbl', type: 'text' };
        const result = recursiveProcessConfig(config, { state: { lbl: { style: { color: 'blue' } } } });
        expect(result.style).toEqual({ color: 'blue' });
    });

    test('update without style does not wipe existing style', () => {
        const config: ResolvedConfig = { id: 'btn', style: { color: 'green' }, visible: true };
        const result = recursiveProcessConfig(config, { state: { btn: { visible: false } } });
        expect(result.style).toEqual({ color: 'green' });
        expect(result.visible).toBe(false);
    });

    test('does NOT mutate the original config — returns new object', () => {
        const config: ResolvedConfig = { id: 'lbl', text: 'original' };
        const result = recursiveProcessConfig(config, { state: { lbl: { text: 'updated' } } });
        expect(config.text).toBe('original');  // original untouched
        expect(result.text).toBe('updated');   // new object is updated
    });

    test('recursively processes layout children', () => {
        const config: ResolvedConfig = {
            id: 'container',
            layout: [
                { id: 'child', type: 'text', text: 'old' },
            ],
        };
        const result = recursiveProcessConfig(config, { state: { child: { text: 'new' } } });
        expect(result.layout![0].text).toBe('new');
    });

    test('parent and child both updated in single pass', () => {
        const config: ResolvedConfig = {
            id: 'parent',
            visible: true,
            layout: [
                { id: 'child', text: 'old' },
            ],
        };
        const result = recursiveProcessConfig(config, {
            state: {
                parent: { visible: false },
                child:  { text: 'new' },
            },
        });
        expect(result.visible).toBe(false);
        expect(result.layout![0].text).toBe('new');
    });

    test('deep nesting — 3 levels deep', () => {
        const config: ResolvedConfig = {
            id: 'root',
            layout: [{
                id: 'mid',
                layout: [{
                    id: 'leaf',
                    text: 'original',
                }],
            }],
        };
        const result = recursiveProcessConfig(config, { state: { leaf: { text: 'deep updated' } } });
        expect(result.layout![0].layout![0].text).toBe('deep updated');
    });

    test('no layout array → processes only top-level element', () => {
        const config: ResolvedConfig = { id: 'btn', text: 'click', visible: true };
        const result = recursiveProcessConfig(config, { state: { btn: { visible: false } } });
        expect(result.visible).toBe(false);
        expect(result.layout).toBeUndefined();
    });

    test('no matching state for any id → config returned unchanged (values equal)', () => {
        const config: ResolvedConfig = { id: 'btn', text: 'click' };
        const result = recursiveProcessConfig(config, { state: { other: { text: 'nope' } } });
        expect(result.text).toBe('click');
    });
});

// ─── recursiveProcessConfig — server update (GameState) shapes ────────────────
//
// GameState has 3 possible shapes from the server:
//   1. { state: { id: {...} } }  — structured overrides  → processed by this function
//   2. { patches: [...] }        — patch protocol         → IGNORED here (handled by applyPatches before)
//   3. { someId: 'scalar' }     — legacy root-level      → IGNORED here (handled by applyServerDataToChild)

describe('recursiveProcessConfig — server update payload shapes', () => {

    // ── patches-only payload ──────────────────────────────────────────────────

    test('serverData with only patches (no state) → config is not modified', () => {
        const config: ResolvedConfig = { id: 'btn', text: 'original', visible: true };
        const result = recursiveProcessConfig(config, {
            patches: [{ target: { ids: ['btn'] }, props: { text: 'patched' } }],
        });
        // recursiveProcessConfig does NOT process patches — applyPatches handles that separately
        expect(result.text).toBe('original');
        expect(result.visible).toBe(true);
    });

    test('patches + state together → only state is processed, patches are ignored', () => {
        const config: ResolvedConfig = { id: 'btn', text: 'original' };
        const result = recursiveProcessConfig(config, {
            patches: [{ target: { ids: ['btn'] }, props: { text: 'from-patch' } }],
            state:   { btn: { text: 'from-state' } },
        });
        // state wins, patch is ignored
        expect(result.text).toBe('from-state');
    });

    test('patches targeting children → children are not modified (recursiveProcessConfig ignores patches)', () => {
        const config: ResolvedConfig = {
            id: 'container',
            layout: [{ id: 'child', text: 'original' }],
        };
        const result = recursiveProcessConfig(config, {
            patches: [{ target: { ids: ['child'] }, props: { text: 'patched' } }],
        });
        expect(result.layout![0].text).toBe('original');
    });

    // ── legacy root-level scalar payload ──────────────────────────────────────

    test('serverData with root-level legacy scalar → ignored (only state is read)', () => {
        const config: ResolvedConfig = { id: 'score', type: 'text', text: '0' };
        // Legacy format: { score: 'Player 1' } — handled by applyServerDataToChild, NOT here
        const result = recursiveProcessConfig(config, { score: 'Player 1' } as any);
        expect(result.text).toBe('0'); // unchanged
    });

    // ── empty / missing state ─────────────────────────────────────────────────

    test('serverData is empty object → config returned unchanged', () => {
        const config: ResolvedConfig = { id: 'btn', visible: true };
        const result = recursiveProcessConfig(config, {});
        expect(result.visible).toBe(true);
    });

    test('serverData.state is undefined → config returned unchanged', () => {
        const config: ResolvedConfig = { id: 'btn', text: 'hello' };
        const result = recursiveProcessConfig(config, { someOtherKey: 42 } as any);
        expect(result.text).toBe('hello');
    });

    // ── realistic server update field types ───────────────────────────────────

    test('server sends visible:false → element is hidden', () => {
        const config: ResolvedConfig = { id: 'panel', visible: true };
        const result = recursiveProcessConfig(config, { state: { panel: { visible: false } } });
        expect(result.visible).toBe(false);
    });

    test('server sends disabled:true → element is disabled', () => {
        const config: ResolvedConfig = { id: 'btn', disabled: false };
        const result = recursiveProcessConfig(config, { state: { btn: { disabled: true } } });
        expect(result.disabled).toBe(true);
    });

    test('server sends texture update on image element', () => {
        const config: ResolvedConfig = { id: 'avatar', type: 'image', texture: 'default.png' };
        const result = recursiveProcessConfig(config, {
            state: { avatar: { texture: 'https://cdn.example.com/player.png' } },
        });
        expect(result.texture).toBe('https://cdn.example.com/player.png');
    });

    test('server sends text update on text element', () => {
        const config: ResolvedConfig = { id: 'score', type: 'text', text: '0' };
        const result = recursiveProcessConfig(config, { state: { score: { text: 999 } } });
        expect(result.text).toBe(999);
    });

    test('simultaneous update: visible + disabled + style + text in one payload', () => {
        const config: ResolvedConfig = {
            id: 'btn',
            type: 'button',
            visible: true,
            disabled: false,
            text: 'old',
            style: { color: 'white', fontSize: 14 },
        };
        const result = recursiveProcessConfig(config, {
            state: {
                btn: {
                    visible: false,
                    disabled: true,
                    text: 'new',
                    style: { color: 'red' },
                },
            },
        });
        expect(result.visible).toBe(false);
        expect(result.disabled).toBe(true);
        expect(result.text).toBe('new');
        // style deep-merged
        expect(result.style).toEqual({ color: 'red', fontSize: 14 });
    });

    test('realistic AVATAR_GROUP update: server sends player data for all children', () => {
        const avatarGroup: ResolvedConfig = {
            id: 'avatar_group',
            visible: false,
            layout: [
                { id: 'player_bg', texture: 'player1.png', style: {} },
                { id: 'avatar',    texture: '' },
                { id: 'name',      text: 'PLAYER NAME', style: { color: 'white', fontSize: 8 } },
                { id: 'money',     text: '',             style: { color: 'white', fontSize: 8 } },
            ],
        };
        const serverUpdate: GameState = {
            state: {
                avatar_group: { visible: true },
                player_bg:    { texture: 'player2.png' },
                avatar:       { texture: 'https://cdn.example.com/8_ball.png' },
                name:         { text: 'JOHN', style: { color: '#ff0000' } },
                money:        { text: '1500' },
            },
        };
        const result = recursiveProcessConfig(avatarGroup, serverUpdate);
        const [bg, av, nm, mn] = result.layout!;

        expect(result.visible).toBe(true);                                       // parent toggled
        expect(bg.texture).toBe('player2.png');                                  // texture updated
        expect(av.texture).toBe('https://cdn.example.com/8_ball.png');           // texture updated
        expect(nm.text).toBe('JOHN');                                            // text updated
        expect(nm.style).toEqual({ color: '#ff0000', fontSize: 8 });            // style deep-merged
        expect(mn.text).toBe('1500');                                            // text updated
        expect(mn.style).toEqual({ color: 'white', fontSize: 8 });              // style untouched
    });
});



