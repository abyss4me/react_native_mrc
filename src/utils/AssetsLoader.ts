import { Image } from 'react-native';
import { Asset } from 'expo-asset';

export const preloadAssets = async (layouts: any) => {
    const imagesToPreload: string[] = [];

    // Collect all URLs and paths to textures from your JSON
    Object.values(layouts.screens).forEach((screen: any) => {
        screen.layout?.forEach((el: any) => {

            if (el.texture) imagesToPreload.push(el.texture);
            if (el.textureFocused) imagesToPreload.push(el.textureFocused);
            if (el.textureDisabled) imagesToPreload.push(el.textureDisabled);
            
            // If there is a nested layout (buttons within buttons)
            el.layout?.forEach((child: any) => {
                if (child.texture) imagesToPreload.push(child.texture);
            });
        });
    });

    // Remove duplicates
    const uniqueImages = Array.from(new Set(imagesToPreload));

    const cacheImages = uniqueImages.map(image => {
        if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('https'))) {
            // For external URLs
            return Image.prefetch(image);
        } else {
            // For local ones (if you pass through require)
            // return Asset.fromModule(image).downloadAsync();
            return Promise.resolve(); 
        }
    });

    return Promise.all(cacheImages);
};