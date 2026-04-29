import { Image } from 'react-native';
import { Asset } from 'expo-asset';

export const preloadAssets = async (layouts: any) => {
    const imagesToPreload: string[] = [];

    const collectTextures = (element: any) => {
        if (!element) return;

        if (element.texture) imagesToPreload.push(element.texture);
        if (element.textureFocused) imagesToPreload.push(element.textureFocused);
        if (element.textureDisabled) imagesToPreload.push(element.textureDisabled);

        if (element.states) {
            Object.values(element.states).forEach((state: any) => {
                if (state.texture) {
                    imagesToPreload.push(state.texture);
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
        imagesToPreload.push(layouts.background.texture);
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
