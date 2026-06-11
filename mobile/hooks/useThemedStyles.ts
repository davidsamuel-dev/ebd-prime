import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';

type StylesFactory<T> = (colors: ThemeColors) => T;

/** Cria StyleSheet reativo ao modo claro/escuro. */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: StylesFactory<T>,
): T {
  const { colors } = useAppTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
