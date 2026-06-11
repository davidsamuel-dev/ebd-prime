import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import {
  apiDeleteConta,
  apiGetContaProfile,
  apiLogout,
} from '@/lib/api';
import { clearAuthToken } from '@/lib/auth-storage';
import { clearRelatorioGeralGate } from '@/lib/geral-report-gate';

type Profile = { nome_real: string; login_usuario: string };

export default function DadosContaScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { userName, loginUsuario: loginCtx, congregacaoId, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSenha, setDeleteSenha] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetContaProfile();
      if (res.ok) {
        setProfile({
          nome_real: res.profile.nome_real,
          login_usuario: res.profile.login_usuario,
        });
      } else {
        setProfile({
          nome_real: userName,
          login_usuario: loginCtx ?? '—',
        });
      }
    } catch {
      setProfile({
        nome_real: userName,
        login_usuario: loginCtx ?? '—',
      });
    } finally {
      setLoading(false);
    }
  }, [userName, loginCtx]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const nome = profile?.nome_real ?? userName;
  const login = profile?.login_usuario ?? loginCtx ?? '—';

  const handleDelete = async () => {
    if (deleteSenha.trim() === '') {
      Alert.alert('Excluir conta', 'Digite a sua senha para confirmar.');
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await apiDeleteConta(deleteSenha);
      if (res.ok) {
        setDeleteOpen(false);
        setDeleteSenha('');
        await clearAuthToken();
        await clearRelatorioGeralGate(congregacaoId);
        await apiLogout();
        await logout();
        Alert.alert('Conta', res.message ?? 'Conta excluída.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Excluir conta', res.error ?? 'Não foi possível excluir.');
      }
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <FontAwesome name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Dados da conta</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.headerRule} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nome pessoal</Text>
            <Text style={styles.sectionHint}>
              Seu nome pode ser visto pelos administradores da escola
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/conta-alterar', params: { tipo: 'nome' } })}
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.rowValue} numberOfLines={1}>
                {nome}
              </Text>
              <FontAwesome name="chevron-right" size={14} color={colors.tabInactive} />
            </Pressable>
          </View>

          <View style={styles.sectionGap} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usuário de acesso</Text>
            <Text style={styles.sectionHint}>
              O usuário de acesso é o seu login para entrar no aplicativo. Você deve guardá-lo caso precise acessar sua
              conta através de outro dispositivo ou fazer login novamente
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/conta-alterar', params: { tipo: 'login' } })}
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.rowValue} numberOfLines={1}>
                {login}
              </Text>
              <FontAwesome name="chevron-right" size={14} color={colors.tabInactive} />
            </Pressable>
          </View>

          <View style={styles.sectionGap} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Senha de acesso</Text>
            <Text style={styles.sectionHint}>
              Sua senha de acesso ao aplicativo. Nós nunca a pediremos via WhatsApp ou qualquer outro meio. Não
              compartilhe com ninguém
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/conta-alterar', params: { tipo: 'senha' } })}
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.rowValue}>••••••••</Text>
              <FontAwesome name="chevron-right" size={14} color={colors.tabInactive} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              Alert.alert(
                'Excluir conta',
                'A sua conta será desativada e a sessão terminada. Esta ação não pode ser desfeita.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Continuar', style: 'destructive', onPress: () => setDeleteOpen(true) },
                ],
              );
            }}
            style={({ pressed }) => [styles.deleteRow, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <FontAwesome name="trash" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Excluir conta</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalFill} onPress={() => !deleteBusy && setDeleteOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Confirmar exclusão</Text>
            <Text style={styles.modalBody}>Digite a sua senha para excluir a conta definitivamente.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Senha"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={deleteSenha}
              onChangeText={setDeleteSenha}
              editable={!deleteBusy}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => !deleteBusy && setDeleteOpen(false)}
                style={styles.modalBtnGhost}
                disabled={deleteBusy}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleDelete()}
                style={[styles.modalBtnDanger, deleteBusy && { opacity: 0.7 }]}
                disabled={deleteBusy}
              >
                {deleteBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Excluir</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  backBtn: { padding: 8, width: 40 },
  headerSpacer: { width: 40 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, backgroundColor: colors.card },
  scrollContent: { paddingBottom: 40 },
  section: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionGap: { height: 10, backgroundColor: colors.card },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  rowCardPressed: { backgroundColor: colors.card },
  rowValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 12,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginHorizontal: 20,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalFill: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  modalBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 18,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnGhost: { paddingVertical: 10, paddingHorizontal: 14 },
  modalBtnGhostText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  modalBtnDanger: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnDangerText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
}
