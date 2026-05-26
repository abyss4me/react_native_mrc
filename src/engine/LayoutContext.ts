import { createContext, useContext } from 'react';
import { LayoutConfig, LayoutSettings } from '../types/LayoutTypes';

/* This file defines the LayoutContext and the useLayout hook,
   which provide access to the current layout configuration and settings throughout the app.
*/

export interface LayoutContextType {
    layouts: LayoutConfig | null;
    settings: LayoutSettings;
}

// Context
export const LayoutContext = createContext<LayoutContextType>({
    layouts: null,
    settings: {},
});

// Hook

/**
 * Returns the current layout config and resolved settings.
 */
export const useLayout = (): LayoutContextType => useContext(LayoutContext);


