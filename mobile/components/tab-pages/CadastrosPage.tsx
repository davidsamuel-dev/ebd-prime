import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoHintCard } from '@/components/InfoHintCard';
import { LongPressCard } from '@/components/LongPressCard';
import { useAuth } from '@/context/AuthContext';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiListTurmas,
  apiListUsuarios,
  apiInativarUsuarioCadastro,
  apiStoreUsuario,
  type TurmaListItem,
  type UsuarioListItem,
} from '@/lib/api';

const SHEET_OFF_Y = Math.round(Dimensions.get('window').height * 0.55);

/** Margem lateral pequena; ilustração usa quase toda a largura da área útil. */
const EMPTY_ILLU_SIDE = 14;

function emptyStateIllustrationSize(): { width: number; height: number } {
  const { width: w, height: h } = Dimensions.get('window');
  const usableW = Math.max(0, w - EMPTY_ILLU_SIDE * 2);
  const height = Math.min(h * 0.66, usableW * 1.45);
  return { width: usableW, height };
}

const DEMO_USUARIOS: UsuarioListItem[] = [
  {
    id: -1,
    nome_real: 'David Samuel',
    email: null,
    nivel_acesso: 'sem_login',
    congregacao_id: 1,
    turma_label: 'JGE',
    turma_id: 1,
    sexo: 'M',
  },
];

/** Alunos/professores do EBD; administradores da escola não entram nesta ficha. */
function isUsuarioFichaEbd(u: UsuarioListItem): boolean {
  const n = String(u.nivel_acesso ?? '').toLowerCase();
  return n !== 'admin' && n !== 'super_admin';
}

