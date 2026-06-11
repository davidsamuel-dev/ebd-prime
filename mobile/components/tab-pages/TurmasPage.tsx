import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { InfoHintCard } from '@/components/InfoHintCard';
import { LongPressCard } from '@/components/LongPressCard';
import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActiveDataBackend } from '@/lib/backend-config';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { apiDeleteTurma, apiListTurmas, apiStoreTurma, type TurmaListItem } from '@/lib/api';

const SHEET_OFF_Y = Math.round(Dimensions.get('window').height * 0.55);

const EMPTY_ILLU_SIDE = 14;

function emptyStateIllustrationSize(): { width: number; height: number } {
  const { width: w, height: h } = Dimensions.get('window');
  const usableW = Math.max(0, w - EMPTY_ILLU_SIDE * 2);
  const height = Math.min(h * 0.66, usableW * 1.45);
  return { width: usableW, height };
}

const DEMO_TURMAS: TurmaListItem[] = [
  {
    id: -1,
    nome_turma: 'JGE',
    congregacao_id: 1,
    departamento_id: null,
    departamento_nome: 'Jovens',
    alunos_count: 0,
  },
];

export function TurmasPage() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { authMode, congregacaoId } = useAuth();
  const { portalRefreshKey, requestPortalRefresh } = useMainSwipe();
  const [turmas, setTurmas] = useState<TurmaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editTurma, setEditTurma] = useState<TurmaListItem | null>(null);
  const [nomeTurma, setNomeTurma] = useState('');
  const [faixaTurma, setFaixaTurma] = useState('');
  const [sheetBusy, setSheetBusy] = useState(false);
  const slideY = useRef(new Animated.Value(SHEET_OFF_Y)).current;

  const load = useCallback(async () => {
    const demo = authMode === 'demo' || getActiveDataBackend() === null;
    if (demo) {
      setTurmas(DEMO_TURMAS);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const res = await apiListTurmas(congregacaoId);
      if (res.ok) {
        setTurmas(res.turmas);
      } else {
        setTurmas([]);
        setError(res.error ?? 'Não foi possível carregar as turmas.');
      }
    } catch {
      setTurmas([]);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authMode, congregacaoId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, portalRefreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const closeEditSheet = useCallback(() => {
    Animated.timing(slideY, {
      toValue: SHEET_OFF_Y,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setEditTurma(null);
        setNomeTurma('');
        setFaixaTurma('');
      }
    });
  }, [slideY]);

  const openEditSheet = useCallback(
    (t: TurmaListItem) => {
      if (authMode === 'demo' || getActiveDataBackend() === null || t.id <= 0) {
        return;
      }
      setNomeTurma(t.nome_turma);
      setFaixaTurma(t.departamento_nome ?? '');
      setEditTurma(t);
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

  const handleAtualizar = async () => {
    if (!editTurma || congregacaoId == null || congregacaoId <= 0) return;
    const nome = nomeTurma.trim();
    if (!nome) {
      Alert.alert('Turma', 'Indique o nome da turma.');
      return;
    }
    const faixa = faixaTurma.trim();
    if (!faixa) {
      Alert.alert('Turma', 'Indique a faixa etária.');
      return;
    }
    setSheetBusy(true);
    try {
      const res = await apiStoreTurma({
        turma_id: editTurma.id,
        nome_turma: nome,
        congregacao_id: congregacaoId,
        departamento_nome: faixa,
      });
      if (res.ok) {
        requestPortalRefresh();
        await load();
        closeEditSheet();
        Alert.alert('Turma', res.message ?? 'Turma atualizada.');
      } else {
        Alert.alert('Turma', res.error ?? 'Não foi possível atualizar.');
      }
    } catch {
      Alert.alert('Turma', 'Sem ligação ou resposta inválida.');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleRemover = () => {
    if (!editTurma) return;
    Alert.alert(
      'Remover turma',
      'Tem a certeza? Só é possível se não houver alunos, professores nem aulas na escala desta turma.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setSheetBusy(true);
            try {
              const res = await apiDeleteTurma(editTurma.id);
              if (res.ok) {
                requestPortalRefresh();
                await load();
                closeEditSheet();
                Alert.alert('Turma', res.message ?? 'Turma removida.');
              } else {
                Alert.alert('Turma', res.error ?? 'Não foi possível remover.');
              }
            } catch {
              Alert.alert('Turma', 'Sem ligação ou resposta inválida.');
            } finally {
              setSheetBusy(false);
            }
          },
        },
      ],
    );
  };

  const hasTurmas = turmas.length > 0;
  const demo = authMode === 'demo' || getActiveDataBackend() === null;

  return (
    <View style={styles.safe}>
      {hasTurmas ? (
        <InfoHintCard>Toque numa turma para ver o resumo. Pressione e segure para alterar ou remover.</InfoHintCard>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retry}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : !hasTurmas ? (
        <View style={styles.empty}>
          <Image
            source={require('@/assets/adicionar_turma.png')}
            style={[styles.emptyHero, emptyStateIllustrationSize()]}
            resizeMode="contain"
            accessibilityLabel="Nenhuma turma ainda. Use o botão mais no topo para adicionar."
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
        >
          {turmas.map((t) => (
            <LongPressCard
              key={String(t.id)}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/resumo-turma',
                  params: { turmaId: String(t.id), nomeTurma: t.nome_turma },
                })
              }
              onLongPress={() => openEditSheet(t)}
              accessibilityLabel={`Turma ${t.nome_turma}. Toque para resumo. Toque sem soltar para alterar ou remover.`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>
                  {t.departamento_nome ? `${t.nome_turma} • ${t.departamento_nome}` : t.nome_turma}
                </Text>
                <Text style={styles.presenca}>Presença: —</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <Text style={styles.cell}>Alunos: {t.alunos_count}</Text>
                <View style={styles.vsep} />
                <Text style={styles.cell}>Média: —</Text>
              </View>
            </LongPressCard>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={editTurma != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeEditSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalDim} onPress={closeEditSheet} accessibilityLabel="Fechar" />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Alterar turma</Text>
            <Text style={styles.sheetBody}>
              O nome da turma pode ser alterado a qualquer momento. Para apagar uma turma, primeiro mova ou remova os
              alunos e professores vinculados a ela (e as aulas na escala, se existirem).
            </Text>

            <Text style={styles.fieldLbl}>nome da turma</Text>
            <TextInput
              style={styles.input}
              value={nomeTurma}
              onChangeText={setNomeTurma}
              placeholder="nome da turma"
              placeholderTextColor={colors.textMuted}
              editable={!sheetBusy}
            />

            <Text style={styles.fieldLbl}>faixa etária</Text>
            <TextInput
              style={styles.input}
              value={faixaTurma}
              onChangeText={setFaixaTurma}
              placeholder="faixa etária"
              placeholderTextColor={colors.textMuted}
              editable={!sheetBusy}
            />

            <Pressable
              onPress={handleRemover}
              disabled={sheetBusy || demo}
              style={({ pressed }) => [
                styles.btnRemover,
                (pressed || sheetBusy) && { opacity: 0.88 },
                demo && styles.btnDisabled,
              ]}
            >
              <Text style={styles.btnRemoverText}>REMOVER</Text>
            </Pressable>

            <Pressable
              onPress={handleAtualizar}
              disabled={sheetBusy || demo}
              style={({ pressed }) => [
                styles.btnAtualizar,
                (pressed || sheetBusy) && { opacity: 0.9 },
                demo && styles.btnDisabled,
              ]}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollPad: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  retry: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    flexWrap: 'wrap',
  },
  presenca: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  vsep: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EMPTY_ILLU_SIDE,
    paddingVertical: 16,
  },
  emptyHero: {
    alignSelf: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.background,
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
  },
  sheetBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 18,
  },
  fieldLbl: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.background,
  },
  btnRemover: {
    backgroundColor: '#E5E7EB',
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnRemoverText: {
    color: colors.text,
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
  btnDisabled: {
    opacity: 0.45,
  },
});
}
