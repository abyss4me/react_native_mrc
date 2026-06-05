import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import { ENGINE_VERSION } from '../constants';
import { LayoutConfig, ElementConfig, ButtonConfig, ButtonStateConfig, ScreenConfig } from '../types/LayoutTypes';

/**
 * Compares two version strings (e.g. "1.2.3").
 * Returns true if engineVersion >= requiredVersion.
 */
const isVerCompatible = (engineVersion: string, requiredVersion: string): boolean => {
    const parse = (v: string) => v.split('.').map(Number);
    const [eMaj, eMin, ePatch] = parse(engineVersion);
    const [rMaj, rMin, rPatch] = parse(requiredVersion);

    if (eMaj !== rMaj) return eMaj > rMaj;
    if (eMin !== rMin) return eMin > rMin;
    return ePatch >= rPatch;
};

/**
 * Validates that the current engine version satisfies the layout's minClientVersion.
 * Returns true if compatible, false if the app needs an update.
 */
export const checkLayoutCompatibility = (layout: LayoutConfig): boolean => {
    const minClientVersion: string | undefined = layout?.minClientVersion;
    if (!minClientVersion) return true; // No restriction defined — allow

    if (!isVerCompatible(ENGINE_VERSION, minClientVersion)) {
        console.warn(
            `[Layout] Incompatible — engine v${ENGINE_VERSION} < required v${minClientVersion}.`
        );
        return false;
    }

    console.log(`[Layout] Compatibility OK — engine v${ENGINE_VERSION} >= required v${minClientVersion}`);
    return true;
};

export const preloadAssets = async (layouts: LayoutConfig) => {
    const imagesToPreload: string[] = [];
    const resolveTexture = (textureStr: string, baseUrl: string) => {
        if (!textureStr) return null;

        if (textureStr.startsWith('http://') || textureStr.startsWith('https://')) {
            return textureStr;
        }

        return `${baseUrl}${textureStr}`;
    };

    const collectTextures = (element: ElementConfig) => {
        if (!element) return;

        const baseUrl = layouts?.settings?.assetsBaseUrl || '';
        const btn = element as ButtonConfig;

        // Resolve element's main texture
        if (btn.texture) {
            const resolvedTexture = resolveTexture(btn.texture, baseUrl);
            imagesToPreload.push(resolvedTexture);
            btn.texture = resolvedTexture;
        }

        // Resolving URL for images that might use "src"
        const imgEl = element as { src?: string };
        if (imgEl.src) {
            const resolvedSrc = resolveTexture(imgEl.src, baseUrl);
            imagesToPreload.push(resolvedSrc);
            imgEl.src = resolvedSrc;
        }

        if (btn.states) {
            Object.values(btn.states).forEach((state: ButtonStateConfig | undefined) => {
                if (state?.texture) {
                    const resolvedTexture = resolveTexture(state.texture, baseUrl);
                    imagesToPreload.push(resolvedTexture);
                    state.texture = resolvedTexture;
                }
            });
        }

        const kbEl = element as { rows?: (string | { id?: string; texture?: string })[][] };
        if (kbEl.rows && Array.isArray(kbEl.rows)) {
            kbEl.rows.forEach((row) => {
                if (Array.isArray(row)) {
                    row.forEach((keyItem) => {
                        if (typeof keyItem === 'object' && keyItem !== null) {
                            collectTextures(keyItem as ElementConfig);
                        }
                    });
                }
            });
        }

        if (btn.layout) {
            btn.layout.forEach(collectTextures);
        }
    };

    Object.values(layouts.screens ?? {}).forEach((screen) => {
        const s = screen as ScreenConfig;
        s.layout?.forEach(collectTextures);
        // Auto mode: collect from per-orientation layout arrays
        s.layouts?.landscape?.forEach(collectTextures);
        s.layouts?.portrait?.forEach(collectTextures);
    });

    Object.values(layouts.screens ?? {}).forEach((screen) => {
        const s = screen as ScreenConfig;
        if (s?.background) {
            collectTextures(s.background as unknown as ElementConfig);
        }
    });
    
    const themeBg = layouts.theme?.background;
    if (themeBg && typeof themeBg === 'object' && themeBg.texture) {
        const resolvedTexture = resolveTexture(themeBg.texture, layouts?.settings?.assetsBaseUrl || '');
        imagesToPreload.push(resolvedTexture);
        themeBg.texture = resolvedTexture;
    }

    //resolve for templates
    if (layouts.templates) {
        for (let el in layouts.templates) {
            collectTextures(layouts.templates[el]);
        }

    }

    // Remove duplicates
    const uniqueImages = Array.from(new Set(imagesToPreload.filter(img => img)));

    const cacheImages = uniqueImages.map(image => {
        if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('https'))) {
            // For external URLs — catch individually so one 404 doesn't abort the rest
            return Image.prefetch(image).catch(() => {
                console.warn(`[AssetsLoader] Failed to prefetch: ${image}`);
            });
        } else {
            // For local ones (if you pass through require)
            return Asset.fromModule(image).downloadAsync();
        }
    });

    return Promise.all(cacheImages);
};
