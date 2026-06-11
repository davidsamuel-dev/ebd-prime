import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, isValid, parse, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { InfoHintCard } from '@/components/InfoHintCard';
import { LongPressCard } from '@/components/LongPressCard';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { type ThemeColors } from '@/constants/theme';
import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiDeleteEscalaAula,
  apiListEscala,
  apiListTurmas,
  apiListUsuarios,
  apiUpdateEscalaAula,
  type EscalaAulaRow,
  type UsuarioListItem,
} from '@/lib/api';
import {
  getPortalInicioOnboardingDone,
  setPortalInicioOnboardingDone,
} from '@/lib/inicio-onboarding-storage';

const SHEET_OFF_Y = Math.round(Dimensions.get('window').height * 0.55);

/** Laranja do cartão pendente (referência visual do mockup). */
const AULA_ORANGE = '#E8944A';

const STEP_DEFS: { key: string; title: string; hint: string }[] = [
  {
    key: '1',
    title: '1º Cadastre as turmas',
    hint: 'Clique na aba ☰ Turmas e insira uma nova turma',
  },
  {
    key: '2',
    title: '2º Cadastre os alunos',
    hint: 'Clique na aba 👥 Cadastros e insira um novo aluno',
  },
  {
    key: '3',
    title: '3º Cadastre os professores',
    hint: 'Clique na aba 👥 Cadastros e insira um novo professor',
  },
  {
    key: '4',
    title: '4º Insira uma aula',
    hint: 'Clique no botão + no topo desta tela para inserir',
  },
];

type AulaCard = {
  row: EscalaAulaRow;
  turmaNome: string;
};

/** Aluno = perfil sem_login com vínculo ativo a uma turma (evita contar admin com nível em falta). */
function countAlunosOnboarding(usuarios: UsuarioListItem[]): number {
  return usuarios.filter((u) => {
    const nivel = String(u.nivel_acesso ?? '').toLowerCase();
    if (nivel !== 'sem_login') return false;
    const tid = u.turma_id != null && Number(u.turma_id) > 0;
    const label = u.turma_label != null && String(u.turma_label).trim() !== '';
    return tid || label;
  }).length;
}

function formatAulaCardTitulo(row: EscalaAulaRow): string {
  const lic =
    row.numero_licao != null && !Number.isNaN(Number(row.numero_licao))
      ? `Lição ${row.numero_licao}`
      : 'Aula';
  let dataFmt = row.data_aula;
  try {
    dataFmt = format(parseISO(row.data_aula), 'EEEE, dd/MM', { locale: ptBR });
    dataFmt = dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1);
  } catch {
    /* manter bruto */
  }
  return `${lic} - ${dataFmt}`;
}

function aulaCardFinalizada(row: EscalaAulaRow): boolean {
  const chamadaFeita = (row.chamadas_registadas ?? 0) > 0;
  const enviado = String(row.relatorio_status ?? '').toLowerCase() === 'enviado';
  return chamadaFeita && enviado;
}

function aulaCardMediaPct(row: EscalaAulaRow): number {
  if (row.media_pct != null && Number.isFinite(row.media_pct)) {
    return Math.round(row.media_pct);
  }
  const p = row.presentes ?? 0;
  const a = row.ausentes ?? 0;
  const tot = p + a;
  return tot > 0 ? Math.round((100 * p) / tot) : 0;
}

