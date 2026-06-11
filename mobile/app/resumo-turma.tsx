import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiGetTurmaResumoIntervalo,
  type TurmaResumoIntervaloResponse,
  type TurmaResumoRankingLinha,
} from '@/lib/api';

const { height: WIN_H } = Dimensions.get('window');
const HERO_MIN = Math.min(WIN_H * 0.42, 340);

type IntervalKind = 'tri2' | 'year' | 'custom';

function buildInterval(kind: IntervalKind, year: number): { from: string; to: string } | null {
  if (kind === 'custom') return null;
  if (kind === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { from: `${year}-04-01`, to: `${year}-06-30` };
}

const MOCK_RESUMO: Extract<TurmaResumoIntervaloResponse, { ok: true }> = {
  ok: true,
  turma_id: 1,
  alunos_count: 2,
  total_aulas: 1,
  media_intervalo_pct: 100,
  ranking_frequencia: [
    { usuario_id: 1, nome_real: 'David Samuel', valor: 1, rank: 1 },
    { usuario_id: 2, nome_real: 'Rafaela', valor: 1, rank: 1 },
  ],
  ranking_pontuacao: [
    { usuario_id: 1, nome_real: 'David Samuel', valor: 2, rank: 1 },
    { usuario_id: 2, nome_real: 'Rafaela', valor: 2, rank: 1 },
  ],
};

function RankingBlock({
  title,
  subtitle,
  linhas,
}: {
  title: string;
  subtitle: string;
  linhas: TurmaResumoRankingLinha[];
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.rankBlock}>
      <Text style={styles.rankTitle}>{title}</Text>
      <Text style={styles.rankSub}>{subtitle}</Text>
      {linhas.length === 0 ? (
        <Text style={styles.rankEmpty}>Sem dados no intervalo.</Text>
      ) : (
        linhas.map((row) => (
          <View key={row.usuario_id} style={styles.rankRow}>
            <Text style={styles.rankOrd}>{row.rank}º</Text>
            <View style={styles.rankPill}>
              <Text style={styles.rankName} numberOfLines={1}>
                {row.nome_real}
              </Text>
              <Text style={styles.rankVal}>{row.valor}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default function ResumoTurmaScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { authMode } = useAuth();
  const params = useLocalSearchParams<{ turmaId: string; nomeTurma?: string }>();
  const turmaId = Number(params.turmaId);
  const nomeTurma = typeof params.nomeTurma === 'string' ? params.nomeTurma : 'Turma';

  const year = useMemo(() => new Date().getFullYear(), []);
  const [intervalKind, setIntervalKind] = useState<IntervalKind>('year');
  const [data, setData] = useState<Extract<TurmaResumoIntervaloResponse, { ok: true }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => buildInterval(intervalKind, year), [intervalKind, year]);

  const load = useCallback(async () => {
    const demo = authMode === 'demo' || getActiveDataBackend() === null;
    if (demo || !Number.isFinite(turmaId) || turmaId <= 0) {
      setData(MOCK_RESUMO);
      setError(null);
      setLoading(false);
      return;
    }
    if (intervalKind === 'custom' || range == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetTurmaResumoIntervalo(turmaId, range.from, range.to);
      if (res.ok) {
        setData(res);
      } else {
        setData(null);
        setError(res.error ?? 'Não foi possível carregar o resumo.');
      }
    } catch {
      setData(null);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [authMode, intervalKind, range, turmaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCustom = () => {
    Alert.alert('Intervalo personalizado', 'Em breve poderá definir datas livres para o resumo.');
  };

  const chipTri2 = intervalKind === 'tri2';
  const chipYear = intervalKind === 'year';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={[styles.hero, { paddingTop: insets.top + 8, minHeight: HERO_MIN }]}>
          <View style={styles.heroTop}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconCircle, pressed && { opacity: 0.75 }]}
              hitSlop={12}
              accessibilityLabel="Voltar"
            >
              <FontAwesome name="arrow-left" size={20} color={colors.white} />
            </Pressable>
            <Text style={styles.heroSubtitle}>Resumo geral</Text>
            <View style={styles.heroIcons}>
              <Pressable
                onPress={() => router.push('/aniversariantes')}
                style={({ pressed }) => [styles.iconCircle, pressed && { opacity: 0.75 }]}
                hitSlop={8}
                accessibilityLabel="Aniversariantes"
              >
                <FontAwesome name="birthday-cake" size={18} color={colors.white} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/cadastro')}
                style={({ pressed }) => [styles.iconCircle, pressed && { opacity: 0.75 }]}
                hitSlop={8}
                accessibilityLabel="Novo cadastro"
              >
                <FontAwesome name="user" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.turmaTitulo} numberOfLines={2}>
            {nomeTurma}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setIntervalKind('tri2')}
              style={[styles.chip, chipTri2 ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipTxt, chipTri2 && styles.chipTxtOn]}>{`2º trimestre de ${year}`}</Text>
            </Pressable>
            <Pressable
              onPress={() => setIntervalKind('year')}
              style={[styles.chip, chipYear ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipTxt, chipYear && styles.chipTxtOn]}>{String(year)}</Text>
            </Pressable>
            <Pressable onPress={onCustom} style={[styles.chip, styles.chipOff]}>
              <Text style={styles.chipTxt}>Intervalo personalizado</Text>
            </Pressable>
          </ScrollView>

          <Text style={styles.chartHint}>clique sobre o gráfico para ver mais detalhes</Text>

          <Pressable
            style={styles.chartPlaceholder}
            onPress={() => Alert.alert('Gráfico', 'Detalhes do gráfico em breve.')}
            accessibilityRole="button"
            accessibilityLabel="Gráfico de resumo"
          >
            <FontAwesome name="bar-chart" size={40} color="rgba(255,255,255,0.35)" />
          </Pressable>

          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>
                Alunos: {loading ? '—' : data != null ? data.alunos_count : '—'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>
                Média no intervalo:{' '}
                {loading ? '—' : data != null ? `${data.media_intervalo_pct}%` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          {loading ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.sheetLoading}>
              <Text style={styles.err}>{error}</Text>
              <Pressable onPress={() => void load()} style={styles.retry}>
                <Text style={styles.retryTxt}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : data != null ? (
            <>
              <RankingBlock
                title="Ranking de frequência"
                subtitle="A frequência é exibida de acordo com o intervalo selecionado"
                linhas={data.ranking_frequencia}
              />
              <RankingBlock
                title="Ranking de pontuação"
                subtitle="Os pontos são somados dentro do intervalo selecionado"
                linhas={data.ranking_pontuacao}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroSubtitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  turmaTitulo: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  chipOff: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  chipOn: {
    backgroundColor: colors.white,
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  chipTxtOn: {
    color: colors.primaryDark,
  },
  chartHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 10,
  },
  chartPlaceholder: {
    height: 120,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    paddingTop: 22,
    paddingHorizontal: 18,
    minHeight: 280,
  },
  sheetLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  err: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryTxt: {
    color: colors.white,
    fontWeight: '700',
  },
  rankBlock: {
    marginBottom: 28,
  },
  rankTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  rankSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 19,
  },
  rankEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  rankOrd: {
    width: 32,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  rankPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rankName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginRight: 12,
  },
  rankVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
  },
});
}
