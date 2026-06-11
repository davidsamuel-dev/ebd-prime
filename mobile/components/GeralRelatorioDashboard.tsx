import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
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
import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiGetGeralResumo,
  type GeralResumoIndicadores,
  type GeralResumoRankingLinha,
  type GeralResumoTurmaLinha,
  type GeralResumoVencedorDepartamento,
} from '@/lib/api';
import {
  buildPeriodoFixo,
  resolveUltimaAulaRange,
  trimestreLabel,
  type PeriodoFiltro,
} from '@/lib/geral-resumo-dates';

const { width: SCREEN_W } = Dimensions.get('window');

type PessoasTab = 'todos' | 'alunos' | 'professores';

function formatMoneyBr(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function StatBox({ label, value, full }: { label: string; value: string | number; full?: boolean }) {
  const stat = useThemedStyles(createStat);
  return (
    <View style={[stat.box, full && stat.boxFull]}>
      <Text style={stat.label}>{label}</Text>
      <Text style={stat.value}>{value}</Text>
    </View>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: PessoasTab;
  onChange: (v: PessoasTab) => void;
}) {
  const seg = useThemedStyles(createSeg);
  const tabs: { key: PessoasTab; label: string }[] = [
    { key: 'todos', label: 'todos' },
    { key: 'alunos', label: 'alunos' },
    { key: 'professores', label: 'professores' },
  ];
  return (
    <View style={seg.wrap}>
      {tabs.map((t) => {
        const sel = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[seg.btn, sel && seg.btnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
          >
            <Text style={[seg.lbl, sel && seg.lblOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RankRow({ rank, nome, valor }: { rank: number; nome: string; valor: number }) {
  const row = useThemedStyles(createRow);
  const medal = rank === 1;
  return (
    <View style={row.wrap}>
      <View style={[row.badge, medal && row.badgeGold]}>
        <Text style={[row.badgeTxt, medal && row.badgeTxtGold]}>{rank}º</Text>
      </View>
      <View style={row.card}>
        <Text style={row.name} numberOfLines={1}>
          {nome}
        </Text>
      </View>
      <Text style={row.val}>{valor}</Text>
    </View>
  );
}

function TurmasChart({ linhas }: { linhas: GeralResumoTurmaLinha[] }) {
  const chart = useThemedStyles(createChart);
  const top = linhas.slice(0, 5);
  const maxVal = Math.max(1, ...top.map((x) => x.valor));
  if (top.length === 0) {
    return <Text style={chart.empty}>Sem turmas com dados no intervalo.</Text>;
  }
  return (
    <View style={chart.wrap}>
      <View style={chart.bars}>
        {top.map((t) => (
          <View key={t.turma_id} style={chart.barCol}>
            <View style={[chart.bar, { height: Math.max(8, (80 * t.valor) / maxVal) }]} />
            <Text style={chart.barLbl} numberOfLines={2}>
              {t.nome_turma}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type Props = {
  nomeIgreja: string;
  bairro: string;
  onOpenMenu: () => void;
};

export function GeralRelatorioDashboard({ nomeIgreja, bairro, onOpenMenu }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { congregacaoId, authMode } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('ultima');
  const [tabPresenca, setTabPresenca] = useState<PessoasTab>('todos');
  const [tabPontos, setTabPontos] = useState<PessoasTab>('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankTurmas, setRankTurmas] = useState<GeralResumoTurmaLinha[]>([]);
  const [rankPresenca, setRankPresenca] = useState<GeralResumoRankingLinha[]>([]);
  const [rankPontos, setRankPontos] = useState<GeralResumoRankingLinha[]>([]);
  const [indicadores, setIndicadores] = useState<GeralResumoIndicadores | null>(null);
  const [vencedores, setVencedores] = useState<GeralResumoVencedorDepartamento[]>([]);

  const labelTrim = useMemo(() => trimestreLabel(new Date()), []);
  const labelAno = useMemo(() => String(new Date().getFullYear()), []);

  const loadPresenca = useCallback(
    async (papel: PessoasTab, range: { from: string; to: string }) => {
      if (congregacaoId == null || congregacaoId <= 0) return [];
      const res = await apiGetGeralResumo({
        congregacaoId,
        dateFrom: range.from,
        dateTo: range.to,
        papel,
      });
      return res.ok ? res.ranking_frequencia : [];
    },
    [congregacaoId],
  );

  const loadPontos = useCallback(
    async (papel: PessoasTab, range: { from: string; to: string }) => {
      if (congregacaoId == null || congregacaoId <= 0) return [];
      const res = await apiGetGeralResumo({
        congregacaoId,
        dateFrom: range.from,
        dateTo: range.to,
        papel,
      });
      return res.ok ? res.ranking_pontuacao : [];
    },
    [congregacaoId],
  );

  const loadAll = useCallback(async () => {
    const demo = authMode === 'demo' || getActiveDataBackend() === null;
    if (demo || congregacaoId == null || congregacaoId <= 0) {
      setRankTurmas([]);
      setRankPresenca([]);
      setRankPontos([]);
      setIndicadores(null);
      setVencedores([]);
      setError(demo ? null : 'Congregação em falta.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let range: { from: string; to: string } | null = null;
      if (periodo === 'ultima') {
        range = await resolveUltimaAulaRange(congregacaoId);
        if (range == null) {
          setRankTurmas([]);
          setRankPresenca([]);
          setRankPontos([]);
          setIndicadores(null);
          setVencedores([]);
          setError('Ainda não há aulas registadas.');
          setLoading(false);
          return;
        }
      } else {
        range = buildPeriodoFixo(periodo);
      }

      const res = await apiGetGeralResumo({
        congregacaoId,
        dateFrom: range.from,
        dateTo: range.to,
        papel: 'todos',
      });
      if (!res.ok) {
        setError(res.error ?? 'Não foi possível carregar o relatório.');
        setRankTurmas([]);
        setRankPresenca([]);
        setRankPontos([]);
        setIndicadores(null);
        setVencedores([]);
        return;
      }
      setRankTurmas(res.ranking_turmas);
      setIndicadores(res.indicadores ?? null);
      setVencedores(res.vencedores_departamento ?? []);

      const [presTodos, pontTodos] = await Promise.all([
        Promise.resolve(res.ranking_frequencia),
        Promise.resolve(res.ranking_pontuacao),
      ]);
      setRankPresenca(presTodos);
      setRankPontos(pontTodos);
    } catch {
      setError('Sem ligação ao servidor.');
      setRankTurmas([]);
      setRankPresenca([]);
      setRankPontos([]);
      setIndicadores(null);
      setVencedores([]);
    } finally {
      setLoading(false);
    }
  }, [authMode, congregacaoId, periodo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (congregacaoId == null || congregacaoId <= 0) return;
    let cancelled = false;
    void (async () => {
      let range: { from: string; to: string } | null =
        periodo === 'ultima' ? await resolveUltimaAulaRange(congregacaoId) : buildPeriodoFixo(periodo);
      if (range == null || cancelled) return;
      const linhas = await loadPresenca(tabPresenca, range);
      if (!cancelled) setRankPresenca(linhas);
    })();
    return () => {
      cancelled = true;
    };
  }, [tabPresenca, congregacaoId, periodo, loadPresenca]);

  useEffect(() => {
    if (congregacaoId == null || congregacaoId <= 0) return;
    let cancelled = false;
    void (async () => {
      let range: { from: string; to: string } | null =
        periodo === 'ultima' ? await resolveUltimaAulaRange(congregacaoId) : buildPeriodoFixo(periodo);
      if (range == null || cancelled) return;
      const linhas = await loadPontos(tabPontos, range);
      if (!cancelled) setRankPontos(linhas);
    })();
    return () => {
      cancelled = true;
    };
  }, [tabPontos, congregacaoId, periodo, loadPontos]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.portalRow}>
              <View style={styles.portalSide} />
              <Text style={styles.portalTitle}>Portal EBD</Text>
              <Pressable
                onPress={onOpenMenu}
                style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Menu"
              >
                <FontAwesome name="bars" size={22} color={colors.white} />
              </Pressable>
            </View>

            <Text style={styles.churchName} numberOfLines={2}>
              {nomeIgreja}
            </Text>
            <Text style={styles.neighborhood}>{bairro}</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <Pressable
                onPress={() => setPeriodo('ultima')}
                style={[styles.chip, periodo === 'ultima' && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, periodo === 'ultima' && styles.chipTxtOn]}>Última aula</Text>
              </Pressable>
              <Pressable
                onPress={() => setPeriodo('trimestre')}
                style={[styles.chip, periodo === 'trimestre' && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, periodo === 'trimestre' && styles.chipTxtOn]}>{labelTrim}</Text>
              </Pressable>
              <Pressable
                onPress={() => setPeriodo('ano')}
                style={[styles.chip, periodo === 'ano' && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, periodo === 'ano' && styles.chipTxtOn]}>{labelAno}</Text>
              </Pressable>
            </ScrollView>

            <Text style={styles.chartLegend}>
              Apenas cadastros ativos com turma entram nos rankings
            </Text>
          </View>

          <View style={styles.sheet}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <>
                {indicadores ? (
                  <View style={styles.indicadoresCard}>
                    <Text style={styles.secTitle}>Indicadores agregados</Text>
                    <Text style={styles.secSub}>Totais da congregação no intervalo selecionado</Text>
                    <View style={styles.statGrid}>
                      <StatBox label="Matriculados" value={indicadores.matriculados} />
                      <StatBox label="Presentes" value={indicadores.presentes} />
                      <StatBox label="Ausentes" value={indicadores.ausentes} />
                      <StatBox label="Visitantes" value={indicadores.visitantes} />
                      <StatBox label="Total" value={indicadores.total} />
                      <StatBox label="Presença" value={`${indicadores.presenca_pct}%`} full />
                      <StatBox label="Bíblias" value={indicadores.biblias} />
                      <StatBox label="Revistas" value={indicadores.revistas} />
                      <StatBox label="Oferta" value={formatMoneyBr(indicadores.oferta)} full />
                    </View>
                  </View>
                ) : null}

                {vencedores.length > 0 ? (
                  <View style={styles.vencedoresBlock}>
                    <Text style={[styles.secTitle, indicadores ? styles.secTitleSp : undefined]}>
                      Turmas vencedoras por departamento
                    </Text>
                    <Text style={styles.secSub}>
                      {periodo === 'ultima' && indicadores?.todas_turmas_enviadas
                        ? 'Ranking fechado — todos os relatórios do dia foram enviados'
                        : 'Melhor desempenho no intervalo (presença; desempate por oferta)'}
                    </Text>
                    <View style={styles.vencedoresGrid}>
                      {vencedores.map((v) => (
                        <View key={`${v.departamento_nome}-${v.turma_id}`} style={styles.vencedorCard}>
                          <Text style={styles.vencedorTrophy}>{v.fechado ? '🏆' : '🥇'}</Text>
                          <Text style={styles.vencedorDept}>{v.departamento_nome}</Text>
                          <Text style={styles.vencedorTurma} numberOfLines={2}>
                            {v.nome_turma}
                          </Text>
                          <Text style={styles.vencedorPct}>{v.presenca_pct}% presença</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.secTitle, styles.secTitleSp]}>Ranking de turmas</Text>
                <Text style={styles.secSub}>Média de presença dos alunos ativos no intervalo</Text>
                <TurmasChart linhas={rankTurmas} />

                <Text style={[styles.secTitle, styles.secTitleSp]}>Ranking de presença</Text>
                <Text style={styles.secSub}>A frequência é exibida de acordo com o intervalo selecionado</Text>
                <Segmented value={tabPresenca} onChange={setTabPresenca} />
                <View style={styles.listBlock}>
                  {rankPresenca.length === 0 ? (
                    <Text style={styles.emptyRank}>Sem dados no intervalo.</Text>
                  ) : (
                    rankPresenca.map((r) => (
                      <RankRow key={`p-${r.usuario_id}`} rank={r.rank} nome={r.nome_real} valor={r.valor} />
                    ))
                  )}
                </View>

                <Text style={[styles.secTitle, styles.secTitleSp]}>Ranking de pontuação</Text>
                <Text style={styles.secSub}>Os pontos são somados dentro do intervalo selecionado</Text>
                <Segmented value={tabPontos} onChange={setTabPontos} />
                <View style={styles.listBlock}>
                  {rankPontos.length === 0 ? (
                    <Text style={styles.emptyRank}>Sem dados no intervalo.</Text>
                  ) : (
                    rankPontos.map((r) => (
                      <RankRow key={`o-${r.usuario_id}`} rank={r.rank} nome={r.nome_real} valor={r.valor} />
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function createStat(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    boxFull: {
      width: '100%',
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
    },
    value: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
  });
}

function createSeg(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 4,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 18,
  },
  btnOn: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  lbl: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
  lblOn: {
    color: colors.text,
  },
  });
}

function createChart(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 100,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  bar: {
    width: (SCREEN_W - 88) / 5,
    maxWidth: 40,
    borderRadius: 6,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  barLbl: {
    marginTop: 6,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: 16,
  },
  });
}

function createRow(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGold: {
    backgroundColor: colors.card,
  },
  badgeTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  badgeTxtGold: {
    color: colors.text,
  },
  card: {
    flex: 1,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  val: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minWidth: 28,
    textAlign: 'right',
  },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  safeTop: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  portalSide: {
    width: 44,
  },
  portalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  churchName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  neighborhood: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginRight: 10,
  },
  chipOn: {
    backgroundColor: colors.white,
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  chipTxtOn: {
    color: colors.primary,
  },
  chartLegend: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
    minHeight: 400,
  },
  secTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  secTitleSp: {
    marginTop: 22,
  },
  indicadoresCard: {
    marginBottom: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  vencedoresBlock: {
    marginBottom: 4,
  },
  vencedoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  vencedorCard: {
    width: (SCREEN_W - 60) / 2,
    maxWidth: 200,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  vencedorTrophy: {
    fontSize: 28,
    marginBottom: 6,
  },
  vencedorDept: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vencedorTurma: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  vencedorPct: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  secSub: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  listBlock: {
    marginTop: 4,
  },
  emptyRank: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginVertical: 24,
    fontWeight: '600',
  },
});
}
