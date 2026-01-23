import { Image } from 'react-native';
import { Asset } from 'expo-asset';

export const preloadAssets = async (layouts: any) => {
    const imagesToPreload: string[] = [];

    // Збираємо всі URL та шляхи до текстур із вашого JSON
    Object.values(layouts.screens).forEach((screen: any) => {
        screen.layout?.forEach((el: any) => {

            if (el.texture) imagesToPreload.push(el.texture);
            if (el.textureFocused) imagesToPreload.push(el.textureFocused);
            if (el.textureDisabled) imagesToPreload.push(el.textureDisabled);
            
            // Якщо є вкладений layout (кнопки в кнопках)
            el.layout?.forEach((child: any) => {
                if (child.texture) imagesToPreload.push(child.texture);
            });
        });
    });

    // Видаляємо дублікати
    const uniqueImages = Array.from(new Set(imagesToPreload));

    const cacheImages = uniqueImages.map(image => {
        if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('https'))) {
            // Для зовнішніх URL
            return Image.prefetch(image);
        } else {
            // Для локальних (якщо передаєте через require)
            // return Asset.fromModule(image).downloadAsync();
            return Promise.resolve(); 
        }
    });

    return Promise.all(cacheImages);
};