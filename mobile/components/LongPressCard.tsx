import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { hapticLongPress } from '@/lib/haptics';

export const LONG_PRESS_CARD_DELAY_MS = 420;
export const LONG_PRESS_CARD_SCALE = 0.97;

type LongPressCardProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

/**
 * Cartão com toque normal + long press (vibração + leve redução de escala ao pressionar).
 */
export function LongPressCard({
  onLongPress,
  style,
  delayLongPress = LONG_PRESS_CARD_DELAY_MS,
  children,
  ...rest
}: LongPressCardProps) {
  return (
    <Pressable
      {...rest}
      delayLongPress={delayLongPress}
      onLongPress={(event) => {
        hapticLongPress();
        onLongPress?.(event);
      }}
      style={(state) => [
        style,
        state.pressed && { transform: [{ scale: LONG_PRESS_CARD_SCALE }] },
      ]}
    >
      {children}
    </Pressable>
  );
}
