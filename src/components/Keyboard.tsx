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
                // Flexbox для центрування клавіатури
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5 * globalScale // gap працює в нових версіях RN
            }
        ]}>
            {rows.map((row, i) => (
                <View 
                    key={i} 
                    style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'center', 
                        gap: 4 * globalScale, // Відступи між кнопками
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
                                texture: config.texture,
                                textureFocused: config.textureFocused,
                                textureDisabled: config.textureDisabled,
                                disabled: config?.disabled || false,
                                size: keySize,
                                style: {
                                    fontSize: 20, // Розмір шрифту
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