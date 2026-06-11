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

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActiveDataBackend } from '@/lib/backend-config';
import { apiListAusentes, type AusenteListItem } from '@/lib/api';

const INFO_SHEET_OFF = 280;

export default function AusentesScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { authMode, congregacaoId } = useAuth();
  const [lista, setLista] = useState<AusenteListItem[]>([]);
  const [temDados, setTemDados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const infoSlideY = useRef(new Animated.Value(INFO_SHEET_OFF)).current;

  const demo = authMode === 'demo' || getActiveDataBackend() === null;

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
      if (finished) {
        setInfoVisible(false);
      }
    });
  }, [infoSlideY]);

  const load = useCallback(async () => {
    if (demo) {
      setLista([]);
      setTemDados(false);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const res = await apiListAusentes(congregacaoId);
      if (res.ok) {
        setLista(res.usuarios);
        setTemDados(res.tem_dados_suficientes);
      } else {
        setLista([]);
        setTemDados(false);
        setError(res.error ?? 'Não foi possível carregar os ausentes.');
      }
    } catch {
      setLista([]);
      setTemDados(false);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [congregacaoId, demo]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const semInformacao = demo || !temDados;
  const nenhumAusente = !semInformacao && lista.length === 0;

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
        <Text style={styles.headerTitle}>Ausentes</Text>
        <Pressable
          onPress={openInfo}
          style={styles.infoBtn}
          hitSlop={12}
          accessibilityLabel="Informação sobre ausentes"
        >
          <FontAwesome name="info-circle" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={[styles.body, { flexGrow: 1, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {semInformacao ? (
            <Text style={styles.emptyMain}>Ainda não temos muitas informações</Text>
          ) : nenhumAusente ? (
            <Text style={styles.emptyMain}>Nenhum aluno ausente nas últimas três aulas.</Text>
          ) : (
            lista.map((u) => (
              <View key={String(u.id)} style={styles.row}>
                <Text style={styles.name}>{u.nome_real}</Text>
                {u.turma_nome ? <Text style={styles.turma}>{u.turma_nome}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

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
              <Text style={styles.infoTitle}>Cadastros ausentes</Text>
              <Text style={styles.infoBody}>
                Aqui você pode visualizar os alunos que não frequentaram nenhuma das três últimas aulas
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
    backgroundColor: '#E8E8E8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  emptyMain: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
    marginTop: '30%',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  retry: {
    padding: 12,
  },
  retryText: {
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  turma: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  infoCard: {
    backgroundColor: colors.card,
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
