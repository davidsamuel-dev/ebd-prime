import React, { useCallback, useEffect, useRef, useState, useMemo} from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useMainSwipe } from '@/context/MainSwipeContext';

const SLIDE_OFF = 120;

/**
 * Cartão inferior após cadastrar turma (referência visual: mensagem + OK).
 */
export function TurmaCadastroSuccessToast() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { turmaCadastroSuccessKey } = useMainSwipe();
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(SLIDE_OFF)).current;

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SLIDE_OFF,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setVisible(false);
      }
    });
  }, [translateY]);

  useEffect(() => {
    if (turmaCadastroSuccessKey === 0) {
      return;
    }
    setVisible(true);
    translateY.setValue(SLIDE_OFF);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 68,
    }).start();
  }, [turmaCadastroSuccessKey, translateY]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.card,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY }],
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.message}>Turma cadastrada com sucesso</Text>
        <Pressable onPress={hide} hitSlop={12} accessibilityRole="button" accessibilityLabel="OK">
          <Text style={styles.ok}>OK</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 200,
    elevation: 40,
    pointerEvents: 'box-none',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 18,
  },
  message: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginRight: 16,
  },
  ok: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.6,
  },
});
}
