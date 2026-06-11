import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  KeyboardAvoidingView,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardHideWhenOpen } from '@/components/KeyboardHideWhenOpen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuth } from '@/context/AuthContext';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import {
  apiGetUsuario,
  apiListTurmas,
  apiStoreUsuario,
  isApiConfigured,
  type TurmaListItem,
} from '@/lib/api';

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

const SHEET_RADIUS = 16;
const SHEET_MAX_SCREEN_RATIO = 0.92;
/** Soma grabber + conteúdo do scroll + faixa do rodapé, até primeira medição. */
const SHEET_FALLBACK_CONTENT_H = 320;
const GRABBER_AREA_H = 36;
const FOOTER_BAND_FALLBACK_H = 132;
/** Só fecha ao soltar se o arrasto cobrir ~esta fração da altura atual do sheet (≈70%). */
const DISMISS_DRAG_FRACTION = 0.7;
/** Evita fecho por um toque curto em sheets baixos (px). */
const MIN_DISMISS_DRAG_PX = 200;
/** Fling rápido para baixo só fecha se já houver arrasto ≥ esta fração da altura. */
const VELOCITY_ASSIST_FRACTION = 0.42;
const SNAP_BACK_SPRING = { damping: 32, stiffness: 280, mass: 0.85 } as const;

/** Slide do sheet: mesma curva na abertura e no fecho. */
const SHEET_SLIDE_EASING = Easing.bezier(0.22, 1, 0.32, 1);
/** Abertura ao focar o modal (cada vez que entras no ecrã): lenta e suave. */
const OPEN_SHEET_MS = 820;
const OPEN_BACKDROP_MS = 980;
/** Curva suave no arranque e na chegada (sem “salto” visível). */
const OPEN_SHEET_EASING = Easing.bezier(0.16, 1, 0.22, 1);
const CLOSE_SHEET_MS = 640;
const CLOSE_BACKDROP_MS = 780;
const BACKDROP_EASING_IN = Easing.out(Easing.cubic);
const BACKDROP_EASING_OUT = Easing.in(Easing.cubic);

