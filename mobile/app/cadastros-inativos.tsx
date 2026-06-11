import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { LongPressCard } from '@/components/LongPressCard';
import { useMainSwipe } from '@/context/MainSwipeContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { getActiveDataBackend } from '@/lib/backend-config';
import {
  apiAtivarUsuarioAluno,
  apiDeleteUsuarioCadastro,
  apiListTurmas,
  apiListUsuariosInativos,
  type TurmaListItem,
  type UsuarioInativoListItem,
} from '@/lib/api';

const SHEET_OFF_Y = Math.round(Dimensions.get('window').height * 0.55);

export default function CadastrosInativosScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { authMode, congregacaoId } = useAuth();
  const { requestPortalRefresh } = useMainSwipe();
  const [search, setSearch] = useState('');
  const [lista, setLista] = useState<UsuarioInativoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<UsuarioInativoListItem | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const [turmaIdEdit, setTurmaIdEdit] = useState<number | null>(null);
  const [turmasOpcoes, setTurmasOpcoes] = useState<TurmaListItem[]>([]);
  const [turmaPickerOpen, setTurmaPickerOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const slideY = useRef(new Animated.Value(SHEET_OFF_Y)).current;

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTurmaOpen, setBulkTurmaOpen] = useState(false);
  const [bulkTurmas, setBulkTurmas] = useState<TurmaListItem[]>([]);

  const demo = authMode === 'demo' || getActiveDataBackend() === null;

  const selectedCount = selectedIds.size;

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkTurmaOpen(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setMenuOpen(false);
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const load = useCallback(async () => {
    if (demo) {
      setLista([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const res = await apiListUsuariosInativos({ congregacaoId });
      if (res.ok) {
        setLista(res.usuarios);
      } else {
        setLista([]);
        setError(res.error ?? 'Não foi possível carregar os cadastros inativos.');
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
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
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
      }
    });
  }, [slideY]);

  const openEditSheet = useCallback(
    async (u: UsuarioInativoListItem) => {
      if (demo || u.id <= 0 || congregacaoId == null || congregacaoId <= 0) {
        if (demo) {
          Alert.alert('Cadastros inativos', 'Disponível com sessão e API configurada.');
        }
        return;
      }
      setNomeEdit(u.nome_real);
      setTurmaIdEdit(u.turma_id_hint != null && u.turma_id_hint > 0 ? u.turma_id_hint : null);
      setEditUser(u);
      slideY.setValue(SHEET_OFF_Y);
      setTurmasOpcoes([]);
      try {
        const tr = await apiListTurmas(congregacaoId);
        if (tr.ok) {
          setTurmasOpcoes(tr.turmas);
        }
      } catch {
        /* ignorar */
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
    if (turmaIdEdit == null || turmaIdEdit <= 0) return '';
    const t = turmasOpcoes.find((x) => x.id === turmaIdEdit);
    return t?.nome_turma ?? '—';
  }, [turmaIdEdit, turmasOpcoes]);

  const handleAtivar = async () => {
    if (!editUser || congregacaoId == null || congregacaoId <= 0) return;
    const nome = nomeEdit.trim();
    if (!nome) {
      Alert.alert('Ativar cadastro', 'Indique o nome.');
      return;
    }
    if (turmaIdEdit == null || turmaIdEdit <= 0) {
      Alert.alert('Ativar cadastro', 'Selecione a turma.');
      return;
    }
    setSheetBusy(true);
    try {
      const res = await apiAtivarUsuarioAluno(
        {
          usuario_id: editUser.id,
          turma_id: turmaIdEdit,
          nome_real: nome,
          congregacao_id: congregacaoId,
        },
        congregacaoId,
      );
      if (res.ok) {
        requestPortalRefresh();
        await load();
        closeEditSheet();
        Alert.alert('Cadastro', res.message ?? 'Cadastro reativado.');
      } else {
        Alert.alert('Cadastro', res.error ?? 'Não foi possível ativar.');
      }
    } catch {
      Alert.alert('Cadastro', 'Sem ligação ou resposta inválida.');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleExcluir = () => {
    if (!editUser || congregacaoId == null || congregacaoId <= 0) return;
    Alert.alert(
      'Excluir cadastro',
      'Esta ação remove definitivamente o cadastro, vínculos e registos de frequência associados. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setSheetBusy(true);
            try {
              const res = await apiDeleteUsuarioCadastro(editUser.id, congregacaoId);
              if (res.ok) {
                await load();
                closeEditSheet();
                Alert.alert('Cadastro', res.message ?? 'Cadastro excluído.');
              } else {
                Alert.alert('Cadastro', res.error ?? 'Não foi possível excluir.');
              }
            } catch {
              Alert.alert('Cadastro', 'Sem ligação ou resposta inválida.');
            } finally {
              setSheetBusy(false);
            }
          },
        },
      ],
    );
  };

  const filtrada = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((u) => u.nome_real.toLowerCase().includes(q));
  }, [lista, search]);

  const allVisibleSelected = useMemo(() => {
    if (filtrada.length === 0) return false;
    return filtrada.every((u) => selectedIds.has(u.id));
  }, [filtrada, selectedIds]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleMarcarTudo = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtrada.map((u) => u.id)));
  }, [allVisibleSelected, filtrada]);

  const selectedUsuarios = useMemo(
    () => lista.filter((u) => selectedIds.has(u.id)),
    [lista, selectedIds],
  );

  const handleBulkExcluir = () => {
    if (selectedCount === 0 || congregacaoId == null || congregacaoId <= 0) return;
    Alert.alert(
      'Excluir cadastros',
      `Remover definitivamente ${selectedCount} cadastro(s)? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setBulkBusy(true);
            let ok = 0;
            let fail = 0;
            try {
              for (const u of selectedUsuarios) {
                try {
                  const res = await apiDeleteUsuarioCadastro(u.id, congregacaoId);
                  if (res.ok) ok += 1;
                  else fail += 1;
                } catch {
                  fail += 1;
                }
              }
              requestPortalRefresh();
              await load();
              exitSelectionMode();
              if (fail === 0) {
                Alert.alert('Cadastros', `${ok} cadastro(s) excluído(s).`);
              } else {
                Alert.alert(
                  'Cadastros',
                  `${ok} excluído(s), ${fail} não puderam ser excluídos.`,
                );
              }
            } finally {
              setBulkBusy(false);
            }
          },
        },
      ],
    );
  };

  const abrirBulkAtivarTurma = async () => {
    if (selectedCount === 0 || congregacaoId == null || congregacaoId <= 0) return;
    setBulkBusy(true);
    try {
      const tr = await apiListTurmas(congregacaoId);
      if (!tr.ok || tr.turmas.length === 0) {
        Alert.alert('Ativar cadastros', 'Cadastre uma turma antes de reativar.');
        return;
      }
      setBulkTurmas(tr.turmas);
      setBulkTurmaOpen(true);
    } catch {
      Alert.alert('Ativar cadastros', 'Sem ligação ao servidor.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmarBulkAtivar = async (turmaId: number) => {
    if (congregacaoId == null || congregacaoId <= 0 || turmaId <= 0) return;
    setBulkTurmaOpen(false);
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    const semTurma: string[] = [];
    try {
      for (const u of selectedUsuarios) {
        const tid =
          u.turma_id_hint != null && u.turma_id_hint > 0 ? u.turma_id_hint : turmaId;
        if (tid <= 0) {
          semTurma.push(u.nome_real);
          fail += 1;
          continue;
        }
        try {
          const res = await apiAtivarUsuarioAluno(
            {
              usuario_id: u.id,
              turma_id: tid,
              nome_real: u.nome_real.trim(),
              congregacao_id: congregacaoId,
            },
            congregacaoId,
          );
          if (res.ok) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }
      requestPortalRefresh();
      await load();
      exitSelectionMode();
      if (fail === 0) {
        Alert.alert('Cadastros', `${ok} cadastro(s) reativado(s).`);
      } else {
        Alert.alert(
          'Cadastros',
          `${ok} reativado(s), ${fail} não puderam ser reativados.${semTurma.length ? `\n\nSem turma: ${semTurma.slice(0, 5).join(', ')}${semTurma.length > 5 ? '…' : ''}` : ''}`,
        );
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const infoAjuda = () => {
    setMenuOpen(false);
    Alert.alert(
      'Cadastros inativos',
      'Aparecem aqui pessoas inativadas nas chamadas. Pressione e segure um nome para ativar ou excluir um cadastro. Use o menu (⋮) para selecionar vários de uma vez.',
    );
  };

  const onPressVoltar = () => {
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={onPressVoltar}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
          hitSlop={12}
          accessibilityLabel={selectionMode ? 'Cancelar seleção' : 'Voltar'}
        >
          <FontAwesome
            name={selectionMode ? 'times' : 'arrow-left'}
            size={22}
            color={colors.text}
          />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectionMode
            ? selectedCount > 0
              ? `${selectedCount} selecionado(s)`
              : 'Selecionar'
            : 'Cadastros inativos'}
        </Text>
        {selectionMode ? (
          <View style={styles.infoBtn} />
        ) : (
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.infoBtn}
            hitSlop={12}
            accessibilityLabel="Menu"
          >
            <FontAwesome name="ellipsis-v" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>
      <View style={styles.headerRule} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
      >
        <TextInput
          style={styles.search}
          placeholder="pesquise um nome"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />

        {selectionMode && filtrada.length > 0 ? (
          <Pressable
            onPress={toggleMarcarTudo}
            disabled={bulkBusy}
            style={({ pressed }) => [styles.marcarTudoBtn, pressed && { opacity: 0.88 }]}
            accessibilityLabel={allVisibleSelected ? 'Desmarcar tudo' : 'Marcar tudo'}
          >
            <FontAwesome
              name={allVisibleSelected ? 'square-o' : 'check-square-o'}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.marcarTudoText}>
              {allVisibleSelected ? 'Desmarcar tudo' : 'Marcar tudo'}
            </Text>
          </Pressable>
        ) : null}

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
            contentContainerStyle={[
              styles.list,
              {
                flexGrow: 1,
                paddingBottom:
                  insets.bottom + (selectionMode && selectedCount > 0 ? 88 : 24),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {demo ? (
              <Text style={styles.hint}>Inicie sessão com a API para ver e gerir cadastros inativos.</Text>
            ) : null}
            {filtrada.length === 0 ? (
              <Text style={styles.empty}>
                {lista.length === 0
                  ? 'Nenhum cadastro inativo.'
                  : 'Nenhum resultado para esta pesquisa.'}
              </Text>
            ) : (
              filtrada.map((u) => {
                const selected = selectedIds.has(u.id);
                if (selectionMode) {
                  return (
                    <Pressable
                      key={String(u.id)}
                      onPress={() => toggleSelection(u.id)}
                      disabled={bulkBusy}
                      style={({ pressed }) => [
                        styles.rowCard,
                        selected && styles.rowCardSelected,
                        pressed && { opacity: 0.92 },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${u.nome_real}. ${selected ? 'Selecionado' : 'Não selecionado'}`}
                    >
                      <FontAwesome
                        name={selected ? 'check-circle' : 'circle-o'}
                        size={24}
                        color={selected ? colors.primary : colors.textMuted}
                        style={styles.rowCheck}
                      />
                      <View style={styles.rowBody}>
                        <Text style={styles.name}>{u.nome_real}</Text>
                        {u.turma_label_hint ? (
                          <Text style={styles.turmaHint}>{u.turma_label_hint}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                }
                return (
                  <LongPressCard
                    key={String(u.id)}
                    onLongPress={() => void openEditSheet(u)}
                    style={styles.rowCard}
                    accessibilityLabel={`${u.nome_real}. Toque sem soltar para ativar ou excluir.`}
                  >
                    <Text style={styles.name}>{u.nome_real}</Text>
                  </LongPressCard>
                );
              })
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {selectionMode && selectedCount > 0 ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleBulkExcluir}
            disabled={bulkBusy}
            style={({ pressed }) => [styles.bulkBtnSec, pressed && { opacity: 0.88 }]}
          >
            {bulkBusy ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.bulkBtnSecText}>Excluir ({selectedCount})</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void abrirBulkAtivarTurma()}
            disabled={bulkBusy}
            style={({ pressed }) => [styles.bulkBtnPri, pressed && { opacity: 0.9 }]}
          >
            {bulkBusy ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.bulkBtnPriText}>Ativar ({selectedCount})</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuCard, { marginTop: insets.top + 48 }]}>
            <Pressable
              style={styles.menuRow}
              onPress={enterSelectionMode}
              disabled={demo || lista.length === 0}
            >
              <FontAwesome name="check-square-o" size={18} color={colors.primary} />
              <Text style={styles.menuRowText}>Selecionar vários</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={infoAjuda}>
              <FontAwesome name="info-circle" size={18} color={colors.textMuted} />
              <Text style={styles.menuRowText}>Informação</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
            <Text style={styles.sheetTitle}>Ativar cadastro</Text>
            <Text style={styles.sheetBody}>
              Ao ativar um aluno ou professor, o nome voltará para a lista principal e aparecerá nas chamadas a partir da
              data atual
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
              <Text style={[styles.turmaPressText, !turmaNomeSelecionada && styles.turmaPlaceholder]}>
                {turmaNomeSelecionada || 'Toque para escolher a turma'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleExcluir}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.btnExcluir, pressed && { opacity: 0.88 }]}
            >
              <Text style={styles.btnExcluirText}>Excluir</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleAtivar()}
              disabled={sheetBusy}
              style={({ pressed }) => [styles.btnAtivar, pressed && { opacity: 0.9 }]}
            >
              {sheetBusy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnAtivarText}>ATIVAR</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={turmaPickerOpen} transparent animationType="fade">
        <Pressable style={styles.pickerBackdrop} onPress={() => setTurmaPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Turma</Text>
            <FlatList
              data={turmasOpcoes}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    setTurmaIdEdit(item.id);
                    setTurmaPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{item.nome_turma}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>Nenhuma turma cadastrada.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={bulkTurmaOpen} transparent animationType="fade">
        <Pressable style={styles.pickerBackdrop} onPress={() => !bulkBusy && setBulkTurmaOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Turma para reativar</Text>
            <Text style={styles.bulkTurmaHint}>
              Quem já tinha turma volta para a mesma. Os demais usam a turma escolhida abaixo.
            </Text>
            <FlatList
              data={bulkTurmas}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  disabled={bulkBusy}
                  onPress={() => void confirmarBulkAtivar(item.id)}
                >
                  <Text style={styles.pickerRowText}>{item.nome_turma}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>Nenhuma turma cadastrada.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.card,
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
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  infoBtn: {
    padding: 8,
    width: 40,
    alignItems: 'flex-end',
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
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
  marcarTudoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  marcarTudoText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  list: {
    paddingTop: 8,
  },
  hint: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
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
  empty: {
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
    color: colors.textMuted,
    fontSize: 15,
  },
  rowCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E8F4FD',
  },
  rowCheck: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  turmaHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bulkBtnSec: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bulkBtnSecText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  bulkBtnPri: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bulkBtnPriText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  menuCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 220,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  bulkTurmaHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingBottom: 10,
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
    fontWeight: '600',
    color: colors.text,
  },
  turmaPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  btnExcluir: {
    backgroundColor: '#E5E7EB',
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnExcluirText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnAtivar: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnAtivarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    maxHeight: '70%',
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
