import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNetwork } from '../engine/NetworkContext';
import { getAnchorStyle } from '../engine/layoutUtils';
import { ComponentMap } from './index'; // Циклічний імпорт вирішується через index.ts

export const Container = ({ config, globalScale = 1, onInteract }: any) => {
    const { serverData } = useNetwork();
    if (!config.layout) return null;

    const anchorStyle = getAnchorStyle(config, globalScale);
    const width = (config.size?.w || 0) * globalScale;
    const height = (config.size?.h || 0) * globalScale;

    // Трансформації в RN - це масив об'єктів
    const transform = [];
    if (config.rotate) transform.push({ rotate: `${config.rotate}deg` });
    // Scale вже враховано в width/height і globalScale,
    // але якщо контейнер треба скейлити додатково:
    // transform.push({ scale: 1 });

    return (
        <View style={[
            anchorStyle,
            {
                width: width || undefined, // undefined дозволяє дітям розтягувати контейнер
                height: height || undefined,
                position: 'absolute',
                // Обробка прозорості та бекграунду контейнера
                backgroundColor: config.style?.backgroundColor || 'transparent',
                opacity: config.style?.opacity ?? 1,
                transform: transform.length > 0 ? transform : undefined,

                // Flex поведінка, якщо вказана в JSON
                flexDirection: config.style?.flexDirection || 'column',
                justifyContent: config.style?.justifyContent,
                alignItems: config.style?.alignItems,
            }
        ]}>
            {config.layout.map((el: any, i: number) => {
                const Component = ComponentMap[el.type as keyof typeof ComponentMap];
                if (!Component) return null;

                const childConfig = { ...el };

                // Ін'єкція даних з сервера (Data Binding)
                if (serverData?.components?.[childConfig.id]) {
                    Object.assign(childConfig, serverData.components[childConfig.id]);
                }
                
                // Старий формат байндінгу (для сумісності)
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
                    />
                );
            })}
        </View>
    );
};