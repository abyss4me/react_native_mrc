import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './index'; // Circular import is resolved via index.ts

export const Container = ({ config, globalScale = 1, onInteract }: any) => {
    const { serverData } = useNetwork();
    if (!config.layout) return null;

    const anchorStyle = getAnchorStyle(config, globalScale);

    const [w, h] = config.size || [0, 0];

    const width = w * globalScale;
    const height = h * globalScale;

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
                width: width || undefined, // undefined allows children to stretch the container
                height: height || undefined,
                position: 'absolute',
                // Handling container opacity and background
                backgroundColor: config.style?.backgroundColor || 'transparent',
                opacity: config.style?.opacity ?? 1,
                transform: transform.length > 0 ? transform : undefined,

                // Flex behavior if specified in JSON
                flexDirection: config.style?.flexDirection || 'column',
                justifyContent: config.style?.justifyContent,
                alignItems: config.style?.alignItems,
            }
        ]}>
            {config.layout.map((el: any, i: number) => {
                const Component = ComponentMap[el.type as keyof typeof ComponentMap];
                if (!Component) return null;

                const childConfig = { ...el };

                // Data injection from the server (Data Binding)
                if (serverData?.components?.[childConfig.id]) {
                    Object.assign(childConfig, serverData.components[childConfig.id]);
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
            })}
        </View>
    );
};