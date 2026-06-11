import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type Props = {
  children: React.ReactNode;
  /** Escala quando o teclado está visível (default ~metade). */
  keyboardScale?: number;
  /**
   * Quando true, o espaço ocupado no layout acompanha a escala (clip quadrado).
   * Evita o “buraco” em volta da ilustração que ocorre com `transform` + `useNativeDriver`.
   * Use com conteúdo aproximadamente quadrado de lado `layoutBaseSize`.
   */
  collapseLayout?: boolean;
  /** Lado do quadrado base (ex.: 200 para o círculo de ilustração). */
  layoutBaseSize?: number;
};

/**
 * RNF08 — reduz suavemente ilustrações no topo quando o teclado abre (Animated.spring).
 */
export function KeyboardAdaptiveHero({
  children,
  keyboardScale = 0.52,
  collapseLayout = false,
  layoutBaseSize = 200,
}: Props) {
  const { keyboardVisible } = useKeyboardVisible();
  const scale = useRef(new Animated.Value(1)).current;
  const layoutBasePx = useRef(new Animated.Value(layoutBaseSize)).current;

  useEffect(() => {
    layoutBasePx.setValue(layoutBaseSize);
  }, [layoutBaseSize, layoutBasePx]);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: keyboardVisible ? keyboardScale : 1,
      friction: 8,
      tension: 70,
      useNativeDriver: !collapseLayout,
    }).start();
  }, [keyboardVisible, keyboardScale, scale, collapseLayout]);

  const marginBottom = keyboardVisible ? 8 : 24;

  if (collapseLayout) {
    const layoutSize = Animated.multiply(scale, layoutBasePx);
    const radius = Animated.divide(layoutSize, new Animated.Value(2));

    return (
      <View style={[styles.outer, { marginBottom }]}>
        <Animated.View
          style={{
            width: layoutSize,
            height: layoutSize,
            borderRadius: radius,
            overflow: 'hidden',
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={{
              width: layoutBaseSize,
              height: layoutBaseSize,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
            }}
          >
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.outer, { marginBottom }]}>
      <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
  },
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
