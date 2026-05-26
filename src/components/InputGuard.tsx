import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useInputGuard } from '../engine/InputGuardContext';

/**
 * InputGuard — Global transparent input shield.
 *
 * When `isLocked` is true, renders an invisible absolute View on top of all UI.
 * It intercepts and swallows every touch event — user sees nothing, but cannot tap anything.
 *
 * LOCK:   Button with `lockScreen: true` → `lockInput()` on pressIn (synchronous, zero delay).
 * UNLOCK: ScreenRenderer detects new screenConfig → `unlockInput()` via useEffect.
 *
 * Fail-safe is Timeout, default 5 sec to unlockInput, in case the message was not transmitted to the Game.
 */
const InputGuard: React.FC = () => {
    const { isLocked } = useInputGuard();

    if (!isLocked) return null;

    return <View style={styles.shield} />;
};

const styles = StyleSheet.create({
    shield: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        zIndex: 9999,
        elevation: 9999,
    },
});

export default InputGuard;

