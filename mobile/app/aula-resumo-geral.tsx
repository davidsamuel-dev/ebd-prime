import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { apiGetAulaResumo, type AulaResumoBarra, type AulaResumoResponse, type AulaResumoTurmaLinha } from '@/lib/api';

function formatMoneyBr(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function StatBox({ label, value, full }: { label: string; value: string | number; full?: boolean })  {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.statBox, full && styles.statBoxFull]}>
      <Text style={styles.statBoxLabel}>{label}</Text>
      <Text style={styles.statBoxValue}>{value}</Text>
    </View>
  );
}

function BarraPct({ label, pct }: { label: string; pct: number })  {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.barWrap}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barPct}>{pct}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
      </View>
    </View>
  );
}

function BarraOferta({ label, valor, maxValor }: { label: string; valor: number; maxValor: number })  {
  const styles = useThemedStyles(createStyles);
  const pct = maxValor > 0 ? Math.round((100 * valor) / maxValor) : 0;
  return (
    <View style={styles.barWrap}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barPct}>{formatMoneyBr(valor)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function TurmaFinanceiroCard({ t }: { t: AulaResumoTurmaLinha })  {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.turmaFinCard}>
      <Text style={styles.turmaFinTitle}>{t.nome_turma}</Text>
      <View style={styles.statGrid}>
        <StatBox label="Oferta" value={formatMoneyBr(t.oferta)} full />
        <StatBox label="Bíblias" value={t.biblias} />
        <StatBox label="Revistas" value={t.revistas} />
        <StatBox label="Visitantes" value={t.visitantes} />
      </View>
    </View>
  );
}

export default function AulaResumoGeralScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId } = useAuth();
  const params = useLocalSearchParams<{ dataAula: string }>();
  const dataAula = typeof params.dataAula === 'string' ? params.dataAula : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Extract<AulaResumoResponse, { ok: true }> | null>(null);

  const carregar = useCallback(async () => {
    if (!dataAula || congregacaoId == null || congregacaoId <= 0) {
      setLoading(false);
      setError('Dados em falta.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await apiGetAulaResumo(dataAula, congregacaoId);
      if (r.ok) {
        setResumo(r);
      } else {
        setError(r.error ?? 'Não foi possível carregar o resumo.');
      }
    } catch {
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [congregacaoId, dataAula]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const subtitulo = useMemo(() => {
    try {
      return format(parseISO(dataAula), "EEEE, dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dataAula;
    }
  }, [dataAula]);

  const maxOferta = useMemo(() => {
    const vals = (resumo?.geral.oferta_por_turma ?? []).map((b) => b.valor ?? 0);
    return Math.max(0, ...vals, resumo?.geral.oferta ?? 0);
  }, [resumo]);

  const aproveitamento = (resumo?.geral.aproveitamento ?? []) as AulaResumoBarra[];
  const ofertaBarras = (resumo?.geral.oferta_por_turma ?? []) as AulaResumoBarra[];

  const turmasFinanceiro = useMemo(
    () =>
      (resumo?.turmas ?? []).filter(
        (t) => t.chamada_feita || t.oferta > 0 || t.biblias > 0 || t.revistas > 0,
      ),
    [resumo?.turmas],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Voltar">
          <FontAwesome name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          Resumo final
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.err}>{error}</Text>
      ) : resumo ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.dateSub}>{subtitulo}</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Relatório Geral</Text>
            <Text style={styles.cardDesc}>
              Aqui você acompanha o relatório geral de todos os alunos e professores na aula selecionada.
            </Text>
            <View style={styles.statGrid}>
              <StatBox label="Matriculados" value={resumo.geral.matriculados} />
              <StatBox label="Presentes" value={resumo.geral.presentes} />
              <StatBox label="Ausentes" value={resumo.geral.ausentes} />
              <StatBox label="Visitantes" value={resumo.geral.visitantes} />
              <StatBox label="Total" value={resumo.geral.total} />
              <StatBox label="Presença" value={`${resumo.geral.presenca_pct}%`} full />
              <StatBox label="Bíblias" value={resumo.geral.biblias} />
              <StatBox label="Revistas" value={resumo.geral.revistas} />
              <StatBox label="Oferta" value={formatMoneyBr(resumo.geral.oferta)} full />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aproveitamento</Text>
            <Text style={styles.cardDesc}>
              O aproveitamento é definido pelo número de alunos/professores presentes baseado na quantidade de
              matriculados.
            </Text>
            {aproveitamento.map((b) => (
              <BarraPct key={b.label} label={b.label} pct={b.pct ?? 0} />
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Oferta</Text>
            <Text style={styles.cardDesc}>
              Valor total ofertado entre as classes. (O percentual é baseado no maior valor ofertado)
            </Text>
            {ofertaBarras.map((b) => (
              <BarraOferta key={b.label} label={b.label} valor={b.valor ?? 0} maxValor={maxOferta} />
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Relatório financeiro por classes</Text>
            <Text style={styles.cardDesc}>
              Valores de oferta, bíblias e revistas registrados em cada turma nesta aula.
            </Text>
            {turmasFinanceiro.length === 0 ? (
              <Text style={styles.emptyFin}>Nenhum dado financeiro registado nesta aula.</Text>
            ) : (
              turmasFinanceiro.map((t) => <TurmaFinanceiroCard key={t.turma_id} t={t} />)
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, gap: 14 },
  dateSub: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 },
  cardDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBoxFull: { width: '100%' },
  statBoxLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  statBoxValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  barWrap: { marginBottom: 14 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  barPct: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  turmaFinCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  turmaFinTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  emptyFin: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  err: { margin: 20, color: colors.danger, textAlign: 'center' },
});
}
