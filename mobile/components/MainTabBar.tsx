import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAppTheme } from '@/context/AppThemeContext';
import { useMainSwipe } from '@/context/MainSwipeContext';

function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={24} name={name} color={color} style={{ marginBottom: -2 }} />;
}

/**
 * Quatro destinos visuais: Início / Turmas / Cadastros (mesma rota `index` + página do carrossel) e Geral.
 */
export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { swipePage, setSwipePage } = useMainSwipe();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const activeRoute = state.routes[state.index]?.name;
  const onGeral = activeRoute === 'geral';

  const bottomInset = Platform.select({
    ios: Math.max(insets.bottom, 20),
    android: Math.max(insets.bottom, 12),
    default: Math.max(insets.bottom, 8),
  });
  const topPad = Platform.OS === 'ios' ? 8 : 6;
  const contentRow = 52;
  const barHeight = contentRow + topPad + bottomInset;

  const primary = colors.primary;
  const muted = colors.tabInactive;

  const goMain = (page: number) => {
    navigation.navigate('index');
    setSwipePage(page, { animated: true });
  };

  const goGeralTab = () => {
    navigation.navigate('geral');
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: topPad,
          paddingBottom: bottomInset,
          minHeight: barHeight,
        },
      ]}
    >
      <Pressable style={styles.item} onPress={() => goMain(0)} accessibilityRole="button" accessibilityLabel="Início">
        <TabIcon name="home" color={!onGeral && swipePage === 0 ? primary : muted} />
        <Text style={[styles.label, !onGeral && swipePage === 0 && styles.labelActive]}>Início</Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => goMain(1)} accessibilityRole="button" accessibilityLabel="Turmas">
        <TabIcon name="list" color={!onGeral && swipePage === 1 ? primary : muted} />
        <Text style={[styles.label, !onGeral && swipePage === 1 && styles.labelActive]}>Turmas</Text>
      </Pressable>

      <Pressable style={styles.item} onPress={() => goMain(2)} accessibilityRole="button" accessibilityLabel="Cadastros">
        <TabIcon name="users" color={!onGeral && swipePage === 2 ? primary : muted} />
        <Text style={[styles.label, !onGeral && swipePage === 2 && styles.labelActive]}>Cadastros</Text>
      </Pressable>

      <Pressable style={styles.item} onPress={goGeralTab} accessibilityRole="button" accessibilityLabel="Geral">
        <TabIcon name="bar-chart" color={onGeral ? primary : muted} />
        <Text style={[styles.label, onGeral && styles.labelActive]}>Geral</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingHorizontal: 4,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.tabInactive,
      marginTop: 2,
    },
    labelActive: {
      color: colors.primary,
    },
  });
}
