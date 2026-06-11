import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { apiHistoricoUsuario, isApiConfigured } from '@/lib/api';

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function HistoricoScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{
    usuario_id?: string | string[];
    nome?: string | string[];
    turma?: string | string[];
  }>();

  const nomeParam = firstParam(params.nome);
  const turmaParam = firstParam(params.turma);
  const uidRaw = firstParam(params.usuario_id);
  const usuarioId = uidRaw != null && uidRaw !== '' ? parseInt(uidRaw, 10) : NaN;
  const canFetch = isApiConfigured() && Number.isFinite(usuarioId) && usuarioId > 0;

  const [loading, setLoading] = useState(canFetch);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    presencas: 0,
    ausencias: 0,
    pontos: 0,
    aproveitamento_pct: 0,
    registos: 0,
  });
  const [cabecalho, setCabecalho] = useState({
    nome: nomeParam && nomeParam.length > 0 ? nomeParam : 'Aluno',
    turma: turmaParam && turmaParam.length > 0 ? turmaParam : '—',
  });

  useEffect(() => {
    if (!canFetch) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiHistoricoUsuario(usuarioId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setCabecalho({
            nome: res.usuario.nome_real,
            turma: res.usuario.turma_label ?? turmaParam ?? '—',
          });
          setStats({
            presencas: res.stats.presencas,
            ausencias: res.stats.ausencias,
            pontos: res.stats.pontos,
            aproveitamento_pct: res.stats.aproveitamento_pct,
            registos: res.stats.registos,
          });
        } else {
          setError(res.error ?? 'Erro ao carregar');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Sem ligação ao servidor.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canFetch, usuarioId, turmaParam]);

  const statItems = [
    { value: String(stats.presencas), label: 'Presenças' },
    { value: String(stats.ausencias), label: 'Ausências' },
    { value: String(stats.pontos), label: 'Pontos' },
    { value: `${stats.aproveitamento_pct}%`, label: 'Aproveitamento' },
  ];

  const temRegistos = stats.registos > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <FontAwesome name="chevron-left" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Histórico</Text>
        <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Perfil">
          <FontAwesome name="user" size={22} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView style={styles.blueScroll} contentContainerStyle={styles.blueContent}>
        <Text style={styles.name}>{cabecalho.nome}</Text>
        <Text style={styles.dept}>{cabecalho.turma}</Text>
        <Pressable style={styles.pillBtn} accessibilityRole="button">
          <Text style={styles.pillBtnText}>Intervalo personalizado</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : error ? (
          <Text style={styles.errWhite}>{error}</Text>
        ) : (
          <View style={styles.statsRow}>
            {statItems.map((s) => (
              <View key={s.label} style={styles.statCol}>
                <Text style={styles.statVal}>{s.value}</Text>
                <Text style={styles.statLab}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.sheet}>
        {!temRegistos && !loading ? (
          <>
            <View style={styles.emptyIllustration}>
              <FontAwesome name="laptop" size={48} color={colors.textMuted} style={{ opacity: 0.35 }} />
            </View>
            <Text style={styles.emptyTitle}>Ainda não temos presenças deste aluno para exibir aqui.</Text>
            <Text style={styles.emptySub}>
              Quando existirem linhas em <Text style={styles.mono}>frequencia</Text> ligadas a relatórios enviados, os
              números acima atualizam automaticamente.
            </Text>
          </>
        ) : temRegistos ? (
          <>
            <Text style={styles.summaryTitle}>Resumo</Text>
            <Text style={styles.summaryText}>
              {stats.registos} registo(s) de frequência na base de dados. Detalhe por aula pode ser acrescentado nas
              próximas iterações.
            </Text>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  blueScroll: {
    maxHeight: 300,
  },
  blueContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    marginTop: 4,
  },
  dept: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    opacity: 0.92,
    letterSpacing: 1,
    marginTop: 4,
  },
  pillBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  pillBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  loader: {
    marginTop: 24,
    alignItems: 'center',
  },
  errWhite: {
    marginTop: 16,
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
    minWidth: 72,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  statLab: {
    marginTop: 4,
    fontSize: 11,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  emptyIllustration: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  mono: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: colors.primary,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
}
