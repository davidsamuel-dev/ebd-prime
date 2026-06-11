import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, isValid, parse } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useMainSwipeOptional } from '@/context/MainSwipeContext';
import { useAuth } from '@/context/AuthContext';
import {
  apiListEscala,
  apiListTurmas,
  apiStoreEscala,
  type TurmaListItem,
  isApiConfigured,
} from '@/lib/api';

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

const SHEET_RADIUS = 16;
/** Teto da folha em % da altura da tela (formulários longos não ultrapassam isto). */
const SHEET_MAX_SCREEN_RATIO = 0.92;
/** Até o primeiro onLayout, altura provisória para não renderizar folha “zerada”. */
const SHEET_FALLBACK_CONTENT_H = 240;
const DISMISS_DRAG_FRACTION = 0.7;
const MIN_DISMISS_DRAG_PX = 200;
const VELOCITY_ASSIST_FRACTION = 0.42;
const SNAP_BACK_SPRING = { damping: 32, stiffness: 280, mass: 0.85 } as const;
const SHEET_SLIDE_EASING = Easing.bezier(0.22, 1, 0.32, 1);
const OPEN_SHEET_MS = 820;
const OPEN_BACKDROP_MS = 980;
const OPEN_SHEET_EASING = Easing.bezier(0.16, 1, 0.22, 1);
const CLOSE_SHEET_MS = 640;
const CLOSE_BACKDROP_MS = 780;
const BACKDROP_EASING_IN = Easing.out(Easing.cubic);
const BACKDROP_EASING_OUT = Easing.in(Easing.cubic);

function brToday(): string {
  return format(new Date(), 'dd/MM/yyyy');
}

function parseBrToIso(br: string): string | null {
  const p = parse(br.trim(), 'dd/MM/yyyy', new Date());
  if (!isValid(p)) {
    return null;
  }
  return format(p, 'yyyy-MM-dd');
}

function parseBrToDate(br: string): Date {
  const p = parse(br.trim(), 'dd/MM/yyyy', new Date());
  return isValid(p) ? p : new Date();
}