export default function CadastroModal() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { congregacaoId, authMode } = useAuth();
  const { requestPortalRefresh } = useMainSwipe();
  const params = useLocalSearchParams<{ usuario_id?: string; extras?: string }>();
  const editUsuarioId = useMemo(() => {
    const n = parseInt(String(params.usuario_id ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.usuario_id]);
  const isEditMode = editUsuarioId != null;
  const abrirExtrasAoCarregar = String(params.extras ?? '') === '1';
  const { keyboardVisible, keyboardHeight } = useKeyboardVisible();
  const scrollRef = useRef<GHScrollView>(null);

  /** Altura do conteúdo interior do ScrollView (só campos). */
  const [scrollInnerHeight, setScrollInnerHeight] = useState(0);
  /** Altura real da faixa fixa (toggles + CADASTRAR). */
  const [footerBandHeight, setFooterBandHeight] = useState(0);

  const maxSheetOuter = useMemo(() => Math.round(winH * SHEET_MAX_SCREEN_RATIO), [winH]);

  const intrinsicStackHeight = useMemo(() => {
    const scrollH = scrollInnerHeight > 0 ? scrollInnerHeight : SHEET_FALLBACK_CONTENT_H - GRABBER_AREA_H - FOOTER_BAND_FALLBACK_H;
    const footerH = footerBandHeight > 0 ? footerBandHeight : FOOTER_BAND_FALLBACK_H;
    return GRABBER_AREA_H + scrollH + footerH;
  }, [scrollInnerHeight, footerBandHeight]);

  const sheetOuterHeight = useMemo(() => {
    const padBottom = insets.bottom;
    const naturalOuter = intrinsicStackHeight + padBottom;
    return naturalOuter > maxSheetOuter ? maxSheetOuter : naturalOuter;
  }, [intrinsicStackHeight, insets.bottom, maxSheetOuter]);

  const needsCompactScroll = useMemo(
    () => intrinsicStackHeight + insets.bottom > maxSheetOuter,
    [intrinsicStackHeight, insets.bottom, maxSheetOuter],
  );

  const onScrollContentSizeChange = useCallback((_w: number, h: number) => {
    setScrollInnerHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);

  const onFooterBandLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setFooterBandHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);

  useEffect(() => {
    setScrollInnerHeight(0);
  }, [winH]);

  const [nome, setNome] = useState('');
  const [turmasOpcoes, setTurmasOpcoes] = useState<TurmaListItem[]>([]);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [sexo, setSexo] = useState<'F' | 'M' | null>(null);
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  /** Quando true, o sheet cobre quase todo o ecrã e mostra os campos extra (2ª imagem). */
  const [dadosExtrasAbertos, setDadosExtrasAbertos] = useState(false);
  const [escolaridade, setEscolaridade] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [comoProfessor, setComoProfessor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [turmaSemOpcoesModal, setTurmaSemOpcoesModal] = useState(false);

  /**
   * `useWindowDimensions().height` pode ser 0 no 1.º frame → o sheet aparecia já “aberto” (abrupto).
   * Usamos sempre `Dimensions` para o estado inicial e ao focar.
   */
  const translateY = useSharedValue(Dimensions.get('window').height);
  const sheetH = useSharedValue(sheetOuterHeight);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const winHeightSV = useSharedValue(winH);

  useEffect(() => {
    winHeightSV.value = winH;
    sheetH.value = sheetOuterHeight;
  }, [winH, sheetOuterHeight, winHeightSV, sheetH]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  /** Cada vez que o modal ganha foco: parte de baixo do ecrã e sobe com timing suave (reabrir incluído). */
  useFocusEffect(
    useCallback(() => {
      setScrollInnerHeight(0);
      setFooterBandHeight(0);
      const h = Math.max(Dimensions.get('window').height, 320);
      translateY.value = h;
      backdropOpacity.value = 0;
      dragY.value = 0;

      const frame = requestAnimationFrame(() => {
        translateY.value = withTiming(0, {
          duration: OPEN_SHEET_MS,
          easing: OPEN_SHEET_EASING,
        });
        backdropOpacity.value = withTiming(1, {
          duration: OPEN_BACKDROP_MS,
          easing: BACKDROP_EASING_IN,
        });
      });

      return () => {
        cancelAnimationFrame(frame);
        cancelAnimation(translateY);
        cancelAnimation(backdropOpacity);
        cancelAnimation(dragY);
      };
    }, [backdropOpacity, dragY, translateY]),
  );

  const resetNovoCadastro = useCallback(() => {
    setNome('');
    setTurmaId(null);
    setSexo(null);
    setDia('');
    setMes('');
    setAno('');
    setTelefone('');
    setEmail('');
    setDadosExtrasAbertos(false);
    setEscolaridade('');
    setEstadoCivil('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setComoProfessor(false);
    setFormError(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isEditMode) {
        return;
      }
      resetNovoCadastro();
    }, [isEditMode, resetNovoCadastro]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isEditMode || editUsuarioId == null) {
        return;
      }
      if (!isApiConfigured() || authMode !== 'api' || congregacaoId == null || congregacaoId <= 0) {
        setFormError('Não foi possível carregar o cadastro para edição.');
        return;
      }
      let cancelled = false;
      setLoadingEdit(true);
      setFormError(null);
      void (async () => {
        try {
          const res = await apiGetUsuario(editUsuarioId, congregacaoId);
          if (cancelled) {
            return;
          }
          if (!res.ok) {
            setFormError(res.error ?? 'Não foi possível carregar o cadastro.');
            return;
          }
          const u = res.usuario;
          setNome(u.nome_real);
          setSexo(u.sexo);
          const parts = isoToParts(u.data_nascimento);
          setDia(parts.dia);
          setMes(parts.mes);
          setAno(parts.ano);
          setTelefone(u.telefone ?? '');
          setEmail(u.email ?? '');
          setEscolaridade(u.escolaridade ?? '');
          setEstadoCivil(u.estado_civil ?? '');
          setLogradouro(u.logradouro ?? '');
          setNumero(u.numero ?? '');
          setBairro(u.bairro ?? '');
          setComoProfessor(u.nivel_acesso === 'professor');
          setTurmaId(u.turma_id != null && u.turma_id > 0 ? u.turma_id : null);
          setDadosExtrasAbertos(abrirExtrasAoCarregar);
        } catch {
          if (!cancelled) {
            setFormError('Sem ligação ao servidor ou resposta inválida.');
          }
        } finally {
          if (!cancelled) {
            setLoadingEdit(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [abrirExtrasAoCarregar, authMode, congregacaoId, editUsuarioId, isEditMode]),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!isApiConfigured() || authMode !== 'api') {
        setTurmasOpcoes([]);
        setTurmaId(null);
        return () => {
          cancelled = true;
        };
      }
      setLoadingTurmas(true);
      void (async () => {
        try {
          const res = await apiListTurmas(congregacaoId ?? undefined);
          if (!cancelled && res.ok) {
            setTurmasOpcoes(res.turmas);
          }
        } finally {
          if (!cancelled) {
            setLoadingTurmas(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [authMode, congregacaoId]),
  );

  useEffect(() => {
    setScrollInnerHeight(0);
    if (dadosExtrasAbertos) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);
    }
  }, [dadosExtrasAbertos]);

  /** Mantém turma válida quando há turmas (aluno e professor). */
  useEffect(() => {
    setTurmaId((prev) => {
      if (turmasOpcoes.length === 0) {
        return null;
      }
      if (prev != null && turmasOpcoes.some((t) => t.id === prev)) {
        return prev;
      }
      return turmasOpcoes[0].id;
    });
  }, [comoProfessor, turmasOpcoes]);

  useEffect(() => {
    dragY.value = 0;
  }, [dadosExtrasAbertos, dragY]);

  const closeModal = useCallback(() => {
    router.back();
  }, []);

  const dismissSheetAnimated = useCallback(() => {
    const target = winHeightSV.value + 140;
    backdropOpacity.value = withTiming(0, {
      duration: CLOSE_BACKDROP_MS,
      easing: BACKDROP_EASING_OUT,
    });
    dragY.value = withTiming(
      target,
      {
        duration: CLOSE_SHEET_MS,
        easing: SHEET_SLIDE_EASING,
      },
      (finished) => {
        if (finished) {
          runOnJS(closeModal)();
        }
      },
    );
  }, [backdropOpacity, closeModal, dragY, winHeightSV]);

  /** Indicador no topo: só fecha com arrasto longo (~70% da altura) ou fling forte já com meio curso. */
  const grabberPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-32, 32])
        .onUpdate((e) => {
          'worklet';
          const ty = e.translationY;
          dragY.value = ty > 0 ? ty : 0;
        })
        .onEnd((e) => {
          'worklet';
          const h = sheetH.value;
          const dy = dragY.value;
          const vy = e.velocityY;
          const threshold = Math.max(h * DISMISS_DRAG_FRACTION, MIN_DISMISS_DRAG_PX);
          const velocityHelps =
            vy > 2200 && dy > h * VELOCITY_ASSIST_FRACTION;
          const shouldClose = dy >= threshold || velocityHelps;
          if (shouldClose) {
            runOnJS(dismissSheetAnimated)();
          } else {
            dragY.value = withSpring(0, SNAP_BACK_SPRING);
          }
        }),
    [dismissSheetAnimated, sheetH],
  );

  /**
   * Corpo do formulário: scroll nativo em paralelo com o pan (só fecha ao arrastar quando o scroll está no topo).
   * Sem `Simultaneous(Native)`, o pan à volta de todo o sheet impedia o scroll no modo «Dados extras».
   */
  const scrollAreaGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Pan()
          .activeOffsetY(22)
          .failOffsetX([-28, 28])
          .onUpdate((e) => {
            'worklet';
            if (scrollY.value > 8) {
              return;
            }
            const ty = e.translationY;
            dragY.value = ty > 0 ? ty : 0;
          })
          .onEnd((e) => {
            'worklet';
            if (scrollY.value > 8) {
              dragY.value = withSpring(0, SNAP_BACK_SPRING);
              return;
            }
            const h = sheetH.value;
            const dy = dragY.value;
            const vy = e.velocityY;
            const threshold = Math.max(h * DISMISS_DRAG_FRACTION, MIN_DISMISS_DRAG_PX);
            const velocityHelps =
              vy > 2200 && dy > h * VELOCITY_ASSIST_FRACTION;
            const shouldClose = dy >= threshold || velocityHelps;
            if (shouldClose) {
              runOnJS(dismissSheetAnimated)();
            } else {
              dragY.value = withSpring(0, SNAP_BACK_SPRING);
            }
          }),
      ),
    [dismissSheetAnimated, sheetH],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  const handleBackdropPress = useCallback(() => {
    dismissSheetAnimated();
  }, [dismissSheetAnimated]);

  async function handleCadastrar() {
    setFormError(null);
    if (!nome.trim()) {
      setFormError('Indique o nome.');
      return;
    }
    if (!sexo) {
      setFormError('Selecione feminino ou masculino.');
      return;
    }

    if (!comoProfessor) {
      if (turmasOpcoes.length === 0) {
        setFormError('Cadastre pelo menos uma turma na aba Turmas antes de adicionar alunos.');
        return;
      }
      if (turmaId == null || turmaId <= 0) {
        setFormError('Selecione a turma do aluno.');
        return;
      }
    } else if (turmasOpcoes.length === 0) {
      setFormError('Cadastre pelo menos uma turma na aba Turmas antes de adicionar professores.');
      return;
    } else if (turmaId == null || turmaId <= 0) {
      setFormError('Selecione a turma do professor.');
      return;
    }

    if (!isApiConfigured()) {
      Alert.alert(
        'API não configurada',
        'Crie o ficheiro .env na pasta mobile com EXPO_PUBLIC_API_URL apontando para o PHP (ex.: http://10.0.2.2:8080). Enquanto isso, o cadastro não é gravado no servidor.',
        [{ text: 'OK', onPress: () => dismissSheetAnimated() }],
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nome_real: nome.trim(),
        sexo,
        data_nascimento: toIsoFromParts(dia, mes, ano) ?? null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        escolaridade: escolaridade.trim() || null,
        estado_civil: estadoCivil.trim() || null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        bairro: bairro.trim() || null,
        cidade: null,
        estado: null,
        responsavel_1_nome: null,
        responsavel_1_tel: null,
        responsavel_2_nome: null,
        responsavel_2_tel: null,
        data_matricula: null,
        cadastrar_como_professor: isEditMode ? undefined : comoProfessor,
        congregacao_id: congregacaoId ?? undefined,
        turma_id: turmaId != null && turmaId > 0 ? turmaId : undefined,
        ...(isEditMode && editUsuarioId != null ? { usuario_id: editUsuarioId } : {}),
      };
      const res = await apiStoreUsuario(payload, congregacaoId ?? null);

      if (res.ok) {
        if (isEditMode) {
          requestPortalRefresh();
        }
        Alert.alert(
          'Sucesso',
          res.message ?? (isEditMode ? 'Cadastro atualizado.' : 'Cadastro criado.'),
          [{ text: 'OK', onPress: () => closeModal() }],
        );
      } else {
        setFormError(res.error ?? 'Erro ao guardar.');
      }
    } catch {
      setFormError('Sem ligação ao servidor ou resposta inválida.');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleDadosExtras() {
    setDadosExtrasAbertos((v) => !v);
  }

  const podeListarTurmas = isApiConfigured() && authMode === 'api';

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Fechar" />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, sheetSlideStyle, { height: sheetOuterHeight, marginBottom: keyboardHeight }]}
        >
          <View style={styles.sheetKav}>
          <View style={[styles.sheetInnerRoot, styles.sheetInnerCadastro, { paddingBottom: insets.bottom }]}>
            <View style={styles.sheetColumnStretch}>
              <GestureDetector gesture={grabberPanGesture}>
                <View style={styles.grabberWrap}>
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>

              <View style={[styles.sheetScrollRegion, !dadosExtrasAbertos && styles.sheetScrollRegionHug]}>
                <GestureDetector gesture={scrollAreaGesture}>
                  <AnimatedScrollView
                    ref={scrollRef}
                    style={dadosExtrasAbertos ? styles.scrollAreaFill : styles.scrollAreaCompact}
                    onScroll={scrollHandler}
                    onContentSizeChange={onScrollContentSizeChange}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={needsCompactScroll}
                    nestedScrollEnabled
                    bounces
                    scrollEnabled
                    contentContainerStyle={[
                      styles.scrollContent,
                      !dadosExtrasAbertos && styles.scrollContentCompact,
                    ]}
                  >
            <Text style={[styles.title, keyboardVisible && styles.titleKb]}>Inserir novo cadastro</Text>
            <KeyboardHideWhenOpen>
              <Text style={styles.sub}>
                Você pode clicar em &quot;Dados extras&quot; para adicionar mais informações sobre o aluno ou professor.
              </Text>
            </KeyboardHideWhenOpen>

            <TextInput
              placeholderTextColor={colors.textMuted}
              style={styles.pill}
              value={nome}
              onChangeText={setNome}
              placeholder="nome"
              autoCapitalize="words"
            />

            <Text style={styles.sectionLabel}>Turma</Text>
            {loadingTurmas ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : turmasOpcoes.length === 0 ? (
              <Pressable
                onPress={() => setTurmaSemOpcoesModal(true)}
                style={({ pressed }) => [styles.turmaPickerPill, pressed && { opacity: 0.88 }]}
                accessibilityRole="button"
                accessibilityLabel="Selecionar turma"
              >
                <Text style={styles.turmaPickerPillText}>Toque para selecionar turma</Text>
              </Pressable>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.turmaChipsRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {turmasOpcoes.map((t) => {
                    const sel = turmaId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setTurmaId(t.id)}
                        style={[styles.turmaChip, sel && styles.turmaChipActive]}
                      >
                        <Text style={[styles.turmaChipText, sel && styles.turmaChipTextActive]} numberOfLines={1}>
                          {t.nome_turma}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <View
              style={[styles.sexoSegment, !dadosExtrasAbertos && styles.sexoMarginBeforeFooter]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Sexo"
            >
              <Pressable
                onPress={() => setSexo('F')}
                style={[styles.sexoHalf, sexo === 'F' && styles.sexoHalfActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: sexo === 'F' }}
                accessibilityLabel="Feminino"
              >
                <Text style={[styles.sexoText, sexo === 'F' && styles.sexoTextSelected]}>feminino</Text>
              </Pressable>
              <View style={styles.sexoDividerWrap} importantForAccessibility="no">
                <View style={styles.sexoDividerLine} />
              </View>
              <Pressable
                onPress={() => setSexo('M')}
                style={[styles.sexoHalf, sexo === 'M' && styles.sexoHalfActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: sexo === 'M' }}
                accessibilityLabel="Masculino"
              >
                <Text style={[styles.sexoText, sexo === 'M' && styles.sexoTextSelected]}>masculino</Text>
              </Pressable>
            </View>

            {dadosExtrasAbertos ? (
              <>
                <Text style={styles.sectionLabel}>Data de nascimento</Text>
                <View style={styles.triRow}>
                  <TextInput
                    placeholderTextColor={colors.textMuted}
                    style={[styles.pill, styles.tri]}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="dia"
                    value={dia}
                    onChangeText={setDia}
                  />
                  <TextInput
                    placeholderTextColor={colors.textMuted}
                    style={[styles.pill, styles.tri]}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="mês"
                    value={mes}
                    onChangeText={setMes}
                  />
                  <TextInput
                    placeholderTextColor={colors.textMuted}
                    style={[styles.pill, styles.triWide]}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="ano"
                    value={ano}
                    onChangeText={setAno}
                  />
                </View>

                <Text style={styles.sectionLabel}>Informações de contato</Text>
                <TextInput
                  placeholderTextColor={colors.textMuted}
                  style={styles.pill}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="telefone"
                  keyboardType="phone-pad"
                />
                <TextInput
                  placeholderTextColor={colors.textMuted}
                  style={styles.pill}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.sectionLabel}>Dados extras</Text>
                <View style={styles.twoCol}>
                  <View style={[styles.grow6]}>
                    <TextInput
                      placeholderTextColor={colors.textMuted}
                      style={styles.pill}
                      value={escolaridade}
                      onChangeText={setEscolaridade}
                      placeholder="escolaridade"
                    />
                  </View>
                  <View style={[styles.grow4]}>
                    <TextInput
                      placeholderTextColor={colors.textMuted}
                      style={styles.pill}
                      value={estadoCivil}
                      onChangeText={setEstadoCivil}
                      placeholder="estado civil"
                    />
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Endereço</Text>
                <View style={styles.addrTop}>
                  <View style={styles.addrStreet}>
                    <TextInput
                      placeholderTextColor={colors.textMuted}
                      style={styles.pill}
                      value={logradouro}
                      onChangeText={setLogradouro}
                      placeholder="logradouro"
                    />
                  </View>
                  <View style={styles.addrNum}>
                    <TextInput
                      placeholderTextColor={colors.textMuted}
                      style={styles.pill}
                      value={numero}
                      onChangeText={setNumero}
                      placeholder="núme..."
                    />
                  </View>
                </View>
                <TextInput
                  placeholderTextColor={colors.textMuted}
                  style={styles.pill}
                  value={bairro}
                  onChangeText={setBairro}
                  placeholder="bairro"
                />
              </>
            ) : null}

                  </AnimatedScrollView>
                </GestureDetector>
              </View>

              <View
                style={[
                  styles.formFooter,
                  dadosExtrasAbertos && styles.formFooterExpanded,
                  styles.formFooterSticky,
                  !dadosExtrasAbertos && styles.formFooterTightTop,
                ]}
                onLayout={onFooterBandLayout}
              >
              <View style={[styles.toggleRow, isEditMode && styles.toggleRowSingle]}>
                {!isEditMode ? (
                  <Pressable
                    onPress={() => setComoProfessor((v) => !v)}
                    style={[styles.toggleBtn, styles.toggleMuted, comoProfessor && styles.toggleProfessorOn]}
                  >
                    <Text
                      style={[styles.toggleTextMuted, comoProfessor && styles.toggleTextProfessorOn]}
                      numberOfLines={2}
                    >
                      Cadastrar como professor
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={toggleDadosExtras}
                  style={[
                    styles.toggleBtn,
                    styles.toggleMuted,
                    dadosExtrasAbertos && styles.toggleExtrasOn,
                    isEditMode && styles.toggleBtnFull,
                  ]}
                >
                  <Text style={[styles.toggleTextMuted, dadosExtrasAbertos && styles.toggleTextExtrasOn]}>
                    Dados extras
                  </Text>
                </Pressable>
              </View>

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <Pressable
                onPress={handleCadastrar}
                disabled={submitting || loadingEdit}
                style={({ pressed }) => [
                  styles.submit,
                  (pressed || submitting || loadingEdit) && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                {submitting || loadingEdit ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>{isEditMode ? 'GUARDAR' : 'CADASTRAR'}</Text>
                )}
              </Pressable>
              </View>
              {!dadosExtrasAbertos ? <View style={styles.sheetFlexTail} /> : null}
            </View>
          </View>
          </View>
        </Animated.View>
      </View>

      <Modal
        visible={turmaSemOpcoesModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setTurmaSemOpcoesModal(false)}
      >
        <View style={styles.turmaAvisoModalRoot}>
          <Pressable style={styles.turmaAvisoModalFill} onPress={() => setTurmaSemOpcoesModal(false)} accessibilityLabel="Fechar" />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.turmaAvisoModalKb}
          >
            <View style={[styles.turmaAvisoModalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.turmaAvisoGrabber} />
              <Text style={styles.turmaAvisoTitle}>Selecione uma turma</Text>
              {podeListarTurmas ? (
                <>
                  <Text style={styles.turmaAvisoBody}>Você ainda não cadastrou as turmas.</Text>
                  <Text style={styles.turmaAvisoBody}>
                    Volte na tela inicial e clique na aba &apos;Turmas&apos; para cadastrar a primeira turma
                  </Text>
                </>
              ) : (
                <Text style={styles.turmaAvisoBody}>
                  Para cadastrar alunos é necessário ter turmas e sessão com API. Configure o acesso e cadastre turmas na
                  aba Turmas.
                </Text>
              )}
              <Pressable
                onPress={() => setTurmaSemOpcoesModal(false)}
                style={({ pressed }) => [styles.turmaAvisoOk, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
              >
                <Text style={styles.turmaAvisoOkText}>OK</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

function isoToParts(iso: string | null): { dia: string; mes: string; ano: string } {
  if (!iso) {
    return { dia: '', mes: '', ano: '' };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    return { dia: '', mes: '', ano: '' };
  }
  return {
    dia: String(parseInt(m[3], 10)),
    mes: String(parseInt(m[2], 10)),
    ano: m[1],
  };
}

function toIsoFromParts(d: string, m: string, y: string): string | undefined {
  const dd = parseInt(d, 10);
  const mm = parseInt(m, 10);
  const yy = parseInt(y, 10);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) {
    return undefined;
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2100) {
    return undefined;
  }
  const iso = `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheetInnerRoot: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
  },
  /** Preenche a folha; o scroll fica no meio e o rodapé permanece visível em baixo. */
  sheetInnerCadastro: {
    flex: 1,
    minHeight: 0,
  },
  sheetColumnStretch: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  sheetScrollRegion: {
    flex: 1,
    minHeight: 0,
  },
  sheetScrollRegionHug: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  scrollAreaFill: {
    flex: 1,
  },
  scrollAreaCompact: {
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetKav: {
    flex: 1,
    minHeight: 0,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 30,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  scrollContentCompact: {
    paddingBottom: 0,
  },
  formFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.background,
  },
  formFooterTightTop: {
    paddingTop: 0,
  },
  sheetFlexTail: {
    flex: 1,
    minHeight: 0,
  },
  formFooterSticky: {
    flexShrink: 0,
  },
  formFooterExpanded: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
  },
  titleKb: {
    marginBottom: 10,
    fontSize: 16,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 10,
  },
  sectionLabel: {
    marginTop: 3,
    marginBottom: 5,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  turmaPickerPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.background,
    marginBottom: 8,
  },
  turmaPickerPillText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  turmaAvisoModalRoot: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  turmaAvisoModalFill: {
    flex: 1,
  },
  turmaAvisoModalKb: {
    width: '100%',
  },
  turmaAvisoModalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  turmaAvisoGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  turmaAvisoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  turmaAvisoBody: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  turmaAvisoOk: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  turmaAvisoOkText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  turmaChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    flexWrap: 'nowrap',
  },
  turmaChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 220,
    backgroundColor: colors.background,
  },
  turmaChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#E8F4FC',
  },
  turmaChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  turmaChipTextActive: {
    color: colors.primary,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 8,
  },
  sexoSegment: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.background,
    marginBottom: 0,
    overflow: 'hidden',
    minHeight: 42,
  },
  /** Igual ao espaço nome → rótulo Turma (`pill.marginBottom` + `sectionLabel.marginTop`). */
  sexoMarginBeforeFooter: {
    marginBottom: 11,
  },
  sexoHalf: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  /** Seleção discreta (mock): cinza muito claro, sem faixa azul. */
  sexoHalfActive: {
    backgroundColor: colors.card,
  },
  /** Divisor curto ao centro; não liga à borda superior/inferior do pill. */
  sexoDividerWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sexoDividerLine: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.border,
    opacity: 0.55,
    borderRadius: StyleSheet.hairlineWidth,
  },
  sexoText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '400',
  },
  /** Opção escolhida: texto um pouco mais escuro; visual próximo do placeholder vs preenchido. */
  sexoTextSelected: {
    color: colors.text,
    fontWeight: '500',
  },
  triRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  tri: {
    flex: 1,
    marginBottom: 0,
  },
  triWide: {
    flex: 1.4,
    marginBottom: 0,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  grow6: {
    flex: 1.5,
  },
  grow4: {
    flex: 1,
  },
  addrTop: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  addrStreet: {
    flex: 2.2,
  },
  addrNum: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 0,
    marginBottom: 0,
  },
  toggleRowSingle: {
    gap: 0,
  },
  toggleBtnFull: {
    flex: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  toggleMuted: {
    backgroundColor: colors.card,
    borderWidth: 0,
  },
  toggleProfessorOn: {
    backgroundColor: '#E8EDF5',
  },
  toggleExtrasOn: {
    backgroundColor: '#E5E7EB',
  },
  toggleTextMuted: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  toggleTextProfessorOn: {
    color: colors.primary,
  },
  toggleTextExtrasOn: {
    color: colors.text,
    fontWeight: '800',
  },
  formError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 3,
    marginTop: 2,
  },
  submit: {
    marginTop: 3,
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  submitText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
}
