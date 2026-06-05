/**
 * Unit tests for AssetsLoader.ts — checkLayoutCompatibility
 *
 * The function has two logical layers:
 *   1. isVerCompatible(engineVersion, requiredVersion) — private semver comparison
 *   2. checkLayoutCompatibility(layout)               — exported guard that reads
 *      ENGINE_VERSION from constants and layout.minClientVersion from the config
 *
 * ENGINE_VERSION is mocked so tests are not coupled to the real value in constants.ts.
 * Each describe block re-mocks the engine version to the value under test.
 *
 * Semver comparison rules (matches isVerCompatible implementation):
 *   - MAJOR differs → higher MAJOR wins, regardless of MINOR/PATCH
 *   - MAJOR equal, MINOR differs → higher MINOR wins, regardless of PATCH
 *   - MAJOR+MINOR equal → PATCH: engine >= required  → compatible
 */

// Mock native/expo deps that AssetsLoader imports — they are not needed for checkLayoutCompatibility
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('react-native', () => ({
    Image: { prefetch: jest.fn(() => Promise.resolve()) },
    StyleSheet: { create: (s: any) => s },
}));

import { checkLayoutCompatibility } from '../src/utils/AssetsLoader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const layout = (minClientVersion?: string) => ({ minClientVersion } as any);

/** Re-mock ENGINE_VERSION for a single describe block. */
const mockEngineVersion = (version: string) => {
    jest.mock('../src/constants', () => ({
        ...jest.requireActual('../src/constants'),
        ENGINE_VERSION: version,
    }));
};

// ─── No minClientVersion (unrestricted layouts) ───────────────────────────────

describe('no minClientVersion — always compatible', () => {
    test('minClientVersion is undefined → true', () => {
        expect(checkLayoutCompatibility(layout(undefined))).toBe(true);
    });

    test('minClientVersion is empty string → true (falsy guard)', () => {
        expect(checkLayoutCompatibility(layout(''))).toBe(true);
    });

    test('layout object is empty → true', () => {
        expect(checkLayoutCompatibility({} as any)).toBe(true);
    });

    test('layout is null-ish (optional chaining guard) → true', () => {
        expect(checkLayoutCompatibility(null as any)).toBe(true);
    });
});

// ─── MAJOR version comparison ─────────────────────────────────────────────────

describe('MAJOR version comparison (ENGINE_VERSION = "1.0.0")', () => {
    // ENGINE_VERSION = "1.0.0" from constants — no mock needed for these

    test('engine 1.x.x >= required 1.0.0 → compatible', () => {
        expect(checkLayoutCompatibility(layout('1.0.0'))).toBe(true);
    });

    test('required MAJOR higher than engine → incompatible', () => {
        // 1.0.0 < 2.0.0
        const result = checkLayoutCompatibility(layout('2.0.0'));
        expect(result).toBe(false);
    });

    test('required MAJOR lower than engine → compatible (even if MINOR/PATCH higher)', () => {
        // Simulated via a mocked higher engine version
        // We cannot change ENGINE_VERSION at runtime here — tested via isVerCompatible
        // indirectly through the mock in next describe blocks
        expect(checkLayoutCompatibility(layout('0.9.9'))).toBe(true);
    });
});

// ─── Engine 2.3.5 — full semver matrix ───────────────────────────────────────

describe('engine version "2.3.5" — full semver matrix', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '2.3.5',
        }));
    });

    afterEach(() => {
        jest.resetModules();
    });

    const compat = (min: string) => {
        // Re-require after mock so ENGINE_VERSION is picked up
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        return fn(layout(min));
    };

    // ── MAJOR ────────────────────────────────────────────────────────────────
    test('required MAJOR < engine MAJOR → compatible (1.x.x < 2.x.x)', () => {
        expect(compat('1.99.99')).toBe(true);
    });

    test('required MAJOR > engine MAJOR → incompatible (3.0.0 > 2.x.x)', () => {
        expect(compat('3.0.0')).toBe(false);
    });

    // ── MINOR (MAJOR equal) ───────────────────────────────────────────────────
    test('required MINOR < engine MINOR → compatible (2.2.x < 2.3.x)', () => {
        expect(compat('2.2.99')).toBe(true);
    });

    test('required MINOR > engine MINOR → incompatible (2.4.0 > 2.3.x)', () => {
        expect(compat('2.4.0')).toBe(false);
    });

    // ── PATCH (MAJOR+MINOR equal) ─────────────────────────────────────────────
    test('required PATCH < engine PATCH → compatible (2.3.4 < 2.3.5)', () => {
        expect(compat('2.3.4')).toBe(true);
    });

    test('required PATCH = engine PATCH → compatible (2.3.5 == 2.3.5)', () => {
        expect(compat('2.3.5')).toBe(true);
    });

    test('required PATCH > engine PATCH → incompatible (2.3.6 > 2.3.5)', () => {
        expect(compat('2.3.6')).toBe(false);
    });
});

// ─── Edge: MAJOR lower but MINOR/PATCH much higher ───────────────────────────

describe('semver precedence — MAJOR wins over MINOR/PATCH', () => {
    beforeEach(() => { jest.resetModules(); });
    afterEach(() => { jest.resetModules(); });

    test('engine 2.0.0 vs required 1.99.99 → compatible (MAJOR 2 > 1)', () => {
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '2.0.0',
        }));
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        expect(fn(layout('1.99.99'))).toBe(true);
    });

    test('engine 1.0.0 vs required 1.0.99 → incompatible (same MAJOR+MINOR, PATCH higher)', () => {
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '1.0.0',
        }));
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        expect(fn(layout('1.0.99'))).toBe(false);
    });

    test('engine 1.2.0 vs required 1.1.99 → compatible (MINOR 2 > 1)', () => {
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '1.2.0',
        }));
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        expect(fn(layout('1.1.99'))).toBe(true);
    });
});

// ─── Boundary: exact version match ───────────────────────────────────────────

describe('exact version match — always compatible', () => {
    const versions = ['1.0.0', '0.0.1', '10.20.30', '0.1.0', '3.0.0'];

    beforeEach(() => { jest.resetModules(); });
    afterEach(() => { jest.resetModules(); });

    versions.forEach(v => {
        test(`engine ${v} vs required ${v} → compatible`, () => {
            jest.mock('../src/constants', () => ({
                ...jest.requireActual('../src/constants'),
                ENGINE_VERSION: v,
            }));
            const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
            expect(fn(layout(v))).toBe(true);
        });
    });
});

// ─── console output ───────────────────────────────────────────────────────────

describe('console output', () => {
    beforeEach(() => { jest.resetModules(); });
    afterEach(() => { jest.resetModules(); });

    test('incompatible → console.warn is called', () => {
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '1.0.0',
        }));
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        fn(layout('2.0.0'));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('Incompatible');
        warnSpy.mockRestore();
    });

    test('compatible with minClientVersion → console.log is called', () => {
        jest.mock('../src/constants', () => ({
            ...jest.requireActual('../src/constants'),
            ENGINE_VERSION: '1.0.0',
        }));
        const { checkLayoutCompatibility: fn } = require('../src/utils/AssetsLoader');
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        fn(layout('1.0.0'));

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0][0]).toContain('OK');
        logSpy.mockRestore();
    });

    test('no minClientVersion → neither warn nor log is called', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const logSpy  = jest.spyOn(console, 'log').mockImplementation(() => {});

        checkLayoutCompatibility(layout(undefined));

        expect(warnSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
        logSpy.mockRestore();
    });
});


