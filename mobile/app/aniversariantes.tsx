import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MONTHS_PT_FULL } from '@/constants/monthsPt';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuth } from '@/context/AuthContext';
import {
  apiAniversariantes,
  isApiConfigured,
  type AniversarianteRow,
} from '@/lib/api';

const PAGE_BG = '#E8E6ED';
const INFO_SHEET_OFF = 260;

function formatDiaMes(dia: number, mes: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export default function AniversariantesScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const { congregacaoId } = useAuth();
  const monthsScrollRef = useRef<ScrollView>(null);

  const [lista, setLista] = useState<AniversarianteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const infoSlideY = useRef(new Animated.Value(INFO_SHEET_OFF)).current;

  const mesApi = selectedMonth + 1;

  const openInfo = useCallback(() => {
    setInfoVisible(true);
    infoSlideY.setValue(INFO_SHEET_OFF);
    Animated.spring(infoSlideY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 68,
    }).start();
  }, [infoSlideY]);

  const closeInfo = useCallback(() => {
    Animated.timing(infoSlideY, {
      toValue: INFO_SHEET_OFF,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setInfoVisible(false);
    });
  }, [infoSlideY]);

  const load = useCallback(async () => {
    if (!isApiConfigured()) {
      setLista([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const res = await apiAniversariantes(mesApi, congregacaoId);
      if (res.ok) {
        setLista(res.aniversariantes);
      } else {
        setLista([]);
        setError(res.error ?? 'Erro ao carregar');
      }
    } catch {
      setLista([]);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mesApi, congregacaoId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
          hitSlop={12}
          accessibilityLabel="Voltar"
        >
          <FontAwesome name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Aniversariantes</Text>
        <Pressable
          onPress={openInfo}
          style={styles.infoBtn}
          hitSlop={12}
          accessibilityLabel="Informação sobre aniversariantes"
        >
          <FontAwesome name="info-circle" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.monthsWrap}>
        <ScrollView
          ref={monthsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthsRow}
        >
          {MONTHS_PT_FULL.map((label, index) => {
            const active = index === selectedMonth;
            return (
              <Pressable
                key={label}
                onPress={() => setSelectedMonth(index)}
                style={styles.monthTab}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.monthText, active && styles.monthTextActive]}>{label}</Text>
                {active ? <View style={styles.underline} /> : <View style={styles.underlineSpacer} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!isApiConfigured() ? (
          <Text style={styles.empty}>Configure a API para listar aniversariantes.</Text>
        ) : loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : lista.length === 0 ? (
          <Text style={styles.empty}>Nenhum aniversário cadastrado neste mês</Text>
        ) : (
          lista.map((b) => (
            <View key={`${b.id}-${b.dia}`} style={styles.card}>
              <Text style={styles.cardName} numberOfLines={2}>
                {b.nome_real}
              </Text>
              <View style={styles.cardRight}>
                <Text style={styles.cardDate}>{formatDiaMes(b.dia, mesApi)}</Text>
                <FontAwesome name="birthday-cake" size={20} color={colors.primary} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={closeInfo}>
        <Pressable style={styles.modalRoot} onPress={closeInfo} accessibilityLabel="Fechar informação">
          <Animated.View
            style={[
              styles.infoCard,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                transform: [{ translateY: infoSlideY }],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Text style={styles.infoTitle}>Aniversariantes</Text>
              <Text style={styles.infoBody}>
                Lista de alunos e professores com aniversário no mês selecionado. Os dados vêm da data de
                nascimento cadastrada.
              </Text>
              <View style={styles.infoActions}>
                <Pressable onPress={closeInfo} hitSlop={12} accessibilityRole="button" accessibilityLabel="OK">
                  <Text style={styles.infoOk}>OK</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  backPressed: {
    opacity: 0.6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginRight: 36,
  },
  infoBtn: {
    padding: 8,
    position: 'absolute',
    right: 12,
    top: 6,
  },
  monthsWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  monthsRow: {
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  monthTab: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    alignItems: 'center',
    minWidth: 88,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryMuted,
  },
  monthTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  underline: {
    marginTop: 8,
    height: 4,
    width: '100%',
    minWidth: 48,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  underlineSpacer: {
    marginTop: 8,
    height: 4,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexGrow: 1,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 24,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  error: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginRight: 12,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 18,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  infoBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 20,
  },
  infoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  infoOk: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
  },
});
}
