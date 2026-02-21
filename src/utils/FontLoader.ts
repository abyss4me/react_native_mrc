// src/utils/FontLoader.ts
import * as Font from 'expo-font';

export const preloadRemoteFonts = async (config: any) => {
    const fonts = config.fonts; // Get the object from the root
    if (!fonts) return Promise.resolve();

    const fontPromises = Object.keys(fonts).map(familyName => {
        const url = fonts[familyName];
        console.log(`[FontLoader] Loading: ${familyName} from ${url}`);

        return Font.loadAsync({
            [familyName]: url,
        });
    });

    return Promise.all(fontPromises);
};