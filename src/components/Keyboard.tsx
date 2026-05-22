import React from 'react';
import { View } from 'react-native';
import { getAnchorStyle } from '../engine/LayoutUtils';
import { Button } from './Button';
import { useNetwork } from '../engine/NetworkContext';

export const Keyboard = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }: any) => {

    const { serverData } = useNetwork();

    const rows = config.rows || [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M", "⌫"]
    ];

    const [w, h] = config.keySize || [40, 50];

    const keySize: [number, number] = [w, h];

    const gapX = config.gapX !== undefined ? config.gapX * globalScale : 4 * globalScale;
    const gapY = config.gapY !== undefined ? config.gapY * globalScale : 5 * globalScale;

    // Size of the entire keyboard block
    const [containerW, containerH] = config.size || [0, 0];
    const width = containerW ? containerW * globalScale : undefined;
    const height = containerH ? containerH * globalScale : undefined;

    const [anchorX, anchorY] = config.anchor || [0, 0];
    const justifyContentY = anchorY === 0 ? 'flex-start' : (anchorY === 1 || anchorY > 0.5 ? 'flex-end' : 'center');

    const anchorStyle = getAnchorStyle(config, globalScale, parentWidth, parentHeight);
    return (
        <View style={[
            anchorStyle,
            {
                width,
                height,
                position: 'absolute',
                // Flexbox for centering the keyboard
                alignItems: 'center',
                justifyContent: justifyContentY,
                gap: gapY // gap works in new versions of RN
            }
        ]}>
            <>{rows.map((row, i) => (
                <View
                    key={i} 
                    style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'center', 
                        gap: gapX, // Gaps between buttons
                        width: '100%'
                    }}
                >
                    <>{row.map((keyItem, j) => {
                        const isObj = typeof keyItem === 'object' && keyItem !== null;
                        const keyStr = isObj ? (keyItem.id || `key_${i}_${j}`) : keyItem;
                        const serverUpdate = (serverData?.components && serverData.components[keyStr]) || {};
                        const btnConfig = isObj ? {
                            id: keyStr,
                            type: 'button',
                            states: config?.states || {},
                            disabled: config?.disabled || false,
                            size: keySize,
                            style: config?.keyStyle, // allow object to override
                            ...keyItem, // spread custom properties (id, action, texture, content, layout, etc.)
                            ...serverUpdate
                        } : {
                            type: 'button',
                            id: keyStr,
                            content: keyStr,
                            action: keyStr,
                            states: config?.states || {},
                            disabled: config?.disabled || false,
                            size: keySize,
                            style: config?.keyStyle || {
                                fontSize: 20,
                                color: '#fff'
                            },
                            ...serverUpdate
                        };

                        return (
                            <Button
                                key={keyStr}
                                onInteract={onInteract}
                                globalScale={globalScale}
                                config={btnConfig as any}
                            />
                        );
                    })}</>
                </View>
            ))}</>
        </View>
    );
};