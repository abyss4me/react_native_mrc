import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import { ENGINE_VERSION } from '../constants';

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
export const checkLayoutCompatibility = (layout: any): boolean => {
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

export const preloadAssets = async (layouts: any) => {
    const imagesToPreload: string[] = [];
    const resolveTexture = (textureStr: string, baseUrl: string) => {
        if (!textureStr) return null;

        if (textureStr.startsWith('http://') || textureStr.startsWith('https://')) {
            return textureStr;
        }

        return `${baseUrl}${textureStr}`;
    };

    const collectTextures = (element: any) => {
        if (!element) return;

        const baseUrl = layouts?.settings?.assetsBaseUrl || '';

        // Resolve element's main texture
        if (element.texture) {
            const resolvedTexture = resolveTexture(element.texture, baseUrl);
            imagesToPreload.push(resolvedTexture);
            element.texture = resolvedTexture; // Update JSON reference to absolute URL
        }

        // Resolving URL for images that might use "src"
        if (element.src) {
            const resolvedSrc = resolveTexture(element.src, baseUrl);
            imagesToPreload.push(resolvedSrc);
            element.src = resolvedSrc;
        }

        if (element.states) {
            Object.values(element.states).forEach((state: any) => {
                if (state.texture) {
                    const resolvedTexture = resolveTexture(state.texture, baseUrl);
                    imagesToPreload.push(resolvedTexture);
                    state.texture = resolvedTexture; // Update state JSON reference
                }
            });
        }

        if (element.rows && Array.isArray(element.rows)) {
            element.rows.forEach((row: any) => {
                if (Array.isArray(row)) {
                    row.forEach((keyItem: any) => {
                        if (typeof keyItem === 'object' && keyItem !== null) {
                            collectTextures(keyItem);
                        }
                    });
                }
            });
        }

        if (element.layout) {
            element.layout.forEach(collectTextures);
        }
    };

    Object.values(layouts.screens).forEach((screen: any) => {
        screen.layout?.forEach(collectTextures);
    });
    
    if (layouts.background && layouts.background.texture) {
        const resolvedTexture = resolveTexture(layouts.background.texture, layouts?.settings?.assetsBaseUrl || '');
        imagesToPreload.push(resolvedTexture);
        layouts.background.texture = resolvedTexture; // Update global background JSON reference
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
            // For external URLs
            return Image.prefetch(image);
        } else {
            // For local ones (if you pass through require)
            return Asset.fromModule(image).downloadAsync();
        }
    });

    return Promise.all(cacheImages);
};
