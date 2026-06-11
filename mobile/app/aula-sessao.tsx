import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiGetRelatorio,
  apiGetAulaResumo,
  apiListEscala,
  apiListTurmas,
  apiLoadChamadaLinhas,
  apiLoadProfessoresChamadaLinhas,
  apiListUsuarios,
  apiStoreFrequencia,
  apiStoreProfessoresChamada,
  apiStoreRelatorio,
  type EscalaAulaRow,
  type FrequenciaAlunoLinha,
  type ProfessorChamadaLinha,
  type RelatorioDetalhe,
  type TurmaListItem,
  isApiConfigured,
} from '@/lib/api';
import { markRelatorioGeralDisponivel } from '@/lib/geral-report-gate';
import * as Haptics from 'expo-haptics';

/** Dourado para favorito na sessão de aula. */
const GOLD_ACCENT = '#C5A028';
const GREEN_DONE = '#2D6B3A';
function formatMoneyBr(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

function parseMoneyBr(s: string): number {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

type RelatorioTurmaState = {
  total_biblias: number;
  total_revistas: number;
  total_visitantes: number;
  valor_oferta: string;
  observacoes: string;
};

function relatorioVazio(): RelatorioTurmaState {
  return {
    total_biblias: 0,
    total_revistas: 0,
    total_visitantes: 0,
    valor_oferta: '0,00',
    observacoes: '',
  };
}

function relatorioFromApi(r: RelatorioDetalhe): RelatorioTurmaState {
  return {
    total_biblias: r.total_biblias,
    total_revistas: r.total_revistas,
    total_visitantes: r.total_visitantes,
    valor_oferta: formatMoneyBr(r.valor_oferta),
    observacoes: r.observacoes ?? '',
  };
}

type Phase = 'hub' | 'turma';

function turmaChamadaPendente(
  linhaEscala: EscalaAulaRow | null,
  relatorio: RelatorioDetalhe | null,
  matriculados: number,
): boolean {
  if (matriculados <= 0) {
    return relatorio == null;
  }
  const chamadas = Math.max(
    linhaEscala?.chamadas_registadas ?? 0,
    relatorio?.chamadas_registadas ?? 0,
  );
  return chamadas <= 0;
}

function voltarAoHubAula(setPhase: (p: Phase) => void, phaseRef: React.MutableRefObject<Phase>) {
  setPhase('hub');
  phaseRef.current = 'hub';
}

function MetricStepper({
  value,
  setValue,
  min = 0,
}: {
  value: number;
  setValue: (n: number) => void;
  min?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => setValue(Math.max(min, value - 1))} style={styles.stepperBtn} hitSlop={6}>
        <FontAwesome name="chevron-down" size={16} color={colors.text} />
      </Pressable>
      <Text style={styles.stepperVal}>{value}</Text>
      <Pressable onPress={() => setValue(value + 1)} style={styles.stepperBtn} hitSlop={6}>
        <FontAwesome name="chevron-up" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default function AulaSessaoScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId, authMode } = useAuth();
  const { requestPortalRefresh, requestAulaFinalizadaCelebration, setSwipePage } = useMainSwipe();
  const params = useLocalSearchParams<{
    turmaId: string;
    dataAula: string;
    numeroLicao?: string;
    turmaNome?: string;
  }>();

  const initialTurmaId = Number(params.turmaId);
  const dataAula = typeof params.dataAula === 'string' ? params.dataAula : '';
  const numeroFromParam =
    params.numeroLicao != null && params.numeroLicao !== ''
      ? Number(params.numeroLicao)
      : null;
  const turmaNomeParam = typeof params.turmaNome === 'string' ? params.turmaNome : '';

  const [phase, setPhase] = useState<Phase>('hub');
  const [turmaFocusId, setTurmaFocusId] = useState(initialTurmaId);
  const [favorito, setFavorito] = useState(false);

  const [turmas, setTurmas] = useState<TurmaListItem[]>([]);
  const [turmaPending, setTurmaPending] = useState<Record<number, boolean>>({});
  const [linhaEscala, setLinhaEscala] = useState<EscalaAulaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [relatoriosPorTurma, setRelatoriosPorTurma] = useState<Record<number, RelatorioTurmaState>>({});
  const [professoresLinhas, setProfessoresLinhas] = useState<ProfessorChamadaLinha[]>([]);
  const [professoresSemTurma, setProfessoresSemTurma] = useState(0);
  const [chamadaLinhas, setChamadaLinhas] = useState<FrequenciaAlunoLinha[]>([]);
  const [chamadaErro, setChamadaErro] = useState<string | null>(null);
  const [loadingChamada, setLoadingChamada] = useState(false);
  const [aulaFinalizada, setAulaFinalizada] = useState(false);
  const [resumoMetricas, setResumoMetricas] = useState<{
    biblias: number;
    revistas: number;
    oferta: number;
  } | null>(null);

  const phaseRef = useRef<Phase>(phase);
  const turmaFocusRef = useRef(turmaFocusId);
  const loadSeqRef = useRef(0);
  const dataAulaRef = useRef(dataAula);
  phaseRef.current = phase;
  turmaFocusRef.current = turmaFocusId;
  dataAulaRef.current = dataAula;

  const tituloLinha = useMemo(() => {
    const num =
      linhaEscala?.numero_licao != null
        ? String(linhaEscala.numero_licao)
        : numeroFromParam != null && !Number.isNaN(numeroFromParam)
          ? String(numeroFromParam)
          : null;
    return num != null ? `Lição ${num}` : 'Aula';
  }, [linhaEscala?.numero_licao, numeroFromParam]);

  const nomeTurmaCabecalho = useMemo(() => {
    if (phase === 'turma') {
      const nomeLista = turmas.find((x) => x.id === turmaFocusId)?.nome_turma;
      return (nomeLista && nomeLista.trim() !== '' ? nomeLista : turmaNomeParam) || 'Turma';
    }
    return '';
  }, [phase, turmaFocusId, turmas, turmaNomeParam]);

  const usaApi =
    isApiConfigured() &&
    getActiveDataBackend() !== null &&
    authMode === 'api' &&
    congregacaoId != null &&
    congregacaoId > 0;

  const relatorioAtual = useMemo(
    () => relatoriosPorTurma[turmaFocusId] ?? relatorioVazio(),
    [relatoriosPorTurma, turmaFocusId],
  );

  const patchRelatorio = useCallback((tid: number, patch: Partial<RelatorioTurmaState>) => {
    setRelatoriosPorTurma((prev) => ({
      ...prev,
      [tid]: { ...(prev[tid] ?? relatorioVazio()), ...patch },
    }));
  }, []);

  const carregarChamada = useCallback(
    async (tid: number) => {
      if (!usaApi || tid <= 0 || !dataAula) {
        setChamadaLinhas([]);
        setChamadaErro(null);
        return;
      }
      setLoadingChamada(true);
      try {
        const { linhas, error } = await apiLoadChamadaLinhas(tid, dataAula, congregacaoId);
        if (phaseRef.current === 'turma' && turmaFocusRef.current === tid) {
          setChamadaLinhas(linhas);
          setChamadaErro(error);
        }
      } catch {
        if (phaseRef.current === 'turma' && turmaFocusRef.current === tid) {
          setChamadaLinhas([]);
          setChamadaErro('Sem ligação ao servidor.');
        }
      } finally {
        setLoadingChamada(false);
      }
    },
    [usaApi, congregacaoId, dataAula],
  );

  const carregar = useCallback(async () => {
    if (!usaApi || !Number.isFinite(initialTurmaId) || initialTurmaId <= 0 || !dataAula) {
      setLoading(false);
      return;
    }
    const seq = ++loadSeqRef.current;
    const dataAulaSnapshot = dataAula;
    setLoading(true);
    try {
      const tr = await apiListTurmas(congregacaoId ?? undefined);
      if (seq !== loadSeqRef.current || dataAulaRef.current !== dataAulaSnapshot) {
        return;
      }
      if (tr.ok) {
        setTurmas(tr.turmas);
        const pendingMap: Record<number, boolean> = {};
        const relMap: Record<number, RelatorioTurmaState> = {};
        await Promise.all(
          tr.turmas.map(async (t) => {
            const [es, rel] = await Promise.all([
              apiListEscala(t.id),
              apiGetRelatorio(t.id, dataAula),
            ]);
            if (!es.ok) {
              pendingMap[t.id] = true;
            } else {
              const linha = es.escala.find((e) => e.data_aula === dataAula) ?? null;
              const relDetalhe = rel.ok ? rel.relatorio : null;
              pendingMap[t.id] = turmaChamadaPendente(linha, relDetalhe, t.alunos_count ?? 0);
            }
            if (rel.ok && rel.relatorio) {
              relMap[t.id] = relatorioFromApi(rel.relatorio);
            } else {
              relMap[t.id] = relatorioVazio();
            }
          }),
        );
        if (seq !== loadSeqRef.current || dataAulaRef.current !== dataAulaSnapshot) {
          return;
        }
        setTurmaPending(pendingMap);
        setRelatoriosPorTurma(relMap);
      }

      if (seq !== loadSeqRef.current || dataAulaRef.current !== dataAulaSnapshot) {
        return;
      }

      const listaTurmas = tr.ok ? tr.turmas : [];
      const linhasProf = await apiLoadProfessoresChamadaLinhas(
        dataAula,
        congregacaoId ?? 0,
        listaTurmas,
      );
      if (seq === loadSeqRef.current && dataAulaRef.current === dataAulaSnapshot) {
        setProfessoresLinhas(linhasProf);
        if (linhasProf.length === 0 && congregacaoId != null && congregacaoId > 0) {
          try {
            const ur = await apiListUsuarios({ congregacaoId, limit: 500 });
            const semTurma =
              ur.ok
                ? ur.usuarios.filter(
                    (u) =>
                      String(u.nivel_acesso ?? '').toLowerCase() === 'professor' &&
                      (u.turma_id == null || u.turma_id <= 0),
                  ).length
                : 0;
            setProfessoresSemTurma(semTurma);
          } catch {
            setProfessoresSemTurma(0);
          }
        } else {
          setProfessoresSemTurma(0);
        }
      }

      const escalaTurmaId =
        phaseRef.current === 'turma' ? turmaFocusRef.current : initialTurmaId;
      const es = await apiListEscala(escalaTurmaId);
      if (seq !== loadSeqRef.current || dataAulaRef.current !== dataAulaSnapshot) {
        return;
      }
      if (es.ok) {
        const linha = es.escala.find((e) => e.data_aula === dataAula) ?? null;
        setLinhaEscala(linha);
      } else {
        setLinhaEscala(null);
      }

      if (phaseRef.current === 'turma') {
        await carregarChamada(turmaFocusRef.current);
      } else if (phaseRef.current === 'hub') {
        setChamadaLinhas([]);
        setChamadaErro(null);
      }

      if (
        seq === loadSeqRef.current &&
        dataAulaRef.current === dataAulaSnapshot &&
        congregacaoId != null &&
        congregacaoId > 0
      ) {
        try {
          const ar = await apiGetAulaResumo(dataAulaSnapshot, congregacaoId);
          if (ar.ok && seq === loadSeqRef.current && dataAulaRef.current === dataAulaSnapshot) {
            setAulaFinalizada(ar.finalizada);
            setResumoMetricas(
              ar.finalizada
                ? { biblias: ar.geral.biblias, revistas: ar.geral.revistas, oferta: ar.geral.oferta }
                : null,
            );
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      if (seq === loadSeqRef.current && dataAulaRef.current === dataAulaSnapshot) {
        Alert.alert('Rede', 'Sem ligação ao servidor.');
      }
    } finally {
      if (seq === loadSeqRef.current && dataAulaRef.current === dataAulaSnapshot) {
        setLoading(false);
      }
    }
  }, [usaApi, carregarChamada, congregacaoId, dataAula, initialTurmaId]);

  /** Nova aula na mesma rota — limpa dados da sessão anterior (Expo Router reutiliza o ecrã). */
  useEffect(() => {
    loadSeqRef.current += 1;
    setPhase('hub');
    phaseRef.current = 'hub';
    setTurmaFocusId(initialTurmaId);
    turmaFocusRef.current = initialTurmaId;
    setRelatoriosPorTurma({});
    setProfessoresLinhas([]);
    setProfessoresSemTurma(0);
    setChamadaLinhas([]);
    setChamadaErro(null);
    setTurmaPending({});
    setLinhaEscala(null);
    setTurmas([]);
    setAulaFinalizada(false);
    setResumoMetricas(null);
    setLoading(true);
  }, [dataAula, initialTurmaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function guardarProfessoresChamada(): Promise<boolean> {
    if (!dataAula || professoresLinhas.length === 0) {
      return true;
    }
    const res = await apiStoreProfessoresChamada({
      data_aula: dataAula,
      linhas: professoresLinhas.map((p) => ({
        usuario_id: p.id,
        turma_id: p.turma_id,
        presenca: p.presenca,
      })),
    });
    return res.ok;
  }

  async function guardarRelatorioTurma(
    tid: number,
    status: 'rascunho' | 'enviado',
    incluirAlunos: boolean,
  ): Promise<boolean> {
    if (!Number.isFinite(tid) || tid <= 0 || !dataAula) {
      return false;
    }
    const rel = relatoriosPorTurma[tid] ?? relatorioVazio();
    const res = await apiStoreRelatorio({
      turma_id: tid,
      data_aula: dataAula,
      total_biblias: rel.total_biblias,
      total_revistas: rel.total_revistas,
      total_visitantes: rel.total_visitantes,
      valor_oferta: parseMoneyBr(rel.valor_oferta),
      observacoes: rel.observacoes.trim() !== '' ? rel.observacoes.trim() : null,
      status,
    });
    if (!res.ok) {
      return false;
    }
    if (incluirAlunos && tid === turmaFocusId && chamadaLinhas.length > 0) {
      const freqRes = await apiStoreFrequencia({
        turma_id: tid,
        data_aula: dataAula,
        linhas: chamadaLinhas.map((l) => ({
          usuario_id: l.id,
          presenca: l.presenca,
          biblia: l.biblia,
          revista: l.revista,
        })),
      });
      return freqRes.ok;
    }
    return true;
  }

  async function guardarHubRascunhoSilencioso(): Promise<void> {
    if (!usaApi) return;
    try {
      await guardarProfessoresChamada();
    } catch {
      /* ignore silent save */
    }
  }

  function turmasComChamadaPendente(): TurmaListItem[] {
    return turmas.filter((t) => turmaPending[t.id] !== false);
  }

  async function guardar(status: 'rascunho' | 'enviado' = 'rascunho') {
    if (!usaApi || !dataAula) {
      return;
    }

    if (status === 'enviado') {
      const pendentes = turmasComChamadaPendente();
      if (phase === 'hub' && pendentes.length > 0) {
        Alert.alert(
          'Chamadas pendentes',
          `Faça a chamada em todas as turmas antes de enviar o relatório:\n${pendentes.map((t) => `• ${t.nome_turma}`).join('\n')}`,
        );
        return;
      }
      if (phase === 'turma') {
        const turmaAtual = turmas.find((t) => t.id === turmaFocusId);
        const matriculados = turmaAtual?.alunos_count ?? 0;
        const chamadaJaNoServidor = turmaPending[turmaFocusId] === false;
        const chamadaNaTela = chamadaLinhas.length > 0;
        if (matriculados > 0 && !chamadaJaNoServidor && !chamadaNaTela) {
          Alert.alert('Chamada', 'Faça a chamada dos alunos antes de enviar o relatório.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (phase === 'hub') {
        let ok = await guardarProfessoresChamada();
        for (const t of turmas) {
          const saved = await guardarRelatorioTurma(t.id, status, false);
          ok = ok && saved;
        }
        if (ok) {
          if (status === 'enviado') {
            let aulaCompleta = false;
            if (congregacaoId != null && congregacaoId > 0) {
              try {
                const ar = await apiGetAulaResumo(dataAula, congregacaoId);
                aulaCompleta = ar.ok && ar.finalizada;
                if (aulaCompleta) {
                  await markRelatorioGeralDisponivel(congregacaoId);
                }
              } catch {
                /* ignore */
              }
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            requestPortalRefresh();
            setSwipePage(0, { animated: false });
            router.back();
            if (aulaCompleta) {
              setTimeout(() => {
                requestAulaFinalizadaCelebration();
              }, 400);
            }
            return;
          }
          Alert.alert('Guardado', 'Rascunho guardado.');
          void carregar();
        } else {
          Alert.alert('Erro', 'Não foi possível guardar todos os dados.');
        }
        return;
      }

      const tid = turmaFocusId;
      const ok = await guardarRelatorioTurma(tid, status, true);
      if (ok) {
        setChamadaLinhas([]);
        setChamadaErro(null);
        voltarAoHubAula(setPhase, phaseRef);
        Alert.alert(
          'Guardado',
          status === 'enviado' ? 'Relatório enviado.' : 'Chamada guardada.',
        );
        void carregar();
      } else {
        Alert.alert('Erro', 'Não foi possível guardar.');
      }
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setSaving(false);
    }
  }

  const abrirResumo = () => {
    router.push({
      pathname: '/aula-resumo',
      params: {
        dataAula,
        numeroLicao:
          linhaEscala?.numero_licao != null
            ? String(linhaEscala.numero_licao)
            : numeroFromParam != null && !Number.isNaN(numeroFromParam)
              ? String(numeroFromParam)
              : '',
      },
    });
  };

  async function abrirTurma(t: TurmaListItem) {
    await guardarHubRascunhoSilencioso();
    setChamadaLinhas([]);
    setChamadaErro(null);
    setLoadingChamada(true);
    setTurmaFocusId(t.id);
    setPhase('turma');
    turmaFocusRef.current = t.id;
    phaseRef.current = 'turma';
    try {
      const es = await apiListEscala(t.id);
      if (es.ok) {
        setLinhaEscala(es.escala.find((e) => e.data_aula === dataAula) ?? null);
      }
    } catch {
      setLinhaEscala(null);
    }
    void carregarChamada(t.id);
  }

  async function onPressVoltar() {
    if (phase === 'turma') {
      const tid = turmaFocusId;
      const pid = linhaEscala?.professor_usuario_id;
      let profsAtualizados = professoresLinhas;
      if (pid != null && pid > 0) {
        profsAtualizados = professoresLinhas.map((p) =>
          p.id === pid && p.turma_id === tid ? { ...p, presenca: true } : p,
        );
        setProfessoresLinhas(profsAtualizados);
      }
      setSaving(true);
      try {
        await guardarRelatorioTurma(tid, 'rascunho', true);
        if (profsAtualizados.length > 0) {
          await apiStoreProfessoresChamada({
            data_aula: dataAula,
            linhas: profsAtualizados.map((p) => ({
              usuario_id: p.id,
              turma_id: p.turma_id,
              presenca: p.presenca,
            })),
          });
        }
      } catch {
        /* ignore */
      } finally {
        setSaving(false);
      }
      setChamadaLinhas([]);
      setChamadaErro(null);
      voltarAoHubAula(setPhase, phaseRef);
      void carregar();
      return;
    }
    await guardarHubRascunhoSilencioso();
    router.back();
  }

  if (!Number.isFinite(initialTurmaId) || initialTurmaId <= 0 || dataAula === '') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.err}>Parâmetros em falta.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onPressVoltar} style={styles.iconBtn} accessibilityLabel="Voltar">
            <FontAwesome name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {phase === 'hub' ? tituloLinha : nomeTurmaCabecalho}
          </Text>
          <Pressable
            onPress={() => setFavorito((f) => !f)}
            style={styles.iconBtn}
            accessibilityLabel={favorito ? 'Remover dos favoritos' : 'Favoritar'}
          >
            <FontAwesome name={favorito ? 'star' : 'star-o'} size={22} color={GOLD_ACCENT} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={[
              styles.scroll,
              { flexGrow: 1, paddingBottom: 24 + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {phase === 'hub' ? (
              <>
                {aulaFinalizada ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Relatório Geral</Text>
                    <Text style={styles.cardDesc}>
                      O relatório geral é o conjunto de dados e estatísticas do dia de aula. É necessário que todas
                      as chamadas estejam concluídas para obter uma melhor experiência.
                    </Text>
                    <Pressable
                      onPress={abrirResumo}
                      style={({ pressed }) => [styles.ctaPrimaryInCard, pressed && { opacity: 0.9 }]}
                    >
                      <Text style={styles.ctaPrimaryText}>VER RESUMO</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.hubLead}>
                    Registre a chamada e o relatório em cada classe. Clique sobre o nome da turma para fazer ou
                    alterar a chamada.
                  </Text>
                )}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Relatórios por classes</Text>
                  <Text style={styles.cardDesc}>
                    Aqui você acompanha o relatório das chamadas feitas em cada classe. Clique sobre o nome da turma
                    para fazer ou alterar a chamada.
                  </Text>
                  <View style={styles.turmasListInner}>
                    {turmas.map((t) => {
                      const pend = turmaPending[t.id] !== false;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => abrirTurma(t)}
                          style={({ pressed }) => [styles.turmaCard, pressed && { opacity: 0.92 }]}
                        >
                          <View
                            style={[
                              styles.turmaCardGold,
                              { backgroundColor: pend ? GOLD_ACCENT : GREEN_DONE },
                            ]}
                          />
                          <Text style={styles.turmaCardNome} numberOfLines={2}>
                            {t.nome_turma}
                          </Text>
                          <View
                            style={[
                              styles.warnDot,
                              { backgroundColor: pend ? '#F5C542' : GREEN_DONE },
                            ]}
                          >
                            <FontAwesome
                              name={pend ? 'exclamation' : 'check'}
                              size={14}
                              color={colors.white}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}

            {phase === 'hub' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Chamada de professores</Text>
                  <Text style={styles.cardDesc}>
                    {aulaFinalizada
                      ? 'Clique sobre os nomes dos professores para confirmar a presença. Professores presentes aparecem marcados.'
                      : 'Marque a presença de cada professor. Quem ministra a turma na escala já aparece presente.'}
                  </Text>
                  {professoresLinhas.length === 0 ? (
                    <Text style={styles.chamadaEmpty}>
                      {professoresSemTurma > 0
                        ? `Há ${professoresSemTurma} professor(es) sem turma. Na aba Cadastros, toque longo no nome → Alterar cadastro → escolha a turma.`
                        : 'Nenhum professor cadastrado. Adicione na aba Cadastros com a opção "Cadastrar como professor".'}
                    </Text>
                  ) : (
                    professoresLinhas.map((prof) => (
                      <Pressable
                        key={`${prof.id}_${prof.turma_id}`}
                        onPress={
                          aulaFinalizada
                            ? undefined
                            : () =>
                                setProfessoresLinhas((prev) =>
                                  prev.map((x) =>
                                    x.id === prof.id && x.turma_id === prof.turma_id
                                      ? { ...x, presenca: !x.presenca }
                                      : x,
                                  ),
                                )
                        }
                        style={styles.alunoRow}
                      >
                        <Text style={styles.alunoNome}>{prof.nome_real.toUpperCase()}</Text>
                        <FontAwesome
                          name="check-circle"
                          size={26}
                          color={prof.presenca ? GREEN_DONE : colors.border}
                        />
                      </Pressable>
                    ))
                  )}
                </View>

                {aulaFinalizada && resumoMetricas ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Relatório de professores</Text>
                    <Text style={styles.cardDesc}>
                      Apenas os usuários administradores têm acesso ao relatório completo de professores.
                    </Text>
                    <View style={styles.metricRow}>
                      <FontAwesome name="book" size={22} color="#2D8A8A" style={styles.metricIcon} />
                      <Text style={styles.metricLabel}>Bíblias</Text>
                      <Text style={styles.metricReadonly}>{resumoMetricas.biblias}</Text>
                    </View>
                    <View style={styles.metricRow}>
                      <FontAwesome name="pencil" size={22} color="#8B6914" style={styles.metricIcon} />
                      <Text style={styles.metricLabel}>Revistas</Text>
                      <Text style={styles.metricReadonly}>{resumoMetricas.revistas}</Text>
                    </View>
                    <View style={styles.metricRow}>
                      <FontAwesome name="money" size={22} color="#2D6B3A" style={styles.metricIcon} />
                      <Text style={styles.metricLabel}>Oferta</Text>
                      <Text style={styles.metricReadonly}>{formatMoneyBr(resumoMetricas.oferta)}</Text>
                    </View>
                  </View>
                ) : null}

                {!aulaFinalizada ? (
                  <Pressable
                    onPress={() => guardar('enviado')}
                    disabled={saving}
                    style={[styles.ctaPrimary, saving && { opacity: 0.75 }]}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.ctaPrimaryText}>ENVIAR RELATÓRIO</Text>
                    )}
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Chamada dos alunos</Text>
                  <Text style={styles.cardDesc}>
                    Clique sobre os nomes dos alunos para confirmar a presença
                  </Text>
                  {loadingChamada ? (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
                  ) : chamadaErro ? (
                    <Text style={styles.chamadaEmpty}>{chamadaErro}</Text>
                  ) : chamadaLinhas.length === 0 ? null : (
                    chamadaLinhas.map((aluno) => (
                      <Pressable
                        key={aluno.id}
                        onPress={() =>
                          setChamadaLinhas((prev) =>
                            prev.map((x) => (x.id === aluno.id ? { ...x, presenca: !x.presenca } : x)),
                          )
                        }
                        style={styles.alunoRow}
                      >
                        <Text style={styles.alunoNome}>{aluno.nome_real.toUpperCase()}</Text>
                        <FontAwesome
                          name="check-circle"
                          size={28}
                          color={aluno.presenca ? colors.primary : colors.border}
                        />
                      </Pressable>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Relatório da classe</Text>
                  <Text style={styles.cardDesc}>
                    Clique nas setas para somar ou subtrair os itens. Pressione em qualquer lugar para somar
                    rapidamente.
                  </Text>

                  <View style={styles.metricRow}>
                    <FontAwesome name="book" size={22} color="#2D8A8A" style={styles.metricIcon} />
                    <Text style={styles.metricLabel}>Bíblias</Text>
                    <MetricStepper
                      value={relatorioAtual.total_biblias}
                      setValue={(v) => patchRelatorio(turmaFocusId, { total_biblias: v })}
                    />
                  </View>

                  <View style={styles.metricRow}>
                    <FontAwesome name="pencil" size={22} color="#8B6914" style={styles.metricIcon} />
                    <Text style={styles.metricLabel}>Revistas</Text>
                    <MetricStepper
                      value={relatorioAtual.total_revistas}
                      setValue={(v) => patchRelatorio(turmaFocusId, { total_revistas: v })}
                    />
                  </View>

                  <View style={styles.metricRow}>
                    <FontAwesome name="users" size={22} color="#C2410C" style={styles.metricIcon} />
                    <Text style={styles.metricLabel}>Visitantes</Text>
                    <MetricStepper
                      value={relatorioAtual.total_visitantes}
                      setValue={(v) => patchRelatorio(turmaFocusId, { total_visitantes: v })}
                    />
                  </View>

                  <View style={styles.metricRow}>
                    <FontAwesome name="money" size={22} color="#2D6B3A" style={styles.metricIcon} />
                    <Text style={styles.metricLabel}>Oferta</Text>
                    <TextInput
                      style={styles.ofertaInput}
                      value={`R$ ${relatorioAtual.valor_oferta}`}
                      onChangeText={(tx) => {
                        const dig = tx.replace(/^R\$\s*/, '').replace(/[^\d,.]/g, '');
                        patchRelatorio(turmaFocusId, { valor_oferta: dig });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="R$ 0,00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.obsRow}>
                    <TextInput
                      style={styles.obsInline}
                      value={relatorioAtual.observacoes}
                      onChangeText={(v) => patchRelatorio(turmaFocusId, { observacoes: v })}
                      placeholder="Insira uma anotação"
                      placeholderTextColor={colors.textMuted}
                      multiline
                    />
                    <FontAwesome name="plus-circle" size={22} color={colors.textMuted} />
                  </View>
                </View>

                <Pressable
                  onPress={() => guardar('enviado')}
                  disabled={saving}
                  style={[styles.ctaPrimary, saving && { opacity: 0.75 }]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.ctaPrimaryText}>ENVIAR RELATÓRIO</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => guardar('rascunho')}
                  disabled={saving}
                  style={[styles.ctaDraft, saving && { opacity: 0.75 }]}
                >
                  <Text style={styles.ctaDraftText}>Guardar rascunho</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.card },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.card,
  },
  err: { color: colors.danger, marginBottom: 16 },
  backLink: { padding: 8 },
  backLinkText: { color: colors.primary, fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  hubLead: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 14,
  },
  scroll: { paddingTop: 8 },
  turmasList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 18,
    width: '100%',
  },
  turmasListInner: { gap: 12, width: '100%' },
  turmaCard: {
    width: '100%',
    minHeight: 56,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  turmaCardGold: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  turmaCardNome: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'left',
    paddingLeft: 8,
    paddingRight: 8,
  },
  warnDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 14 },
  alunoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.background,
  },
  alunoNome: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginRight: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  metricIcon: { marginRight: 12, width: 28, textAlign: 'center' },
  metricLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  stepperVal: { fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  ofertaInput: {
    minWidth: 110,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  obsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.card,
  },
  obsInline: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    maxHeight: 80,
    paddingVertical: 0,
  },
  ctaPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaPrimaryInCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  metricReadonly: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 40, textAlign: 'right' },
  ctaPrimaryText: { color: colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.6 },
  ctaDraft: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaDraftText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  chamadaEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
}
