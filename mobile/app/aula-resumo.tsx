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
import { apiGetAulaResumo, type AulaResumoResponse, type AulaResumoTurmaLinha } from '@/lib/api';

function formatMoneyBr(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDataTitulo(dataAula: string, numeroLicao: number | null): string {
  let dataFmt = dataAula;
  try {
    const d = format(parseISO(dataAula), 'dd/MM', { locale: ptBR });
    dataFmt = d;
  } catch {
    /* keep */
  }
  const lic = numeroLicao != null ? `Lição ${numeroLicao}` : 'Aula';
  return `${lic} - ${dataFmt}`;
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

function TurmaResumoCard({ t }: { t: AulaResumoTurmaLinha })  {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.turmaCard}>
      <Text style={styles.turmaCardTitle}>{t.nome_turma}</Text>
      <View style={styles.statGrid}>
        <StatBox label="Matriculados" value={t.matriculados} />
        <StatBox label="Presentes" value={t.presentes} />
        <StatBox label="Ausentes" value={t.ausentes} />
        <StatBox label="Visitantes" value={t.visitantes} />
        <StatBox label="Total" value={t.total} />
        <StatBox label="Presença" value={`${t.presenca_pct}%`} full />
        <StatBox label="Bíblias" value={t.biblias} />
        <StatBox label="Revistas" value={t.revistas} />
        <StatBox label="Oferta" value={formatMoneyBr(t.oferta)} full />
      </View>
    </View>
  );
}

export default function AulaResumoScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId } = useAuth();
  const params = useLocalSearchParams<{ dataAula: string; numeroLicao?: string }>();
  const dataAula = typeof params.dataAula === 'string' ? params.dataAula : '';
  const numeroParam =
    params.numeroLicao != null && params.numeroLicao !== '' ? Number(params.numeroLicao) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Extract<AulaResumoResponse, { ok: true }> | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);

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

  const titulo = useMemo(() => {
    const num = resumo?.numero_licao ?? numeroParam;
    return formatDataTitulo(dataAula, num);
  }, [dataAula, numeroParam, resumo?.numero_licao]);

  const turmasComChamada = useMemo(
    () => (resumo?.turmas ?? []).filter((t) => t.chamada_feita),
    [resumo?.turmas],
  );

  const abrirGeral = () => {
    router.push({
      pathname: '/aula-resumo-geral',
      params: {
        dataAula,
        numeroLicao: titulo.includes('Lição') ? String(resumo?.numero_licao ?? numeroParam ?? '') : '',
      },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Voltar">
          <FontAwesome name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          Resumo da aula
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resumo Final</Text>
            <Text style={styles.cardDesc}>
              O resumo final exibe o somatório de todos os alunos e professores cadastrados nesta aula. Você pode
              também visualizar comparativos de desempenho entre as turmas.
            </Text>
            <Pressable onPress={abrirGeral} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
              <Text style={styles.ctaText}>VER RESUMO</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Relatórios por classes</Text>
            <Text style={styles.cardDesc}>
              Aqui você acompanha o relatório das chamadas feitas em cada classe. Arraste para o lado para ver as
              outras turmas.
            </Text>
            {turmasComChamada.length === 0 ? (
              <Text style={styles.muted}>Nenhuma chamada registada nesta aula.</Text>
            ) : (
              <>
                <View
                  style={styles.carouselViewport}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0 && w !== slideWidth) {
                      setSlideWidth(w);
                    }
                  }}
                >
                  {slideWidth > 0 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      onMomentumScrollEnd={(e) => {
                        const x = e.nativeEvent.contentOffset.x;
                        setCarouselIdx(Math.round(x / slideWidth));
                      }}
                    >
                      {turmasComChamada.map((t) => (
                        <View key={t.turma_id} style={{ width: slideWidth }}>
                          <TurmaResumoCard t={t} />
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
                <View style={styles.dots}>
                  {turmasComChamada.map((t, i) => (
                    <View
                      key={t.turma_id}
                      style={[styles.dot, i === carouselIdx && styles.dotActive]}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Relatório de professores</Text>
            <Text style={styles.cardDesc}>Aqui você acompanha o relatório dos professores na aula selecionada.</Text>
            <View style={styles.statGrid}>
              <StatBox label="Matriculados" value={resumo.professores.matriculados} />
              <StatBox label="Presentes" value={resumo.professores.presentes} />
              <StatBox label="Ausentes" value={resumo.professores.ausentes} />
              <StatBox label="Presença" value={`${resumo.professores.presenca_pct}%`} full />
            </View>
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
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 8 },
  cardDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 14 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: colors.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.6 },
  turmaCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  turmaCardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  carouselViewport: { width: '100%', marginTop: 4 },
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  muted: { fontSize: 14, color: colors.textMuted },
  err: { margin: 20, color: colors.danger, textAlign: 'center' },
});
}
