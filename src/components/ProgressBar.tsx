import React from 'react';
import { View, ViewStyle } from 'react-native';
import { resolveAnchorStyle, rotationTransform } from '../engine/LayoutUtils';

/**
 * ProgressBar — a pure display component.
 * The server controls it via PATCH_STATE by sending a numeric value in [0, 1].
 *
 * Layout JSON example:
 * {
 *   "type": "progressbar",
 *   "id": "health_bar",
 *   "position": [20, 40],
 *   "size": [300, 20],
 *   "anchor": [0, 0],
 *   "value": 1,          ← initial fill (0.0 – 1.0), updated by server
 *   "direction": "right",  ← fill direction: "right" | "left" | "down" | "up"
 *   "style": {
 *     "backgroundColor": "#333333",
 *     "borderRadius": 10
 *   },
 *   "fillStyle": {
 *     "backgroundColor": "#00FF88",
 *     "borderRadius": 10
 *   }
 * }
 */

interface ProgressBarConfig {
    type: 'progressbar';
    id?: string;
    position?: [number, number];
    size?: [number, number];
    anchor?: [number, number];
    rotation?: number;
    visible?: boolean;

    /** Fill ratio in range [0, 1]. Updated by the server via PATCH_STATE. */
    value?: number;

    /** Fill direction. Default: "right". */
    direction?: 'right' | 'left' | 'down' | 'up';

    /** Track (background) styles. */
    style?: ViewStyle;

    /** Fill (foreground) styles. */
    fillStyle?: ViewStyle;
}

interface ProgressBarProps {
    config: ProgressBarConfig;
    globalScale?: number;
    parentWidth?: number;
    parentHeight?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    config,
    globalScale = 1,
    parentWidth,
    parentHeight,
}) => {
    const anchorStyle = resolveAnchorStyle(config, globalScale, parentWidth, parentHeight);

    const [w, h] = config.size || [200, 16];
    const width = w * globalScale;
    const height = h * globalScale;

    // Clamp value to [0, 1]
    const value = Math.min(1, Math.max(0, config.value ?? 1));
    const direction = config.direction ?? 'right';
    const isHorizontal = direction === 'right' || direction === 'left';

    // Build fill size & alignment
    const fillStyle: ViewStyle = {
        position: 'absolute',
        ...config.fillStyle,
    };

    if (isHorizontal) {
        fillStyle.top = 0;
        fillStyle.bottom = 0;
        fillStyle.width = `${value * 100}%`;
        if (direction === 'right') fillStyle.left = 0;
        else fillStyle.right = 0;
    } else {
        fillStyle.left = 0;
        fillStyle.right = 0;
        fillStyle.height = `${value * 100}%`;
        if (direction === 'down') fillStyle.top = 0;
        else fillStyle.bottom = 0;
    }

    // Transformations
    const transform = rotationTransform(config.rotation);

    return (
        <View
            style={[
                anchorStyle,
                {
                    position: 'absolute',
                    width,
                    height,
                    overflow: 'hidden',
                    transform: transform.length > 0 ? transform : undefined,
                    ...config.style,
                },
            ]}
        >
            <View style={fillStyle} />
        </View>
    );
};




