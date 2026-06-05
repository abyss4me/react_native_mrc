import React from 'react';
import { View } from 'react-native';
import { resolveAnchorStyle } from '../engine/LayoutUtils';
import { Button, ButtonConfig, InteractPayload } from './Button';
import { useServerData } from '../engine/NetworkContext';

interface KeyboardConfig {
    type: 'keyboard';
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    visible?: boolean;
    rows?: (string | { id?: string; [key: string]: unknown })[][];
    keySize?: [number, number];
    keyStyle?: Record<string, string | number>;
    gapX?: number;
    gapY?: number;
    states?: ButtonConfig['states'];
    disabled?: boolean;
    cooldown?: number;
    lockScreen?: boolean;
}

interface KeyboardProps {
    config: KeyboardConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

export const Keyboard = ({ config, globalScale = 1, parentWidth, parentHeight, onInteract }: KeyboardProps) => {

    const { serverData } = useServerData();

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

    const [, anchorY] = config.anchor || [0, 0];
    const justifyContentY = anchorY === 0 ? 'flex-start' : (anchorY === 1 || anchorY > 0.5 ? 'flex-end' : 'center');

    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);
    return (
        <View style={[
            anchorStyle,
            {
                width,
                height,
                position: 'absolute',
                alignItems: 'center',
                justifyContent: justifyContentY,
                gap: gapY,
            }
        ]}>
            <>{rows.map((row, i) => (
                <View
                    key={i}
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: gapX,
                        width: '100%'
                    }}
                >
                    <>{row.map((keyItem, j) => {
                        const isObj = typeof keyItem === 'object' && keyItem !== null;
                        const keyStr: string = isObj ? (String((keyItem as { id?: string }).id || `key_${i}_${j}`)) : String(keyItem);
                        const serverUpdate = (serverData?.state && serverData.state[keyStr]) || {};
                        const btnConfig = isObj ? {
                            id: keyStr,
                            type: 'button',
                            states: config?.states || {},
                            disabled: config?.disabled || false,
                            size: keySize,
                            style: config?.keyStyle,
                            // Keyboard-level defaults, overridden by individual key config
                            ...(config?.cooldown !== undefined ? { cooldown: config.cooldown } : {}),
                            ...(config?.lockScreen !== undefined ? { lockScreen: config.lockScreen } : {}),
                            ...keyItem,
                            ...serverUpdate
                        } : {
                            type: 'button',
                            id: keyStr,
                            text: keyStr,
                            action: keyStr,
                            states: config?.states || {},
                            disabled: config?.disabled || false,
                            size: keySize,
                            style: config?.keyStyle || {
                                fontSize: 20,
                                color: '#fff'
                            },
                            // Keyboard-level defaults, overridden by individual key config
                            ...(config?.cooldown !== undefined ? { cooldown: config.cooldown } : {}),
                            ...(config?.lockScreen !== undefined ? { lockScreen: config.lockScreen } : {}),
                            ...serverUpdate
                        };

                        return (
                            <Button
                                key={keyStr}
                                onInteract={onInteract}
                                globalScale={globalScale}
                                config={btnConfig as ButtonConfig}
                            />
                        );
                    })}</>
                </View>
            ))}</>
        </View>
    );
};