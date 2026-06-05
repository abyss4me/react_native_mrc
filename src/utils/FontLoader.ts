// src/utils/FontLoader.ts
import * as Font from 'expo-font';
import { LayoutConfig } from '../types/LayoutTypes';

export const preloadRemoteFonts = async (config: LayoutConfig): Promise<void[]> => {
    const fonts = config.theme?.fonts;
    if (!fonts) return Promise.resolve([]);

    const fontPromises = Object.keys(fonts).map(familyName => {
        const url = fonts[familyName];
        console.log(`[FontLoader] Loading: ${familyName} from ${url}`);

        return Font.loadAsync({
            [familyName]: url,
        });
    });

    return Promise.all(fontPromises);
};