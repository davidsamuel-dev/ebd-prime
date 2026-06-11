import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function Index() {
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
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/login" />;
}

function createStyles(colors: ThemeColors) {
  return {
    boot: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.background,
    },
  };
}
