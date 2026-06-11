import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useCallback, useMemo, type ReactNode } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getHelpUrl } from '@/lib/site-urls';

const URL_INSTAGRAM = 'https://www.instagram.com';
const URL_FACEBOOK = 'https://www.facebook.com';

function SectionGap() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.sectionGap} />;
}

function SettingsRow({
  icon,
  label,
  onPress,
  isLast,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.iconCol}>{icon}</View>
        <Text style={styles.rowLabel}>{label}</Text>
      </Pressable>
      {!isLast ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

function SettingsBlock({
  children,
}: {
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.block}>{children}</View>;
}

export default function ConfiguracoesScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { logout } = useAuth();

  const versionLine = useMemo(() => {
    const v = Constants.expoConfig?.version ?? '1.0.0';
    const build =
      Constants.expoConfig?.android?.versionCode ??
      Constants.expoConfig?.ios?.buildNumber ??
      '';
    return build !== '' && build != null ? `Versão: ${v} (${build})` : `Versão: ${v}`;
  }, []);

  const emBreve = useCallback((titulo: string) => {
    Alert.alert(titulo, 'Funcionalidade em breve.');
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Conheça o Portal EBD — gestão de Escola Bíblica Dominical.',
        title: 'Portal EBD',
      });
    } catch {
      /* cancelado */
    }
  }, []);

  const openUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Link', 'Não foi possível abrir o endereço.');
    });
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Sessão', 'Deseja terminar sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await logout();
            router.replace('/login');
          })();
        },
      },
    ]);
  }, [logout]);

  const iconColor = colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <FontAwesome name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Configurações</Text>
      </View>
      <View style={styles.headerRule} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsBlock>
          <View style={styles.themeRow}>
            <View style={styles.iconCol}>
              <FontAwesome name={isDark ? 'sun-o' : 'moon-o'} size={22} color={iconColor} />
            </View>
            <Text style={styles.rowLabel}>Modo escuro</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={colors.white}
              accessibilityLabel="Alternar modo escuro"
            />
          </View>
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="users" size={22} color={iconColor} />}
            label="Cadastros inativos"
            onPress={() => router.push('/cadastros-inativos')}
            isLast
          />
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="user-circle" size={22} color={iconColor} />}
            label="Acesso administrativo"
            onPress={() => router.push('/acesso-administrativo' as never)}
            isLast
          />
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="institution" size={22} color={iconColor} />}
            label="Dados da escola"
            onPress={() => router.push('/dados-escola' as never)}
          />
          <SettingsRow
            icon={<FontAwesome name="user" size={22} color={iconColor} />}
            label="Dados da conta"
            onPress={() => router.push('/dados-conta' as never)}
            isLast
          />
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="question-circle" size={22} color={iconColor} />}
            label="Ajuda e suporte"
            onPress={() => openUrl(getHelpUrl())}
          />
          <SettingsRow
            icon={<FontAwesome name="mobile" size={22} color={iconColor} />}
            label="Sobre o aplicativo"
            onPress={() => emBreve('Sobre o aplicativo')}
            isLast
          />
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="share-alt" size={22} color={iconColor} />}
            label="Compartilhe o Portal EBD"
            onPress={handleShare}
          />
          <SettingsRow
            icon={<FontAwesome5 name="instagram" size={22} color={iconColor} brand />}
            label="Siga nosso Instagram"
            onPress={() => openUrl(URL_INSTAGRAM)}
          />
          <SettingsRow
            icon={<FontAwesome5 name="facebook" size={22} color={iconColor} brand />}
            label="Curta nossa página"
            onPress={() => openUrl(URL_FACEBOOK)}
            isLast
          />
        </SettingsBlock>

        <SectionGap />

        <SettingsBlock>
          <SettingsRow
            icon={<FontAwesome name="sign-out" size={22} color={iconColor} />}
            label="Sair da conta"
            onPress={handleLogout}
            isLast
          />
        </SettingsBlock>

        <Text style={styles.footerVer}>{versionLine}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  backPressed: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sectionGap: {
    height: 10,
    backgroundColor: colors.card,
  },
  block: {
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowPressed: {
    backgroundColor: colors.card,
  },
  iconCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowDivider: {
    marginLeft: 68,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footerVer: {
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
    backgroundColor: colors.card,
    paddingVertical: 12,
  },
});
}
