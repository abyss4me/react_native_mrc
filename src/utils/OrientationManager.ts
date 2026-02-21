import * as ScreenOrientation from 'expo-screen-orientation';

export const setOrientation = async (orientationType: string) => {
    switch (orientationType) {
        case 'landscape':
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            break;
        case 'portrait':
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            break;
        case 'landscape-left':
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
            break;
        default:
            console.warn('Unknown orientation:', orientationType);
    }
};