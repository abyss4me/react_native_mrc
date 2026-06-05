import React from 'react';
import { ElementConfig } from '../types/LayoutTypes';
import { InteractPayload } from './Button';

export interface ComponentProps {
    config: ElementConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

export const ComponentMap: Record<string, React.FC<ComponentProps>> = {};