export default function NovaAulaScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const scrollRef = useRef<GHScrollView>(null);
  const { congregacaoId, isAuthenticated } = useAuth();
  const mainSwipe = useMainSwipeOptional();

  const [turmas, setTurmas] = useState<TurmaListItem[]>([]);
  const [turmaId, setTurmaId] = useState<number | null>(null);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [dataBr, setDataBr] = useState(brToday);
  const [numeroLicao, setNumeroLicao] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [intrinsicContentHeight, setIntrinsicContentHeight] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosDraftDate, setIosDraftDate] = useState(() => new Date());

  const pickerDateValue = useMemo(() => parseBrToDate(dataBr), [dataBr]);

  const maxSheetOuter = useMemo(() => Math.round(winH * SHEET_MAX_SCREEN_RATIO), [winH]);

  const sheetOuterHeight = useMemo(() => {
    const padBottom = insets.bottom;
    if (intrinsicContentHeight <= 0) {
      return Math.min(SHEET_FALLBACK_CONTENT_H + padBottom, maxSheetOuter);
    }
    const naturalOuter = intrinsicContentHeight + padBottom;
    return naturalOuter > maxSheetOuter ? maxSheetOuter : naturalOuter;
  }, [intrinsicContentHeight, insets.bottom, maxSheetOuter]);

  /** Conteúdo mais alto que o teto: folha fica no máximo e o scroll interno rola. */
  const needsCompactScroll = useMemo(
    () =>
      intrinsicContentHeight > 0 && intrinsicContentHeight + insets.bottom > maxSheetOuter,
    [intrinsicContentHeight, insets.bottom, maxSheetOuter],
  );

  const onSheetContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setIntrinsicContentHeight((prev) => {
        if (Math.abs(prev - h) < 1) return prev;
        const padBottom = insets.bottom;
        /* Com overflow, o relayout do flex reporta a altura da viewport, não do conteúdo — manter a última medida “natural”. */
        if (prev > 0 && prev + padBottom > maxSheetOuter) {
          return prev;
        }
        return h;
      });
    },
    [insets.bottom, maxSheetOuter],
  );

  useEffect(() => {
    setIntrinsicContentHeight(0);
  }, [winH]);

  const translateY = useSharedValue(Dimensions.get('window').height);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const winHeightSV = useSharedValue(winH);
  const sheetH = useSharedValue(sheetOuterHeight);

  const [keyboardBottom, setKeyboardBottom] = useState(0);

  useEffect(() => {
    winHeightSV.value = winH;
    sheetH.value = sheetOuterHeight;
  }, [winH, sheetOuterHeight, winHeightSV, sheetH]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) => setKeyboardBottom(e.endCoordinates.height);
    const onHide = () => setKeyboardBottom(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

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

  const sugerirProximoNumeroLicao = useCallback(async (listaTurmas: TurmaListItem[]) => {
    if (listaTurmas.length === 0) {
      return 1;
    }
    let max = 0;
    const resultados = await Promise.all(listaTurmas.map((t) => apiListEscala(t.id)));
    for (const er of resultados) {
      if (!er.ok) continue;
      for (const row of er.escala) {
        const n = row.numero_licao;
        if (n != null && !Number.isNaN(Number(n)) && Number(n) > max) {
          max = Math.floor(Number(n));
        }
      }
    }
    return max + 1;
  }, []);

  const resetFormularioAula = useCallback(() => {
    setDataBr(brToday());
  }, []);

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
          const velocityHelps = vy > 2200 && dy > h * VELOCITY_ASSIST_FRACTION;
          const shouldClose = dy >= threshold || velocityHelps;
          if (shouldClose) {
            runOnJS(dismissSheetAnimated)();
          } else {
            dragY.value = withSpring(0, SNAP_BACK_SPRING);
          }
        }),
    [dismissSheetAnimated, sheetH],
  );

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
            const velocityHelps = vy > 2200 && dy > h * VELOCITY_ASSIST_FRACTION;
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

  const loadTurmas = useCallback(async () => {
    if (!isApiConfigured() || !isAuthenticated || congregacaoId == null || congregacaoId <= 0) {
      setTurmas([]);
      setTurmaId(null);
      return;
    }
    setLoadingTurmas(true);
    try {
      const res = await apiListTurmas(congregacaoId ?? undefined);
      if (res.ok) {
        setTurmas(res.turmas);
        setTurmaId((prev) => {
          if (prev != null && res.turmas.some((t) => t.id === prev)) {
            return prev;
          }
          return res.turmas[0]?.id ?? null;
        });
        const proximo = await sugerirProximoNumeroLicao(res.turmas);
        setNumeroLicao(proximo);
      } else {
        setTurmas([]);
        setTurmaId(null);
      }
    } catch {
      setTurmas([]);
      setTurmaId(null);
    } finally {
      setLoadingTurmas(false);
    }
  }, [congregacaoId, isAuthenticated, sugerirProximoNumeroLicao]);

  useEffect(() => {
    void loadTurmas();
  }, [loadTurmas]);

  useFocusEffect(
    useCallback(() => {
      resetFormularioAula();
      void loadTurmas();
      setIntrinsicContentHeight(0);
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
    }, [backdropOpacity, dragY, loadTurmas, resetFormularioAula, translateY]),
  );

  async function handleCadastrar() {
    if (!isApiConfigured()) {
      Alert.alert(
        'Configuração',
        'Configure EXPO_PUBLIC_API_URL no .env para gravar aulas.',
      );
      return;
    }
    if (!isAuthenticated) {
      Alert.alert('Sessão', 'Inicie sessão para cadastrar aulas.');
      return;
    }
    if (turmas.length === 0) {
      Alert.alert('Turma', 'Não há turma disponível. Crie uma turma primeiro.');
      return;
    }

    const iso = parseBrToIso(dataBr);
    if (iso === null) {
      Alert.alert('Data', 'Use o formato DD/MM/AAAA.');
      return;
    }

    setSubmitting(true);
    try {
      let okCount = 0;
      let lastError = 'Não foi possível cadastrar.';
      for (const t of turmas) {
        const res = await apiStoreEscala({
          turma_id: t.id,
          data_aula: iso,
          numero_licao: numeroLicao,
          tema_licao: null,
          professor_usuario_id: null,
          professor_visitante_nome: null,
        });
        if (res.ok) {
          okCount += 1;
        } else {
          lastError = res.error ?? lastError;
        }
      }
      if (okCount > 0) {
        mainSwipe?.requestPortalRefresh();
        const msg =
          okCount === turmas.length
            ? 'Aula cadastrada para todas as turmas.'
            : `Aula cadastrada em ${okCount} de ${turmas.length} turma(s).`;
        Alert.alert('Sucesso', msg, [{ text: 'OK', onPress: () => closeModal() }]);
      } else {
        Alert.alert('Erro', lastError);
      }
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleBackdropPress = useCallback(() => {
    dismissSheetAnimated();
  }, [dismissSheetAnimated]);

  const openDatePicker = useCallback(() => {
    if (submitting || loadingTurmas) return;
    setIosDraftDate(pickerDateValue);
    setShowDatePicker(true);
  }, [loadingTurmas, pickerDateValue, submitting]);

  const onAndroidDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (date) {
      setDataBr(format(date, 'dd/MM/yyyy'));
    }
  }, []);

  const confirmIosDate = useCallback(() => {
    setDataBr(format(iosDraftDate, 'dd/MM/yyyy'));
    setShowDatePicker(false);
  }, [iosDraftDate]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Fechar" />
        </Animated.View>

        <Animated.View
          style={[styles.sheetOuter, { height: sheetOuterHeight, marginBottom: keyboardBottom }, sheetSlideStyle]}
        >
          <View
            style={[
              styles.sheetInnerRoot,
              { paddingBottom: insets.bottom },
              needsCompactScroll && styles.sheetInnerRootFill,
            ]}
          >
            <View
              style={[styles.sheetMeasuredColumn, needsCompactScroll && styles.sheetMeasuredColumnFill]}
              onLayout={onSheetContentLayout}
            >
              <GestureDetector gesture={grabberPanGesture}>
                <View style={styles.grabberWrap}>
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>

              <View style={[styles.sheetBody, needsCompactScroll && styles.sheetBodyFill]}>
                <View style={[styles.sheetScrollWrap, needsCompactScroll && styles.sheetScrollWrapFill]}>
                  <GestureDetector gesture={scrollAreaGesture}>
                    <AnimatedScrollView
                      ref={scrollRef}
                      style={[styles.scrollFlex, needsCompactScroll && styles.scrollFlexFill]}
                      onScroll={scrollHandler}
                      scrollEventThrottle={16}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={needsCompactScroll}
                      nestedScrollEnabled
                      bounces={false}
                      scrollEnabled={needsCompactScroll}
                      contentContainerStyle={styles.sheetScrollContent}
                    >
                      <Text style={styles.sheetHeroTitle}>Inserir nova aula</Text>
                      <Text style={styles.sheetHeroSub}>
                        Selecione a data e o número da aula. O cadastro será feito para todas as turmas da escola.
                      </Text>

                      <View style={styles.sheetField}>
                        <Text style={styles.sheetFieldLabel}>Data da aula</Text>
                        {Platform.OS === 'web' ? (
                          <TextInput
                            style={styles.sheetFieldInput}
                            value={dataBr}
                            onChangeText={setDataBr}
                            placeholder="DD/MM/AAAA"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numbers-and-punctuation"
                            editable={!submitting && !loadingTurmas}
                          />
                        ) : (
                          <Pressable
                            onPress={openDatePicker}
                            disabled={submitting || loadingTurmas}
                            style={({ pressed }) => [
                              styles.sheetDateTrigger,
                              pressed && styles.sheetDateTriggerPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir calendário para escolher a data da aula"
                          >
                            <Text style={styles.sheetDateValue}>{dataBr}</Text>
                            <FontAwesome name="calendar" size={16} color={colors.primary} />
                          </Pressable>
                        )}
                      </View>

                      <View style={styles.sheetField}>
                        <Text style={styles.sheetFieldLabel}>Número da aula</Text>
                        <View style={styles.stepper}>
                          <Pressable
                            onPress={() => setNumeroLicao((n) => Math.max(1, n - 1))}
                            style={styles.stepperBtn}
                            disabled={submitting || loadingTurmas}
                          >
                            <FontAwesome name="chevron-down" size={16} color={colors.primary} />
                          </Pressable>
                          <Text style={styles.stepperValue}>{numeroLicao}</Text>
                          <Pressable
                            onPress={() => setNumeroLicao((n) => Math.min(52, n + 1))}
                            style={styles.stepperBtn}
                            disabled={submitting || loadingTurmas}
                          >
                            <FontAwesome name="chevron-up" size={16} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>
                    </AnimatedScrollView>
                  </GestureDetector>
                </View>

                <View style={styles.formFooter}>
                  <Pressable
                    onPress={handleCadastrar}
                    disabled={submitting || loadingTurmas}
                    style={({ pressed }) => [styles.submitCta, (pressed || submitting) && { opacity: 0.88 }]}
                    accessibilityRole="button"
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.submitCtaText}>CADASTRAR</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {Platform.OS === 'android' && showDatePicker ? (
          <DateTimePicker
            value={pickerDateValue}
            mode="date"
            display="default"
            design="material"
            title="Selecione a data"
            locale="pt_BR"
            onChange={onAndroidDateChange}
            maximumDate={new Date(2100, 11, 31)}
            minimumDate={new Date(1990, 0, 1)}
          />
        ) : null}

        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <SafeAreaView
              style={[styles.dateIosSafe, { backgroundColor: colors.background, width: winW }]}
              edges={['top', 'bottom', 'left', 'right']}
            >
              <View style={styles.dateIosToolbar}>
                <View style={[styles.dateIosToolbarSlot, styles.dateIosToolbarSlotLeft]}>
                  <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                    <Text style={styles.dateIosToolbarBtn}>Cancelar</Text>
                  </Pressable>
                </View>
                <Text style={styles.dateIosTitle} numberOfLines={1}>
                  Selecione a data
                </Text>
                <View style={[styles.dateIosToolbarSlot, styles.dateIosToolbarSlotRight]}>
                  <Pressable onPress={confirmIosDate} hitSlop={12}>
                    <Text style={styles.dateIosToolbarOk}>OK</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.dateIosPickerWrap, { width: winW }]}>
                <DateTimePicker
                  value={iosDraftDate}
                  mode="date"
                  display="inline"
                  locale="pt_BR"
                  themeVariant="light"
                  accentColor={colors.primary}
                  style={[styles.dateIosPickerNative, { width: winW }]}
                  onChange={(_, d) => {
                    if (d) setIosDraftDate(d);
                  }}
                  maximumDate={new Date(2100, 11, 31)}
                  minimumDate={new Date(1990, 0, 1)}
                />
              </View>
            </SafeAreaView>
          </Modal>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
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
  sheetOuter: {
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
  sheetInnerRoot: {
    flexGrow: 0,
    alignSelf: 'stretch',
    backgroundColor: colors.background,
  },
  sheetInnerRootFill: {
    flex: 1,
    minHeight: 0,
  },
  sheetMeasuredColumn: {
    flexGrow: 0,
    alignSelf: 'stretch',
    backgroundColor: colors.background,
  },
  sheetMeasuredColumnFill: {
    flex: 1,
    minHeight: 0,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 22,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetBody: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  sheetBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  /** Sem flex:1 — evita “buraco” enorme entre o último campo e o botão (ScrollView esticava no espaço restante). */
  sheetScrollWrap: {
    flexGrow: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  sheetScrollWrapFill: {
    flex: 1,
    minHeight: 0,
  },
  scrollFlex: {
    flexGrow: 0,
  },
  scrollFlexFill: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    paddingTop: 0,
  },
  sheetHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 4,
  },
  sheetHeroSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  sheetField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 7,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  sheetFieldLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  sheetFieldInput: {
    minWidth: 120,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    paddingVertical: 0,
    marginVertical: 0,
  },
  sheetDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
    justifyContent: 'flex-end',
  },
  sheetDateTriggerPressed: {
    opacity: 0.75,
  },
  sheetDateValue: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
  },
  /** Sem flex:1 — evita faixa branca vazia por baixo do calendário na folha nativa. */
  dateIosSafe: {
    alignSelf: 'stretch',
  },
  /** Duas faixas laterais iguais + título centrado (padrão tipo navigation bar). */
  dateIosToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateIosToolbarSlot: {
    width: 88,
    justifyContent: 'center',
  },
  dateIosToolbarSlotLeft: {
    alignItems: 'flex-start',
  },
  dateIosToolbarSlotRight: {
    alignItems: 'flex-end',
  },
  dateIosTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 4,
  },
  dateIosToolbarBtn: {
    fontSize: 17,
    color: colors.textMuted,
    fontWeight: '400',
  },
  dateIosToolbarOk: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '700',
  },
  dateIosPickerWrap: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  dateIosPickerNative: {
    alignSelf: 'stretch',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    padding: 4,
  },
  stepperValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  formFooter: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  submitCta: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  submitCtaText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
}
