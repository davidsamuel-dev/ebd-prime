import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Opacidade animada: 1 com teclado fechado, ~0 com teclado aberto (FAB, rodapés, etc.).
 */
export function KeyboardSecondaryOpacity({ children, style }: Props) {
  const { keyboardVisible } = useKeyboardVisible();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: keyboardVisible ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [keyboardVisible, opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      pointerEvents={keyboardVisible ? 'none' : 'auto'}
    >
      {children}
    </Animated.View>
  );
}