export function InicioPage() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createInicioStyles(colors), [colors]);
  const { userName, authMode, congregacaoId, userId } = useAuth();
  const { portalRefreshKey, requestPortalRefresh } = useMainSwipe();
  const first = userName.split(/\s+/)[0] ?? userName;

  const [aulas, setAulas] = useState<AulaCard[]>([]);
  const [aulasLoading, setAulasLoading] = useState(false);
  const [aulasError, setAulasError] = useState<string | null>(null);
  /** `null` = ainda a carregar estado persistido / dados iniciais. */
  const [tutorialHidden, setTutorialHidden] = useState<boolean | null>(null);
  const [onboardingCounts, setOnboardingCounts] = useState({
    turmas: 0,
    alunos: 0,
    professores: 0,
    aulas: 0,
  });

  const [editAula, setEditAula] = useState<AulaCard | null>(null);
  const [dataAulaBr, setDataAulaBr] = useState('');
  const [numeroLicao, setNumeroLicao] = useState(1);
  const [sheetBusy, setSheetBusy] = useState(false);
  const slideY = useRef(new Animated.Value(SHEET_OFF_Y)).current;

  const loadPortalInicio = useCallback(async () => {
    const demo = authMode === 'demo' || getActiveDataBackend() === null;
    if (demo || congregacaoId == null || congregacaoId <= 0) {
      setAulas([]);
      setAulasError(null);
      setAulasLoading(false);
      setTutorialHidden(true);
      setOnboardingCounts({ turmas: 0, alunos: 0, professores: 0, aulas: 0 });
      return;
    }

    const uid = userId != null && userId > 0 ? userId : 0;

    setOnboardingCounts({ turmas: 0, alunos: 0, professores: 0, aulas: 0 });
    setAulas([]);
    setAulasLoading(true);
    setAulasError(null);
    setTutorialHidden(null);

    try {
      const [storedDone, tr] = await Promise.all([
        getPortalInicioOnboardingDone(congregacaoId, uid),
        apiListTurmas(congregacaoId),
      ]);

      if (!tr.ok || (tr.turmas?.length ?? 0) === 0) {
        setOnboardingCounts({ turmas: 0, alunos: 0, professores: 0, aulas: 0 });
        setAulas([]);
        const allLive = false;
        const hide = storedDone || allLive;
        setTutorialHidden(hide);
        return;
      }

      const nomePorTurma = new Map(tr.turmas.map((t) => [t.id, t.nome_turma]));
      const [ur, ...escalaResults] = await Promise.all([
        apiListUsuarios({ congregacaoId, limit: 1000 }),
        ...tr.turmas.map(async (t) => {
          const er = await apiListEscala(t.id);
          return { turmaId: t.id, er };
        }),
      ]);

      const usuarios = ur.ok ? ur.usuarios : [];
      const nAlunos = countAlunosOnboarding(usuarios);
      const nProfessores = usuarios.filter(
        (u) => String(u.nivel_acesso ?? '').toLowerCase() === 'professor',
      ).length;

      const merged: AulaCard[] = [];
      for (const { turmaId, er } of escalaResults) {
        if (!er.ok) continue;
        const nome = nomePorTurma.get(turmaId) ?? '';
        for (const row of er.escala) {
          merged.push({ row, turmaNome: nome });
        }
      }
      merged.sort((a, b) => (a.row.data_aula < b.row.data_aula ? 1 : -1));

      const nTurmas = tr.turmas.length;
      const nAulas = merged.length;
      setOnboardingCounts({
        turmas: nTurmas,
        alunos: nAlunos,
        professores: nProfessores,
        aulas: nAulas,
      });

      const allLive =
        nTurmas >= 1 && nAlunos >= 1 && nProfessores >= 1 && nAulas >= 1;
      let hide = storedDone || allLive;
      if (allLive && !storedDone) {
        await setPortalInicioOnboardingDone(congregacaoId, uid);
        hide = true;
      }
      setTutorialHidden(hide);
      setAulas(merged.slice(0, hide ? 24 : 8));
    } catch {
      setAulas([]);
      setAulasError('Não foi possível carregar as aulas.');
      setOnboardingCounts({ turmas: 0, alunos: 0, professores: 0, aulas: 0 });
      setTutorialHidden(false);
    } finally {
      setAulasLoading(false);
    }
  }, [authMode, congregacaoId, userId]);

  useEffect(() => {
    void loadPortalInicio();
  }, [loadPortalInicio, portalRefreshKey]);

  const openAula = (a: AulaCard) => {
    const nome = a.turmaNome || 'Turma';
    router.push({
      pathname: '/aula-sessao',
      params: {
        turmaId: String(a.row.turma_id),
        dataAula: a.row.data_aula,
        turmaNome: nome,
        numeroLicao:
          a.row.numero_licao != null && !Number.isNaN(Number(a.row.numero_licao))
            ? String(a.row.numero_licao)
            : '',
      },
    });
  };

  const closeEditSheet = useCallback(() => {
    Animated.timing(slideY, {
      toValue: SHEET_OFF_Y,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setEditAula(null);
        setDataAulaBr('');
        setNumeroLicao(1);
      }
    });
  }, [slideY]);

  const openEditAulaSheet = useCallback(
    (a: AulaCard) => {
      const semBackend = authMode === 'demo' || getActiveDataBackend() === null;
      if (semBackend) {
        Alert.alert(
          'Alterar aula',
          'Inicie sessão com a API configurada para alterar ou remover aulas.',
        );
        return;
      }
      let br = a.row.data_aula;
      try {
        br = format(parseISO(a.row.data_aula), 'dd/MM/yyyy');
      } catch {
        /* manter bruto */
      }
      setDataAulaBr(br);
      const n = Number(a.row.numero_licao);
      setNumeroLicao(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
      setEditAula(a);
      slideY.setValue(SHEET_OFF_Y);
      requestAnimationFrame(() => {
        Animated.timing(slideY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    },
    [authMode, slideY],
  );

  const parseDataIso = (br: string): string | null => {
    const t = br.trim();
    try {
      const d = parse(t, 'dd/MM/yyyy', new Date());
      if (!isValid(d)) return null;
      return format(d, 'yyyy-MM-dd');
    } catch {
      return null;
    }
  };

  const handleAtualizarAula = async () => {
    if (!editAula) return;
    const iso = parseDataIso(dataAulaBr);
    if (!iso) {
      Alert.alert('Data da aula', 'Use o formato dd/mm/aaaa (ex.: 06/05/2026).');
      return;
    }
    setSheetBusy(true);
    try {
      const res = await apiUpdateEscalaAula({
        turma_id: editAula.row.turma_id,
        data_aula_anterior: editAula.row.data_aula,
        data_aula: iso,
        numero_licao: numeroLicao,
      });
      if (res.ok) {
        requestPortalRefresh();
        await loadPortalInicio();
        closeEditSheet();
        Alert.alert('Aula', res.message ?? 'Aula atualizada.');
      } else {
        Alert.alert('Aula', res.error ?? 'Não foi possível atualizar.');
      }
    } catch {
      Alert.alert('Aula', 'Sem ligação ou resposta inválida.');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleRemoverAula = () => {
    if (!editAula) return;
    Alert.alert(
      'Remover aula',
      'Serão apagadas as chamadas e os registos de ofertas desta data. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setSheetBusy(true);
            try {
              const res = await apiDeleteEscalaAula(editAula.row.turma_id, editAula.row.data_aula);
              if (res.ok) {
                requestPortalRefresh();
                await loadPortalInicio();
                closeEditSheet();
                Alert.alert('Aula', res.message ?? 'Aula removida.');
              } else {
                Alert.alert('Aula', res.error ?? 'Não foi possível remover.');
              }
            } catch {
              Alert.alert('Aula', 'Sem ligação ou resposta inválida.');
            } finally {
              setSheetBusy(false);
            }
          },
        },
      ],
    );
  };

  const demo = authMode === 'demo' || getActiveDataBackend() === null;
  const c = onboardingCounts;
  const stepDone = [c.turmas >= 1, c.alunos >= 1, c.professores >= 1, c.aulas >= 1];
  const doneCount = stepDone.filter(Boolean).length;
  const progress = doneCount / STEP_DEFS.length;
  const firstIncompleteIdx = stepDone.findIndex((d) => !d);
  const showOnboardingCard = !demo && tutorialHidden === false;

  const stepTitleWithCount = (idx: number, base: string) => {
    const n = idx === 0 ? c.turmas : idx === 1 ? c.alunos : idx === 2 ? c.professores : c.aulas;
    return n > 0 ? `${base} (${n})` : base;
  };

  const renderAulasSection = () => (
    <View style={styles.lessonsSection}>
      {aulasLoading ? (
        <View style={styles.lessonLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.lessonLoadingText}>A carregar…</Text>
        </View>
      ) : aulasError ? (
        <Text style={styles.lessonErr}>{aulasError}</Text>
      ) : demo ? (
        <View style={[styles.lessonCardOuter, styles.lessonCardPending]}>
          <View style={styles.lessonBanner}>
            <Text style={styles.lessonBannerText}>Clique sobre esta aula para enviar as chamadas</Text>
          </View>
          <View style={styles.lessonBody}>
            <View style={styles.lessonTop}>
              <Text style={styles.lessonTitle} numberOfLines={1} ellipsizeMode="tail">
                Lição 1 - Domingo, 07/06
              </Text>
              <Text style={styles.lessonAvg}>Média: 0%</Text>
            </View>
            <Text style={styles.statusPendente}>1 chamada pendente</Text>
            <View style={styles.lessonDivider} />
            <View style={styles.lessonStats}>
              <View style={styles.statCol}>
                <Text style={styles.stat}>Presentes: 0</Text>
              </View>
              <View style={styles.statDividerV} />
              <View style={styles.statCol}>
                <Text style={styles.stat}>Ausentes: 0</Text>
              </View>
            </View>
          </View>
        </View>
      ) : aulas.length === 0 ? (
        <View style={styles.lessonEmpty}>
          <FontAwesome name="calendar-o" size={40} color={colors.textMuted} />
          <Text style={styles.lessonEmptyText}>
            Ainda não há aulas na escala. Use o botão + no topo (ícone de calendário ou nova aula) para criar.
          </Text>
        </View>
      ) : (
        aulas.map((a) => {
          const finalizada = aulaCardFinalizada(a.row);
          const titulo = formatAulaCardTitulo(a.row);
          const media = aulaCardMediaPct(a.row);
          const presentes = a.row.presentes ?? 0;
          const ausentes = a.row.ausentes ?? 0;
          return (
            <LongPressCard
              key={`${a.row.turma_id}_${a.row.data_aula}_${a.row.id}`}
              onPress={() => openAula(a)}
              onLongPress={() => openEditAulaSheet(a)}
              style={[styles.lessonCardOuter, finalizada ? styles.lessonCardDone : styles.lessonCardPending]}
            >
              {!finalizada ? (
                <View style={styles.lessonBanner}>
                  <Text style={styles.lessonBannerText}>
                    Clique sobre esta aula para enviar as chamadas
                  </Text>
                </View>
              ) : null}
              <View style={styles.lessonBody}>
                <View style={styles.lessonTop}>
                  <Text style={styles.lessonTitle} numberOfLines={1} ellipsizeMode="tail">
                    {titulo}
                  </Text>
                  <Text style={styles.lessonAvg}>Média: {media}%</Text>
                </View>
                <Text style={finalizada ? styles.statusFinalizada : styles.statusPendente}>
                  {finalizada ? 'Chamadas finalizadas' : '1 chamada pendente'}
                </Text>
                <View style={styles.lessonDivider} />
                <View style={styles.lessonStats}>
                  <View style={styles.statCol}>
                    <Text style={styles.stat}>Presentes: {presentes}</Text>
                  </View>
                  <View style={styles.statDividerV} />
                  <View style={styles.statCol}>
                    <Text style={styles.stat}>Ausentes: {ausentes}</Text>
                  </View>
                </View>
              </View>
            </LongPressCard>
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showOnboardingCard ? (
          <View style={styles.heroCard}>
            <Text style={styles.greetTitle}>{first}, comece por aqui.</Text>

            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressFrac}>
                {doneCount}/{STEP_DEFS.length}
              </Text>
            </View>

            <Text style={styles.stepsLead}>Siga as etapas na seguinte ordem:</Text>

            {STEP_DEFS.map((step, idx) => {
              const done = stepDone[idx] ?? false;
              const isCurrent = !done && idx === firstIncompleteIdx;
              const isWaiting = !done && idx !== firstIncompleteIdx;
              const iconColor = done ? colors.primary : isWaiting ? colors.border : colors.text;
              return (
                <View key={step.key} style={[styles.stepCard, isWaiting && styles.stepMuted]}>
                  <View style={styles.stepTextCol}>
                    <Text style={styles.stepTitle}>{stepTitleWithCount(idx, step.title)}</Text>
                    <Text style={[styles.stepHint, isCurrent && styles.stepHintActive]}>{step.hint}</Text>
                  </View>
                  <FontAwesome
                    name={done ? 'check-circle' : 'circle-o'}
                    size={26}
                    color={iconColor}
                  />
                </View>
              );
            })}

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>
                <Text style={styles.tipStrong}>Dica: </Text>
                conclua os 4 passos acima para desbloquear todas as telas do app. Você pode inserir alunos e presenças
                fictícias por enquanto. O objetivo é que você conheça os recursos do app para utilizá-lo na próxima aula
                :)
              </Text>
            </View>
          </View>
        ) : null}

        {!showOnboardingCard && tutorialHidden === null && !demo ? (
          <View style={[styles.heroCard, styles.heroLoading]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.heroLoadingText}>A preparar o seu início…</Text>
          </View>
        ) : null}

        {!showOnboardingCard ? (
          <>
            {renderAulasSection()}
            <InfoHintCard>
              Toque num cartão para abrir relatório e chamada. Pressione e segure para alterar ou remover a aula da
              escala.
            </InfoHintCard>
          </>
        ) : (
          <>
            <InfoHintCard>
              Toque num cartão para abrir relatório e chamada. Pressione e segure para alterar ou remover a aula da
              escala.
            </InfoHintCard>
            {renderAulasSection()}
          </>
        )}
      </ScrollView>

      <Modal
        visible={editAula != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeEditSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Pressable style={styles.modalDim} onPress={closeEditSheet} accessibilityLabel="Fechar" />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Alterar aula</Text>
            <Text style={styles.sheetBody}>
              Você pode atualizar as informações da aula por aqui. As chamadas registradas não serão afetadas. Ao
              remover uma aula, todas as chamadas e registros de ofertas correspondentes serão apagados, esta ação não
              poderá ser desfeita
            </Text>

            <View style={styles.splitRow}>
              <Text style={styles.splitLbl}>Data da aula</Text>
              <TextInput
                style={styles.splitInput}
                value={dataAulaBr}
                onChangeText={setDataAulaBr}
                placeholder="dd/mm/aaaa"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                editable={!sheetBusy}
              />
            </View>

            <View style={styles.splitRow}>
              <Text style={styles.splitLbl}>Número da aula</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setNumeroLicao((n) => Math.max(1, n - 1))}
                  disabled={sheetBusy}
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <FontAwesome name="chevron-down" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.stepVal}>{numeroLicao}</Text>
                <Pressable
                  onPress={() => setNumeroLicao((n) => Math.min(52, n + 1))}
                  disabled={sheetBusy}
                  style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={8}
                >
                  <FontAwesome name="chevron-up" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleRemoverAula}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.btnRemover, pressed && { opacity: 0.88 }]}
            >
              <Text style={styles.btnRemoverText}>REMOVER</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleAtualizarAula()}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.btnAtualizar, pressed && { opacity: 0.9 }]}
            >
              {sheetBusy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnAtualizarText}>ATUALIZAR</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createInicioStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLoading: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  heroLoadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  greetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressFrac: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  stepsLead: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepMuted: {
    opacity: 0.55,
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  stepHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  stepHintActive: {
    color: colors.text,
  },
  tipBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.tipBackground,
    borderWidth: 1,
    borderColor: colors.tipBorder,
  },
  tipText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  tipStrong: {
    fontWeight: '800',
  },
  lessonsSection: {
    marginTop: 12,
  },
  lessonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingVertical: 16,
  },
  lessonLoadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  lessonErr: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.danger,
  },
  lessonEmpty: {
    marginHorizontal: 16,
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lessonEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  lessonCardOuter: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  lessonCardPending: {
    borderWidth: 3,
    borderColor: AULA_ORANGE,
  },
  lessonCardDone: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  lessonBanner: {
    backgroundColor: AULA_ORANGE,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonBannerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  lessonBody: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  lessonTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  lessonTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 20,
  },
  lessonAvg: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'right',
    flexShrink: 0,
  },
  statusPendente: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.statusPending,
    marginTop: 4,
  },
  statusFinalizada: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 4,
  },
  lessonDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 6,
    marginBottom: 0,
  },
  lessonStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 32,
  },
  statCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statDividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  stat: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  sheetBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 18,
    textAlign: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  splitLbl: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: 12,
  },
  splitInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    paddingVertical: 0,
    minWidth: 100,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepBtn: {
    padding: 8,
  },
  stepVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  btnRemover: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnRemoverText: {
    color: colors.buttonSecondaryText,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  btnAtualizar: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnAtualizarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  });
}
