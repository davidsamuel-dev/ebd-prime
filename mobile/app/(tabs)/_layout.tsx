import { Redirect, Tabs } from 'expo-router';
import { useMemo } from 'react';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MainTabBar } from '@/components/MainTabBar';
import { AulaFinalizadaConfetti } from '@/components/AulaFinalizadaConfetti';
import { TurmaCadastroSuccessToast } from '@/components/TurmaCadastroSuccessToast';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

/**
 * Início, Turmas e Cadastros partilham o mesmo ecrã (`index`) com carrossel horizontal.
 * Geral é rota à parte — sem gesto de swipe entre elas.
 */
export default function TabLayout() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.tabsRoot}>
      <Tabs
        tabBar={(props) => <MainTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarHideOnKeyboard: useClientOnlyValue(true, false),
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="geral" options={{ title: 'Geral' }} />
      </Tabs>
      <TurmaCadastroSuccessToast />
      <AulaFinalizadaConfetti />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  tabsRoot: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
}
