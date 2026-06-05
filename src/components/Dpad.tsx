import React from 'react';
import { View } from 'react-native';
import { DpadConfig } from '../types/LayoutTypes';
import { InteractPayload, Button, ButtonConfig } from './Button';
import { resolveAnchorStyle } from '../engine/LayoutUtils';

interface DpadProps {
    config: DpadConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
    onInteract?: (type: string, payload: InteractPayload) => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTION_ROTATION: Record<Direction, number> = {
    up: 0,
    right: 90,
    down: 180,
    left: 270,
};

const DEFAULT_KEY_CODES: Record<Direction, string> = {
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
};

export const Dpad: React.FC<DpadProps> = ({
    config,
    globalScale = 1,
    parentWidth,
    parentHeight,
    onInteract,
}) => {
    const {
        buttonSize = [80, 80],
        haptic,
        hitbox,
        autoRepeat,
        repeatInterval,
        texture,
        states,
        text,
        style,
        keyCodes,
    } = config;

    const [btnW, btnH] = buttonSize;
    // Default radius = buttonSize (buttons are flush to center)
    const radius = config.radius ?? btnW;

    // The container size fits all 4 buttons: center + radius in each direction
    const containerW = (radius + btnW / 2) * 2;
    const containerH = (radius + btnH / 2) * 2;
    const cx = containerW / 2;
    const cy = containerH / 2;

    // Position of each button center relative to container top-left
    const buttonPositions: Record<Direction, [number, number]> = {
        up:    [cx, cy - radius],
        down:  [cx, cy + radius],
        left:  [cx - radius, cy],
        right: [cx + radius, cy],
    };

    const anchorStyle = resolveAnchorStyle(
        { ...config, size: [containerW, containerH] },
        globalScale,
        parentWidth,
        parentHeight,
    );

    const directions: Direction[] = ['up', 'down', 'left', 'right'];

    return (
        <View
            style={[
                {
                    width: containerW * globalScale,
                    height: containerH * globalScale,
                    position: (config.position || config.anchor) ? 'absolute' : 'relative',
                },
                anchorStyle,
            ]}
        >
            {directions.map((dir) => {
                const [bx, by] = buttonPositions[dir];
                const keyCode = keyCodes?.[dir] ?? DEFAULT_KEY_CODES[dir];
                const label = text?.[dir];

                const btnConfig: ButtonConfig = {
                    type: 'button',
                    id: `${config.id ?? 'dpad'}_${dir}`,
                    keyCode,
                    haptic,
                    hitbox,
                    autoRepeat,
                    repeatInterval,
                    texture,
                    states,
                    text: label,
                    style: label ? style : undefined,
                    rotation: DIRECTION_ROTATION[dir],
                    // Position is center-based: anchor [0.5, 0.5]
                    anchor: [0.5, 0.5],
                    position: [bx - cx, by - cy],
                    size: buttonSize,
                };

                return (
                    <Button
                        key={dir}
                        config={btnConfig}
                        globalScale={globalScale}
                        parentWidth={containerW * globalScale}
                        parentHeight={containerH * globalScale}
                        onInteract={onInteract}
                    />
                );
            })}
        </View>
    );
};

