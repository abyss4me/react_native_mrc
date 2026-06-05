/**
 * src/utils/ClientLibLoader.ts
 * Dynamically fetches and evaluates the PWMP client library from a remote URL.
 */

import * as FileSystem from 'expo-file-system/legacy';
import {PWMP_CLIENT_URL, PWMP_LIB_NAME} from '../constants';

let cachedPWMP: any = null;

/**
 * Loads the PWMP constructor from the remote URL using expo-file-system,
 * which uses the native download stack and bypasses JS-layer network restrictions.
 * Result is cached — the download happens only once per app session.
 * Throws an error if the remote load fails.
 */
export async function loadPwmpClient(): Promise<any> {
    if (cachedPWMP) return cachedPWMP;

    const localUri = FileSystem.cacheDirectory + PWMP_LIB_NAME;

    console.log(`[ClientLibLoader] Downloading PWMP client from: ${PWMP_CLIENT_URL}`);
    const { status } = await FileSystem.downloadAsync(PWMP_CLIENT_URL, localUri);
    if (status !== 200) throw new Error(`[ClientLibLoader] HTTP ${status} — failed to download PWMP client`);

    const src = await FileSystem.readAsStringAsync(localUri);
    if (!src) throw new Error('[ClientLibLoader] Downloaded file is empty');

    // Evaluate the UMD bundle and capture its exports
    const mod: { exports: any } = { exports: {} };
    const fn = new Function('module', 'exports', src);
    fn(mod, mod.exports);
    const pwmp = mod.exports?.PWMP ?? mod.exports;
    if (!pwmp) throw new Error('[ClientLibLoader] PWMP export not found in downloaded bundle');

    console.log('[ClientLibLoader] PWMP client loaded successfully.');
    cachedPWMP = pwmp;
    return cachedPWMP;
}
