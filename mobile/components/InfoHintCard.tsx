import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';

type Props = {
  children: string;
};

export function InfoHintCard({ children }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.text}>{children}</Text>
      <View style={styles.iconWrap}>
        <FontAwesome name="exclamation-circle" size={22} color={colors.textMuted} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    iconWrap: {
      opacity: 0.9,
    },
  });
}
