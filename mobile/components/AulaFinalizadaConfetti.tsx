import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ConfettiCanvas, presets, useConfetti } from 'react-native-confetti-reanimated';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useMainSwipe } from '@/context/MainSwipeContext';

function celebrationPalette(primary: string) {
  return [primary, '#FFD700', '#FFA500', '#10B981', '#F472B6', '#FFFFFF'];
}

/**
 * Confetes pelas laterais ao finalizar e enviar a aula (tela Início).
 */
export function AulaFinalizadaConfetti() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { aulaFinalizadaCelebrationKey } = useMainSwipe();
  const { confettiRef, fire } = useConfetti();

  useEffect(() => {
    if (aulaFinalizadaCelebrationKey === 0) {
      return;
    }

    const payload = { colors: celebrationPalette(colors.primary) };

    void (async () => {
      fire({ ...presets.leftCannon, ...payload, particleCount: 70 });
      fire({ ...presets.rightCannon, ...payload, particleCount: 70 });
      await fire({ ...presets.fireworks, ...payload, particleCount: 40 });
    })();
  }, [aulaFinalizadaCelebrationKey, colors.primary, fire]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <ConfettiCanvas ref={confettiRef} fullScreen zIndex={9999} />
    </View>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
    },
  });
}
