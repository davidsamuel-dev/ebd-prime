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
  ScrollView,
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
import { useMainSwipe } from '@/context/MainSwipeContext';
import { useAuth } from '@/context/AuthContext';
import { apiStoreTurma, isApiConfigured } from '@/lib/api';

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

const SHEET_RADIUS = 16;
const SHEET_MAX_SCREEN_RATIO = 0.92;
const SHEET_FALLBACK_CONTENT_H = 260;
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

const OPEN_PICKER_MS = 380;
const CLOSE_PICKER_MS = 220;

/** Lista fixa (referência visual); o texto enviado ao API é o da opção escolhida. */
const FAIXA_ETARIA_OPCOES = [
  'Berçário',
  'Maternal',
  'Jardim de Infância',
  'Primários',
  'Juniores',
  'Pré Adolescentes',
  'Adolescentes',
  'Juvenis',
  'Jovens',
  'Adultos',
  'Coordenação (sec./superintendentes)',
  'Discipulados',
] as const;

export default function NovaTurmaModal() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const scrollRef = useRef<GHScrollView>(null);
  const { congregacaoId } = useAuth();
  const mainSwipe = useMainSwipe();

  const [nomeTurma, setNomeTurma] = useState('');
  const [faixaEtaria, setFaixaEtaria] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [faixaPickerOpen, setFaixaPickerOpen] = useState(false);
  const [faixaSearch, setFaixaSearch] = useState('');

  const pickerSheetH = useMemo(() => Math.min(Math.round(winH * 0.88), 640), [winH]);
  const pickerTranslateY = useSharedValue(Dimensions.get('window').height);
  const pickerBackdropOpacity = useSharedValue(0);

  const [intrinsicContentHeight, setIntrinsicContentHeight] = useState(0);

  const maxSheetOuter = useMemo(() => Math.round(winH * SHEET_MAX_SCREEN_RATIO), [winH]);

  const sheetOuterHeight = useMemo(() => {
    const padBottom = insets.bottom;
    if (intrinsicContentHeight <= 0) {
      return Math.min(SHEET_FALLBACK_CONTENT_H + padBottom, maxSheetOuter);
    }
    const naturalOuter = intrinsicContentHeight + padBottom;
    return naturalOuter > maxSheetOuter ? maxSheetOuter : naturalOuter;
  }, [intrinsicContentHeight, insets.bottom, maxSheetOuter]);

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

  useEffect(() => {
    winHeightSV.value = winH;
    sheetH.value = sheetOuterHeight;
  }, [winH, sheetOuterHeight, winHeightSV, sheetH]);

  /** Altura do teclado (px): empurra o sheet para cima — KAV falha no Android e em modais ancorados em baixo. */
  const [keyboardBottom, setKeyboardBottom] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardBottom(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardBottom(0);

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!faixaPickerOpen) return;
    const h = Dimensions.get('window').height;
    pickerTranslateY.value = h;
    pickerBackdropOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      pickerTranslateY.value = withTiming(0, {
        duration: OPEN_PICKER_MS,
        easing: Easing.out(Easing.cubic),
      });
      pickerBackdropOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [faixaPickerOpen, pickerBackdropOpacity, pickerTranslateY]);

  const dismissFaixaPicker = useCallback(() => {
    const h = Dimensions.get('window').height;
    pickerBackdropOpacity.value = withTiming(0, {
      duration: 140,
      easing: Easing.in(Easing.cubic),
    });
    pickerTranslateY.value = withTiming(
      h,
      {
        duration: CLOSE_PICKER_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setFaixaPickerOpen)(false);
          runOnJS(setFaixaSearch)('');
        }
      },
    );
  }, [pickerBackdropOpacity, pickerTranslateY]);

  const openFaixaPicker = useCallback(() => {
    if (submitting) return;
    setFaixaPickerOpen(true);
  }, [submitting]);

  const selectFaixaEtaria = useCallback(
    (label: string) => {
      setFaixaEtaria(label);
      dismissFaixaPicker();
    },
    [dismissFaixaPicker],
  );

  const faixaFiltradas = useMemo(() => {
    const q = faixaSearch.trim().toLowerCase();
    if (!q) {
      return [...FAIXA_ETARIA_OPCOES];
    }
    return FAIXA_ETARIA_OPCOES.filter((item) => item.toLowerCase().includes(q));
  }, [faixaSearch]);

  const pickerBackdropStyle = useAnimatedStyle(() => ({
    opacity: pickerBackdropOpacity.value * 0.48,
  }));

  const pickerSheetSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pickerTranslateY.value }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useFocusEffect(
    useCallback(() => {
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
    }, [backdropOpacity, dragY, translateY]),
  );

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

  const handleBackdropPress = useCallback(() => {
    dismissSheetAnimated();
  }, [dismissSheetAnimated]);

  async function handleCadastrar() {
    setFormError(null);
    const nome = nomeTurma.trim();
    const faixa = faixaEtaria.trim();
    if (!nome) {
      setFormError('Indique o nome da turma.');
      return;
    }
    if (!faixa) {
      setFormError('Indique a faixa etária.');
      return;
    }

    if (!isApiConfigured()) {
      Alert.alert(
        'API não configurada',
        'Crie o ficheiro .env na pasta mobile com EXPO_PUBLIC_API_URL apontando para o PHP.',
        [{ text: 'OK', onPress: () => dismissSheetAnimated() }],
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiStoreTurma({
        nome_turma: nome,
        congregacao_id: congregacaoId ?? undefined,
        departamento_nome: faixa,
      });
      if (res.ok) {
        mainSwipe.requestPortalRefresh();
        dismissSheetAnimated();
        setTimeout(() => {
          mainSwipe.requestTurmaCadastroSuccess();
        }, 700);
      } else {
        setFormError(res.error ?? 'Não foi possível criar a turma.');
      }
    } catch {
      setFormError('Sem ligação ao servidor ou resposta inválida.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Fechar" />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { height: sheetOuterHeight, marginBottom: keyboardBottom }, sheetSlideStyle]}
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
                      contentContainerStyle={styles.scrollContent}
                    >
                      <Text style={styles.title}>Inserir nova turma</Text>
                      <Text style={styles.sub}>
                        Insira o nome da turma e selecione a faixa etária. As categorias servem apenas para ordenar as
                        turmas no aplicativo
                      </Text>

                      <TextInput
                        placeholderTextColor={colors.textMuted}
                        style={styles.pill}
                        value={nomeTurma}
                        onChangeText={setNomeTurma}
                        placeholder="nome da turma"
                        autoCapitalize="words"
                        editable={!submitting}
                      />

                      <Pressable
                        onPress={openFaixaPicker}
                        disabled={submitting}
                        style={({ pressed }) => [
                          styles.pill,
                          styles.faixaPill,
                          pressed && !submitting && { opacity: 0.92 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="faixa etária"
                        accessibilityHint="Abre a lista para escolher a faixa etária"
                      >
                        <Text
                          style={[styles.faixaPillText, !faixaEtaria && styles.faixaPillPlaceholder]}
                          numberOfLines={1}
                        >
                          {faixaEtaria || 'faixa etária'}
                        </Text>
                      </Pressable>
                    </AnimatedScrollView>
                  </GestureDetector>
                </View>

                <View style={styles.formFooter}>
                  {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                  <Pressable
                    onPress={handleCadastrar}
                    disabled={submitting}
                    style={({ pressed }) => [styles.submit, (pressed || submitting) && { opacity: 0.85 }]}
                    accessibilityRole="button"
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.submitText}>CADASTRAR</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <Modal
          visible={faixaPickerOpen}
          transparent
          animationType="none"
          onRequestClose={dismissFaixaPicker}
          statusBarTranslucent
        >
          <GestureHandlerRootView style={styles.pickerGestureRoot}>
            <View style={styles.pickerRoot}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={dismissFaixaPicker}
                accessibilityLabel="Fechar seletor de faixa etária"
              >
                <Animated.View style={[styles.pickerBackdrop, pickerBackdropStyle]} />
              </Pressable>
              <Animated.View
                style={[
                  styles.pickerSheet,
                  { height: pickerSheetH, marginBottom: keyboardBottom },
                  pickerSheetSlideStyle,
                ]}
              >
                <View style={styles.pickerKav}>
                  <SafeAreaView edges={['bottom']} style={styles.pickerSheetSafe}>
                    <View style={styles.pickerGrabberWrap}>
                      <View style={styles.grabber} />
                    </View>
                    <Text style={styles.pickerTitle}>Selecione uma faixa etária</Text>
                    <ScrollView
                      style={styles.pickerList}
                      contentContainerStyle={styles.pickerListContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {faixaFiltradas.length === 0 ? (
                        <Text style={styles.pickerEmpty}>Nenhum resultado</Text>
                      ) : (
                        faixaFiltradas.map((item) => (
                          <Pressable
                            key={item}
                            onPress={() => selectFaixaEtaria(item)}
                            style={({ pressed }) => [
                              styles.pickerOption,
                              pressed && { opacity: 0.88 },
                            ]}
                          >
                            <Text style={styles.pickerOptionText}>{item}</Text>
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                    <TextInput
                      placeholderTextColor={colors.textMuted}
                      style={styles.pickerSearch}
                      placeholder="pesquise uma faixa etária"
                      value={faixaSearch}
                      onChangeText={setFaixaSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </SafeAreaView>
                </View>
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 10,
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
  faixaPill: {
    justifyContent: 'center',
  },
  faixaPillText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '400',
  },
  faixaPillPlaceholder: {
    color: colors.textMuted,
  },
  pickerGestureRoot: {
    flex: 1,
  },
  pickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  pickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 24,
  },
  pickerKav: {
    flex: 1,
  },
  pickerSheetSafe: {
    flex: 1,
    minHeight: 0,
  },
  pickerGrabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  pickerList: {
    flex: 1,
    minHeight: 0,
  },
  pickerListContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  pickerOptionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  pickerEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  pickerSearch: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    backgroundColor: colors.card,
    color: colors.text,
  },
  formFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  formError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 0,
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
