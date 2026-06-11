import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { apiListAdministradores, type AdministradorListItem } from '@/lib/api';

export default function AcessoAdministrativoScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { congregacaoId } = useAuth();
  const [lista, setLista] = useState<AdministradorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (congregacaoId == null || congregacaoId <= 0) {
      setLista([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const res = await apiListAdministradores({ congregacaoId });
      if (res.ok) {
        setLista(res.administradores);
      } else {
        setLista([]);
        setError(res.error ?? 'Não foi possível carregar.');
      }
    } catch {
      setLista([]);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [congregacaoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <FontAwesome name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Acesso administrativo</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Aqui você pode criar logins para os <Text style={styles.bold}>secretários e gestores</Text>. Os logins são
          feitos através dos <Text style={styles.bold}>usuários de acesso</Text>. Com estes usuários os administradores
          poderão entrar no aplicativo, cadastrar, alterar e excluir aulas, alunos e professores.
        </Text>
        <Text style={styles.introLast}>
          Todos administradores têm o mesmo nível de acesso e podem, inclusive, cadastrar outros administradores
          também.
        </Text>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Administradores</Text>
          <Pressable
            onPress={() => {
              router.push('/acesso-administrativo/convidar' as never);
            }}
            style={({ pressed }) => [styles.plusBtn, pressed && { opacity: 0.75 }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Adicionar administrador"
          >
            <FontAwesome name="plus" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : lista.length === 0 ? (
          <Text style={styles.empty}>Nenhum administrador listado.</Text>
        ) : (
          lista.map((a) => (
            <View key={String(a.id)} style={styles.card}>
              <Text style={styles.cardName}>{a.nome_real}</Text>
              <Text style={styles.cardLogin}>{a.login_usuario != null ? `@${a.login_usuario}` : '—'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  backBtn: {
    padding: 8,
    width: 40,
  },
  backPlaceholder: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 14,
  },
  introLast: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  bold: {
    fontWeight: '800',
    color: colors.text,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  plusBtn: {
    padding: 8,
  },
  center: {
    paddingVertical: 24,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  cardLogin: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
}
