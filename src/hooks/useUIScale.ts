// src/hooks/useUIScale.ts
import { useWindowDimensions } from 'react-native';
import { BASE_DESIGN_WIDTH, BASE_DESIGN_HEIGHT } from '../constants';

interface UIScale {
    width: number;
    height: number;
    uiScale: number;
}

/**
 * Calculates a uniform UI scale factor based on the device's screen dimensions
 * relative to the base design canvas size.
 */
const useUIScale = (): UIScale => {
    const { width, height } = useWindowDimensions();
    const scaleX = width / BASE_DESIGN_WIDTH;
    const scaleY = height / BASE_DESIGN_HEIGHT;
    const uiScale = Math.min(scaleX, scaleY);
    return { width, height, uiScale };
};

export default useUIScale;

