import React from 'react';
import { View } from 'react-native';
import { getAnchorStyle } from '../engine/layoutUtils';
import { Button } from './Button';

export const Keyboard = ({ config, globalScale = 1, onInteract }: any) => {
    
    const rows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M", "⌫"]
    ];

    const baseKeyW = config.keySize?.w || 40;
    const baseKeyH = config.keySize?.h || 50;

    const keySize = {
        w: baseKeyW,
        h: baseKeyH
    };

    const anchorStyle = getAnchorStyle(config, globalScale);
    return (
        <View style={[
            anchorStyle,
            {
                position: 'absolute',
                // Flexbox for centering the keyboard
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5 * globalScale // gap works in new versions of RN
            }
        ]}>
            {rows.map((row, i) => (
                <View 
                    key={i} 
                    style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'center', 
                        gap: 4 * globalScale, // Gaps between buttons
                        width: '100%' 
                    }}
                >
                    {row.map(key => (
                        <Button
                            key={key}
                            onInteract={onInteract}
                            globalScale={globalScale}
                            config={{
                                type: 'button',
                                id: key,
                                content: key,
                                action: key === "⌫" ? "BACKSPACE" : `KEY_${key}`,
                                states: config?.states || {},
                                disabled: config?.disabled || false,
                                size: keySize,
                                style: {
                                    fontSize: 20, // Font size
                                    color: '#fff'
                                }
                            }}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
};