export function CadastrosPage() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { authMode, congregacaoId } = useAuth();
  const { portalRefreshKey, requestPortalRefresh } = useMainSwipe();
  const [search, setSearch] = useState('');
  const [lista, setLista] = useState<UsuarioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<UsuarioListItem | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const [turmaIdEdit, setTurmaIdEdit] = useState<number | null>(null);
  const [turmasOpcoes, setTurmasOpcoes] = useState<TurmaListItem[]>([]);
  const [turmaPickerOpen, setTurmaPickerOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [inativarModalVisible, setInativarModalVisible] = useState(false);
  const slideY = useRef(new Animated.Value(SHEET_OFF_Y)).current;

  const demo = authMode === 'demo' || getActiveDataBackend() === null;

  const load = useCallback(async () => {
    if (demo) {
      setLista(DEMO_USUARIOS);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      const res = await apiListUsuarios({ congregacaoId });
      if (res.ok) {
        setLista(res.usuarios);
      } else {
        setLista([]);
        setError(res.error ?? 'Não foi possível carregar os cadastros.');
      }
    } catch {
      setLista([]);
      setError('Sem ligação ao servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authMode, congregacaoId, demo]);

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
        setEditUser(null);
        setNomeEdit('');
        setTurmaIdEdit(null);
        setTurmasOpcoes([]);
        setInativarModalVisible(false);
      }
    });
  }, [slideY]);

  const openEditSheet = useCallback(
    async (u: UsuarioListItem) => {
      if (demo || u.id <= 0 || congregacaoId == null || congregacaoId <= 0) {
        if (demo) {
          Alert.alert('Cadastro', 'Disponível com sessão e API configurada (EXPO_PUBLIC_API_URL).');
        }
        return;
      }
      setNomeEdit(u.nome_real);
      setTurmaIdEdit(u.turma_id != null && u.turma_id > 0 ? u.turma_id : null);
      setEditUser(u);
      slideY.setValue(SHEET_OFF_Y);
      setTurmasOpcoes([]);
      try {
        const tr = await apiListTurmas(congregacaoId);
        if (tr.ok) {
          setTurmasOpcoes(tr.turmas);
        }
      } catch {
        /* lista de turmas opcional para o seletor */
      }
      requestAnimationFrame(() => {
        Animated.timing(slideY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    },
    [congregacaoId, demo, slideY],
  );

  const turmaNomeSelecionada = useMemo(() => {
    if (turmaIdEdit == null || turmaIdEdit <= 0) {
      return editUser?.turma_label?.trim() ? editUser.turma_label : 'Toque para escolher a turma';
    }
    const t = turmasOpcoes.find((x) => x.id === turmaIdEdit);
    return t?.nome_turma ?? editUser?.turma_label ?? '—';
  }, [editUser?.turma_label, turmaIdEdit, turmasOpcoes]);

  const isProfessor = editUser?.nivel_acesso === 'professor';

  const handleAlterar = async () => {
    if (!editUser || congregacaoId == null || congregacaoId <= 0) return;
    const nome = nomeEdit.trim();
    if (!nome) {
      Alert.alert('Cadastro', 'Indique o nome.');
      return;
    }
    const sexo = editUser.sexo ?? 'M';
    if (turmaIdEdit == null || turmaIdEdit <= 0) {
      Alert.alert('Cadastro', isProfessor ? 'Selecione a turma do professor.' : 'Selecione a turma.');
      return;
    }
    setSheetBusy(true);
    try {
      const res = await apiStoreUsuario(
        {
          usuario_id: editUser.id,
          nome_real: nome,
          sexo,
          congregacao_id: congregacaoId,
          turma_id:
            turmaIdEdit != null && turmaIdEdit > 0 ? turmaIdEdit : isProfessor ? undefined : null,
        },
        congregacaoId,
      );
      if (res.ok) {
        requestPortalRefresh();
        await load();
        closeEditSheet();
        Alert.alert('Cadastro', res.message ?? 'Cadastro atualizado.');
      } else {
        Alert.alert('Cadastro', res.error ?? 'Não foi possível atualizar.');
      }
    } catch {
      Alert.alert('Cadastro', 'Sem ligação ou resposta inválida.');
    } finally {
      setSheetBusy(false);
    }
  };

  const abrirInativar = () => {
    setInativarModalVisible(true);
  };

  const confirmarInativar = async () => {
    if (!editUser || congregacaoId == null || congregacaoId <= 0) return;
    const uid = Math.floor(Number(editUser.id));
    if (uid <= 0) {
      Alert.alert('Cadastro', 'Este cadastro não pode ser inativado.');
      return;
    }
    setSheetBusy(true);
    try {
      const res = await apiInativarUsuarioCadastro(uid, congregacaoId, {
        nome_real: editUser.nome_real,
        sexo: editUser.sexo ?? 'M',
      });
      if (res.ok) {
        setInativarModalVisible(false);
        requestPortalRefresh();
        await load();
        closeEditSheet();
        Alert.alert('Cadastro', res.message ?? 'Cadastro inativado.');
      } else {
        Alert.alert('Cadastro', res.error ?? 'Não foi possível inativar.');
      }
    } catch {
      Alert.alert('Cadastro', 'Sem ligação ou resposta inválida.');
    } finally {
      setSheetBusy(false);
    }
  };

  const dadosExtras = () => {
    if (!editUser) return;
    const uid = editUser.id;
    closeEditSheet();
    router.push({
      pathname: '/cadastro',
      params: { usuario_id: String(uid), extras: '1' },
    });
  };

  const listaFicha = useMemo(() => lista.filter(isUsuarioFichaEbd), [lista]);

  useEffect(() => {
    if (listaFicha.length === 0) {
      setSearch('');
    }
  }, [listaFicha.length]);

  const filtrada = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listaFicha;
    return listaFicha.filter(
      (u) =>
        u.nome_real.toLowerCase().includes(q) ||
        (u.turma_label != null && u.turma_label.toLowerCase().includes(q)),
    );
  }, [listaFicha, search]);

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        {listaFicha.length > 0 ? (
          <TextInput
            style={styles.search}
            placeholder="pesquise um nome ou turma"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
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
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            contentContainerStyle={[styles.list, { flexGrow: 1 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {listaFicha.length > 0 ? (
              <InfoHintCard>
                Toque num cadastro para ver o histórico. Pressione e segure para alterar ou inativar.
              </InfoHintCard>
            ) : null}

            {filtrada.length === 0 ? (
              listaFicha.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Image
                    source={require('@/assets/images/adicinar_cadastro.png')}
                    style={[styles.emptyHero, emptyStateIllustrationSize()]}
                    resizeMode="contain"
                    accessibilityLabel="Nenhum cadastro ainda. Use o botão mais no topo para adicionar."
                  />
                </View>
              ) : (
                <Text style={styles.empty}>Nenhum resultado para esta pesquisa.</Text>
              )
            ) : (
              filtrada.map((u) => (
                <LongPressCard
                  key={String(u.id)}
                  onPress={() =>
                    router.push({
                      pathname: '/historico',
                      params: {
                        ...(u.id > 0 ? { usuario_id: String(u.id) } : {}),
                        nome: u.nome_real,
                        turma: u.turma_label ?? '',
                      },
                    })
                  }
                  onLongPress={() => void openEditSheet(u)}
                  style={styles.rowCard}
                  accessibilityLabel={`${u.nome_real}. Toque sem soltar para alterar ou inativar.`}
                >
                  <Text style={styles.name}>{u.nome_real}</Text>
                  <Text style={styles.tag}>{u.turma_label?.trim() ? u.turma_label : 'Sem turma'}</Text>
                </LongPressCard>
              ))
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={editUser != null}
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
            <Text style={styles.sheetTitle}>Alterar cadastro</Text>
            <Text style={styles.sheetBody}>
              As alterações de turma terão efeito a partir das próximas aulas. Você pode inativar um cadastro para
              removê-lo das chamadas
            </Text>

            <Text style={styles.fieldLbl}>nome</Text>
            <TextInput
              style={styles.input}
              value={nomeEdit}
              onChangeText={setNomeEdit}
              placeholder="nome"
              placeholderTextColor={colors.textMuted}
              editable={!sheetBusy}
            />

            <Text style={styles.fieldLbl}>turma</Text>
            <Pressable
              onPress={() => !sheetBusy && setTurmaPickerOpen(true)}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.input, styles.turmaPress, pressed && { opacity: 0.92 }]}
            >
              <Text
                style={[
                  styles.turmaPressText,
                  (turmaIdEdit == null || turmaIdEdit <= 0) && styles.turmaPlaceholder,
                ]}
              >
                {turmaNomeSelecionada}
              </Text>
            </Pressable>
            {isProfessor ? (
              <Text style={styles.profHint}>
                A turma do professor define em que classe ele aparece na chamada e no relatório da aula.
              </Text>
            ) : null}

            <View style={styles.rowBtns}>
              <Pressable
                onPress={abrirInativar}
                disabled={sheetBusy}
                style={({ pressed }) => [
                  styles.btnSecHalf,
                  (pressed || sheetBusy) && { opacity: 0.88 },
                ]}
              >
                <Text style={styles.btnSecHalfText}>Inativar</Text>
              </Pressable>
              <Pressable
                onPress={dadosExtras}
                disabled={sheetBusy}
                style={({ pressed }) => [styles.btnSecHalf, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.btnSecHalfText}>Dados extras</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => void handleAlterar()}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.btnAlterar, pressed && { opacity: 0.9 }]}
            >
              {sheetBusy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnAlterarText}>ALTERAR</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={inativarModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !sheetBusy && setInativarModalVisible(false)}
      >
        <Pressable
          style={styles.confirmBackdrop}
          onPress={() => !sheetBusy && setInativarModalVisible(false)}
        >
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Deseja inativar este cadastro?</Text>
            <Text style={styles.confirmBody}>
              Ao confirmar, este nome não aparecerá mais nas chamadas. Você poderá reativá-lo ou excluí-lo definitivamente
              acessando a aba &apos;Inativos&apos; nas configurações do aplicativo. Clique em OK para confirmar ou
              Cancelar para voltar.
            </Text>
            <View style={styles.confirmFooter}>
              <Pressable onPress={() => !sheetBusy && setInativarModalVisible(false)} hitSlop={12}>
                <Text style={styles.confirmCancel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmarInativar()}
                disabled={sheetBusy}
                style={({ pressed }) => [styles.confirmOk, pressed && { opacity: 0.88 }]}
              >
                {sheetBusy ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.confirmOkText}>OK</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={turmaPickerOpen} transparent animationType="fade">
        <Pressable style={styles.confirmBackdrop} onPress={() => setTurmaPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Turma</Text>
            <FlatList
              data={turmasOpcoes.map((t) => ({ key: String(t.id), turmaId: t.id, label: t.nome_turma }))}
              keyExtractor={(item) => item.key}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>Nenhuma turma cadastrada.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    setTurmaIdEdit(item.turmaId);
                    setTurmaPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{item.label}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
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
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.text,
  },
  list: {
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
  emptyWrap: {
    flex: 1,
    minHeight: Dimensions.get('window').height * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: EMPTY_ILLU_SIDE,
    paddingVertical: 16,
  },
  emptyHero: {
    alignSelf: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
    color: colors.textMuted,
    fontSize: 15,
  },
  rowCard: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  tag: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
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
    textAlign: 'center',
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
  turmaPress: {
    justifyContent: 'center',
  },
  turmaPressText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  turmaPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  profHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 10,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnSecHalf: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecHalfText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  btnAlterar: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnAlterarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  confirmCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 22,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  confirmBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 20,
  },
  confirmFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
  },
  confirmCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  confirmOk: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  confirmOkText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    maxHeight: '70%',
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingBottom: 12,
    color: colors.text,
  },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pickerRowText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  pickerEmpty: {
    padding: 24,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
}
