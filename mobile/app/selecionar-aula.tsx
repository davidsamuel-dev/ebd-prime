import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuth } from '@/context/AuthContext';
import { getActiveDataBackend } from '@/lib/backend-config';
import { apiListEscala, apiListTurmas, isApiConfigured } from '@/lib/api';

const SHEET_RADIUS = 16;
const SHEET_MAX_RATIO = 0.72;
const DISMISS_DRAG_FRACTION = 0.7;
const MIN_DISMISS_DRAG_PX = 200;
const SNAP_BACK_SPRING = { damping: 32, stiffness: 280, mass: 0.85 } as const;
const SHEET_SLIDE_EASING = Easing.bezier(0.22, 1, 0.32, 1);
const OPEN_SHEET_MS = 820;
const OPEN_BACKDROP_MS = 980;
const CLOSE_SHEET_MS = 640;
const CLOSE_BACKDROP_MS = 780;

const MESES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

type AulaOption = {
  data_aula: string;
  numero_licao: number | null;
  turma_id: number;
};

function buildAulasUnicas(
  turmas: { id: number }[],
  escalaResults: Array<{ turmaId: number; er: Awaited<ReturnType<typeof apiListEscala>> }>,
): AulaOption[] {
  const byDate = new Map<string, AulaOption>();
  for (const { turmaId, er } of escalaResults) {
    if (!er.ok) continue;
    for (const row of er.escala) {
      if (!byDate.has(row.data_aula)) {
        byDate.set(row.data_aula, {
          data_aula: row.data_aula,
          numero_licao:
            row.numero_licao != null && !Number.isNaN(Number(row.numero_licao))
              ? Number(row.numero_licao)
              : null,
          turma_id: turmaId,
        });
      }
    }
  }
  return Array.from(byDate.values()).sort((a, b) => (a.data_aula < b.data_aula ? 1 : -1));
}

