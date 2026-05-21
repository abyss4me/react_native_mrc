import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './ComponentRegistry';

export const Container = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }: any) => {
    const { serverData } = useNetwork();
    if (!config.layout) return null;

    const anchorStyle = getAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const [w, h] = config.size || [0, 0];

    // If container has a size, calculate it. Otherwise, pass down its parent's width/height!
    const width = w ? w * globalScale : parentWidth;
    const height = h ? h * globalScale : parentHeight;

    // For styling the container itself, if it has no defined size, we use undefined so it can flex/wrap naturally.
    const styleWidth = w ? width : undefined;
    const styleHeight = h ? height : undefined;

    // Transformations in RN are an array of objects
    const transform = [];
    if (config.rotate) transform.push({ rotate: `${config.rotate}deg` });
    // Scale is already factored into width/height and globalScale,
    // but if the container needs additional scaling:
    // transform.push({ scale: 1 });

    return (
        <View style={[
            anchorStyle,
            {
                width: styleWidth,
                height: styleHeight,
                position: 'absolute',
                // Handling container opacity and background
                backgroundColor: config.style?.backgroundColor || 'transparent',
                opacity: config.style?.opacity ?? 1,
                transform: transform.length > 0 ? transform : undefined,

                // Flex behavior defaults
                flexDirection: config.style?.flexDirection || 'column',
            },
            config.style // Spread the rest of the style (justifyContent, alignItems, gap, flexWrap, padding, etc.)
        ]}>
            <>{config.layout.map((el: any, i: number) => {
                const Component = ComponentMap[el.type as keyof typeof ComponentMap];
                if (!Component) return null;

                const childConfig = { ...el };

                // Data injection from the server (Data Binding)
                if (serverData?.components?.[childConfig.id]) {
                    const updates = serverData.components[childConfig.id];
                    const baseStyle = childConfig.style;
                    Object.assign(childConfig, updates);
                    // Deep-merge style so template/layout base styles are preserved
                    if (baseStyle) {
                        childConfig.style = { ...baseStyle, ...(updates.style || {}) };
                    }
                }

                if (childConfig.id && serverData?.[childConfig.id]) {
                     if(childConfig.type === 'text') childConfig.content = serverData[childConfig.id];
                     if(childConfig.type === 'image') childConfig.src = serverData[childConfig.id];
                }

                return (
                    <Component
                        key={i}
                        config={childConfig}
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