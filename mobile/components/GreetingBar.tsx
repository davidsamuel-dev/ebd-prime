import React, { useEffect, useState, useMemo} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { useAuth } from '@/context/AuthContext';
import { getTimeOfDayGreeting } from '@/lib/greeting';

/** RF01 — saudação dinâmica + primeiro nome do utilizador autenticado (texto branco sobre azul #0078D4). */
export function GreetingBar() {
  const styles = useThemedStyles(createStyles);
  const { userName } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const greeting = getTimeOfDayGreeting();
  const first = userName.trim().split(/\s+/)[0] ?? userName;

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        {greeting}, {first}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  text: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
}