export default function SelecionarAulaScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [aulas, setAulas] = useState<AulaOption[]>([]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [contentHeight, setContentHeight] = useState(0);

  const winH = Dimensions.get('window').height;
  const maxSheetH = Math.round(winH * SHEET_MAX_RATIO);
  const sheetH = Math.min(Math.max(contentHeight + insets.bottom, 280), maxSheetH);

  const translateY = useSharedValue(winH);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const winHeightSV = useSharedValue(winH);
  const sheetHeightSV = useSharedValue(sheetH);

  const closeModal = useCallback(() => {
    router.back();
  }, []);

  const dismissSheetAnimated = useCallback(() => {
    const target = winHeightSV.value + 140;
    backdropOpacity.value = withTiming(0, {
      duration: CLOSE_BACKDROP_MS,
      easing: Easing.in(Easing.cubic),
    });
    dragY.value = withTiming(
      target,
      { duration: CLOSE_SHEET_MS, easing: SHEET_SLIDE_EASING },
      (finished) => {
        if (finished) {
          runOnJS(closeModal)();
        }
      },
    );
  }, [backdropOpacity, closeModal, dragY, winHeightSV]);

  const loadAulas = useCallback(async () => {
    if (!isApiConfigured() || !isAuthenticated || congregacaoId == null || congregacaoId <= 0) {
      setAulas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tr = await apiListTurmas(congregacaoId);
      if (!tr.ok || tr.turmas.length === 0) {
        setAulas([]);
        return;
      }
      const escalaResults = await Promise.all(
        tr.turmas.map(async (t) => ({ turmaId: t.id, er: await apiListEscala(t.id) })),
      );
      const lista = buildAulasUnicas(tr.turmas, escalaResults);
      setAulas(lista);
      if (lista.length > 0) {
        const latest = lista[0];
        try {
          const d = parseISO(latest.data_aula);
          setSelectedYear(d.getFullYear());
          setSelectedMonth(d.getMonth() + 1);
        } catch {
          /* keep defaults */
        }
      }
    } catch {
      setAulas([]);
    } finally {
      setLoading(false);
    }
  }, [congregacaoId, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void loadAulas();
      const h = Math.max(Dimensions.get('window').height, 320);
      translateY.value = h;
      backdropOpacity.value = 0;
      dragY.value = 0;

      const frame = requestAnimationFrame(() => {
        translateY.value = withTiming(0, { duration: OPEN_SHEET_MS, easing: SHEET_SLIDE_EASING });
        backdropOpacity.value = withTiming(1, {
          duration: OPEN_BACKDROP_MS,
          easing: Easing.out(Easing.cubic),
        });
      });

      return () => {
        cancelAnimationFrame(frame);
        cancelAnimation(translateY);
        cancelAnimation(backdropOpacity);
        cancelAnimation(dragY);
      };
    }, [backdropOpacity, dragY, loadAulas, translateY]),
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const a of aulas) {
      try {
        set.add(parseISO(a.data_aula).getFullYear());
      } catch {
        /* skip */
      }
    }
    if (set.size === 0) {
      set.add(new Date().getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [aulas]);

  const monthsWithData = useMemo(() => {
    const set = new Set<number>();
    for (const a of aulas) {
      try {
        const d = parseISO(a.data_aula);
        if (d.getFullYear() === selectedYear) {
          set.add(d.getMonth() + 1);
        }
      } catch {
        /* skip */
      }
    }
    return set;
  }, [aulas, selectedYear]);

  const filtered = useMemo(() => {
    return aulas.filter((a) => {
      try {
        const d = parseISO(a.data_aula);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [aulas, selectedMonth, selectedYear]);

  useEffect(() => {
    sheetHeightSV.value = sheetH;
  }, [sheetH, sheetHeightSV]);

  const openAula = useCallback((a: AulaOption) => {
    router.push({
      pathname: '/aula-sessao',
      params: {
        turmaId: String(a.turma_id),
        dataAula: a.data_aula,
        numeroLicao: a.numero_licao != null ? String(a.numero_licao) : '',
      },
    });
    router.back();
  }, []);

  const grabberPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-32, 32])
        .onUpdate((e) => {
          'worklet';
          dragY.value = e.translationY > 0 ? e.translationY : 0;
        })
        .onEnd((e) => {
          'worklet';
          const h = sheetHeightSV.value;
          const dy = dragY.value;
          const threshold = Math.max(h * DISMISS_DRAG_FRACTION, MIN_DISMISS_DRAG_PX);
          if (dy >= threshold || (e.velocityY > 2200 && dy > h * 0.42)) {
            runOnJS(dismissSheetAnimated)();
          } else {
            dragY.value = withSpring(0, SNAP_BACK_SPRING);
          }
        }),
    [dismissSheetAnimated, sheetHeightSV],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContentHeight(e.nativeEvent.layout.height);
  }, []);

  const semBackend = !isApiConfigured() || getActiveDataBackend() === null;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismissSheetAnimated()}
            accessibilityLabel="Fechar"
          />
        </Animated.View>

        <Animated.View style={[styles.sheetOuter, { height: sheetH }, sheetSlideStyle]}>
          <View style={[styles.sheetInner, { paddingBottom: insets.bottom }]} onLayout={onLayout}>
            <GestureDetector gesture={grabberPanGesture}>
              <View style={styles.grabberWrap}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            <Text style={styles.title}>Selecione uma aula</Text>

            {semBackend ? (
              <Text style={styles.hint}>Configure a API para listar as aulas cadastradas.</Text>
            ) : loading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {years.map((y) => {
                    const active = y === selectedYear;
                    return (
                      <Pressable
                        key={y}
                        onPress={() => {
                          setSelectedYear(y);
                          const available = new Set<number>();
                          for (const item of aulas) {
                            try {
                              const d = parseISO(item.data_aula);
                              if (d.getFullYear() === y) {
                                available.add(d.getMonth() + 1);
                              }
                            } catch {
                              /* skip */
                            }
                          }
                          if (available.size > 0 && !available.has(selectedMonth)) {
                            setSelectedMonth(Math.max(...available));
                          }
                        }}
                        style={[styles.yearPill, active && styles.yearPillActive]}
                      >
                        <Text style={[styles.yearPillText, active && styles.yearPillTextActive]}>{y}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {MESES.map((label, idx) => {
                    const month = idx + 1;
                    const active = month === selectedMonth;
                    const hasData = monthsWithData.has(month);
                    return (
                      <Pressable
                        key={label}
                        onPress={() => {
                          if (hasData) {
                            setSelectedMonth(month);
                          }
                        }}
                        style={[
                          styles.monthPill,
                          active && styles.monthPillActive,
                          !hasData && styles.monthPillDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthPillText,
                            active && styles.monthPillTextActive,
                            !hasData && styles.monthPillTextDisabled,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {filtered.length === 0 ? (
                    <Text style={styles.empty}>Nenhuma aula cadastrada neste período.</Text>
                  ) : (
                    filtered.map((a) => {
                      const titulo =
                        a.numero_licao != null ? `Lição ${a.numero_licao}` : 'Aula';
                      let dataFmt = a.data_aula;
                      try {
                        dataFmt = format(parseISO(a.data_aula), 'dd/MM/yyyy', { locale: ptBR });
                      } catch {
                        /* keep */
                      }
                      return (
                        <Pressable
                          key={a.data_aula}
                          onPress={() => openAula(a)}
                          style={({ pressed }) => [styles.aulaRow, pressed && { opacity: 0.88 }]}
                        >
                          <Text style={styles.aulaRowTitle}>{titulo}</Text>
                          <Text style={styles.aulaRowDate}>{dataFmt}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetOuter: {
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flex: 1,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 14,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  yearPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  yearPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  yearPillTextActive: {
    color: colors.white,
  },
  monthPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  monthPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthPillDisabled: {
    opacity: 0.35,
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  monthPillTextActive: {
    color: colors.white,
  },
  monthPillTextDisabled: {
    color: colors.textMuted,
  },
  listScroll: {
    flex: 1,
    marginTop: 4,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  aulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
  },
  aulaRowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  aulaRowDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
}
