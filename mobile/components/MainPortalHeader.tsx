import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useMainSwipe } from '@/context/MainSwipeContext';

/** Zoom com mola — calendário usa o mesmo timing que o ícone “Aniversariantes”; ausentes com stagger. */
const ICON_ZOOM_IN_FIRST = ZoomIn.duration(275).springify();
const ICON_ZOOM_OUT_FIRST = ZoomOut.delay(45).duration(215).springify();
const ICON_ZOOM_IN_SECOND = ZoomIn.delay(78).duration(275).springify();
const ICON_ZOOM_OUT_SECOND = ZoomOut.duration(215).springify();

/**
 * Barra superior fixa partilhada por Início / Turmas / Cadastros.
 * O título mantém-se; os ícones à direita mudam com `swipePage` (o + fica sempre na mesma posição).
 */
export function MainPortalHeader() {
  const { swipePage } = useMainSwipe();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onCalendarPress = useCallback(() => {
    router.push('/selecionar-aula');
  }, []);

  const onPlusPress = useCallback(() => {
    if (swipePage === 0) router.push('/nova-aula');
    else if (swipePage === 1) router.push('/nova-turma');
    else router.push('/cadastro');
  }, [swipePage]);

  const onAusentesPress = useCallback(() => {
    router.push('/ausentes');
  }, []);

  const plusLabel =
    swipePage === 0 ? 'Nova aula' : swipePage === 1 ? 'Nova turma' : 'Novo cadastro';

  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/images/logo_comprida.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="EBD Prime"
      />
      <View style={styles.actions}>
        <Pressable
          onPress={toggleTheme}
          style={({ pressed }) => [styles.themeBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          <FontAwesome name={isDark ? 'sun-o' : 'moon-o'} size={20} color={colors.primary} />
        </Pressable>

        {swipePage === 0 && (
          <Animated.View entering={ICON_ZOOM_IN_FIRST} exiting={ICON_ZOOM_OUT_FIRST}>
            <Pressable
              onPress={onCalendarPress}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Selecionar aula"
            >
              <FontAwesome name="calendar" size={22} color={colors.primary} />
            </Pressable>
          </Animated.View>
        )}

        {swipePage === 2 && (
          <View style={styles.extraPair}>
            <Animated.View entering={ICON_ZOOM_IN_FIRST} exiting={ICON_ZOOM_OUT_FIRST}>
              <Pressable
                onPress={() => router.push('/aniversariantes')}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Aniversariantes"
              >
                <FontAwesome name="birthday-cake" size={22} color={colors.primary} />
              </Pressable>
            </Animated.View>
            <Animated.View entering={ICON_ZOOM_IN_SECOND} exiting={ICON_ZOOM_OUT_SECOND}>
              <Pressable
                onPress={onAusentesPress}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Ausentes"
              >
                <FontAwesome name="user-times" size={22} color={colors.primary} />
              </Pressable>
            </Animated.View>
          </View>
        )}

        <Pressable
          onPress={onPlusPress}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={plusLabel}
        >
          <FontAwesome name="plus" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 9,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    logo: {
      height: 36,
      width: 144,
      flexShrink: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    extraPair: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    themeBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: {
      padding: 4,
    },
    pressed: {
      opacity: 0.55,
    },
  });
}
