import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useServerData } from '../engine/NetworkContext';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';
import { ComponentMap } from './ComponentRegistry';
import { ElementConfig } from '../types/LayoutTypes';
import { InteractPayload } from './Button';
import { applyServerDataToChild } from '../utils/applyServerData';

interface ContainerConfig {
    type: 'container';
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    rotation?: number;
    visible?: boolean;
    layout?: ElementConfig[];
    style?: ViewStyle;
}

interface ContainerProps {
    config: ContainerConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

export const Container = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }: ContainerProps) => {
    const { serverData } = useServerData();
    if (!config.layout) return null;

    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const [w, h] = config.size || [0, 0];

    // Pass parent dimensions down when no explicit size is set, so children can use them for anchoring.
    const width = w ? w * globalScale : parentWidth;
    const height = h ? h * globalScale : parentHeight;

    // undefined size lets the container flex/wrap naturally when no explicit size is defined.
    const styleWidth = w ? width : undefined;
    const styleHeight = h ? height : undefined;

    const transform = rotationTransform(config.rotation);

    return (
        <View style={[
            anchorStyle,
            {
                width: styleWidth,
                height: styleHeight,
                position: 'absolute',
                backgroundColor: config.style?.backgroundColor || 'transparent',
                opacity: config.style?.opacity ?? 1,
                transform: transform.length > 0 ? transform : undefined,
                flexDirection: config.style?.flexDirection || 'column',
            },
            config.style
        ]}>
            <>{config.layout.map((el: ElementConfig, i: number) => {
                const Component = ComponentMap[el.type as keyof typeof ComponentMap];
                if (!Component) return null;

                const childConfig = { ...el } as Record<string, unknown>;
                applyServerDataToChild(childConfig, serverData);

                return (
                    <Component
                        key={i}
                        config={childConfig as unknown as ElementConfig}
                        globalScale={globalScale}
                        onInteract={onInteract}
                        parentWidth={width}
                        parentHeight={height}
                    />
                );
            })}</>
        </View>
    );
};