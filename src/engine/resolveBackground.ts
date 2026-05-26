// src/engine/resolveBackground.ts

interface BgResult {
    bgSource: { uri: string } | null;
    bgColor: string;
}

const isAbsoluteUrl = (url: string): boolean =>
    url.startsWith('http://') || url.startsWith('https://');

const resolveBgTexture = (texture: string, baseUrl: string): string =>
    isAbsoluteUrl(texture) ? texture : `${baseUrl}${texture}`;

const resolveBg = (bg: any, baseUrl: string): BgResult => {
    if (typeof bg === 'string') {
        if (isAbsoluteUrl(bg)) return { bgSource: { uri: bg }, bgColor: '#000' };
        return { bgSource: null, bgColor: bg };
    }
    if (typeof bg === 'object' && bg?.texture) {
        return { bgSource: { uri: resolveBgTexture(bg.texture, baseUrl) }, bgColor: '#000' };
    }
    return { bgSource: null, bgColor: '#000' };
};

/**
 * Resolves background source and color with priority:
 * Screen-specific → Global → Fallback (black).
 */
const resolveBackground = (
    screenBg: any,
    globalBg: any,
    baseUrl: string
): BgResult => {
    if (screenBg) return resolveBg(screenBg, baseUrl);
    if (globalBg) return resolveBg(globalBg, baseUrl);
    return { bgSource: null, bgColor: '#000' };
};

export default resolveBackground;

