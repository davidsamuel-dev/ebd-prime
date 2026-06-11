import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { apiUpdateContaLogin, apiUpdateContaNome, apiUpdateContaPassword } from '@/lib/api';

function OutlinedField({
  label,
  containerStyle,
  inputStyle,
  rightSlot,
  ...inputProps
}: TextInputProps & { label: string; containerStyle?: object; inputStyle?: object; rightSlot?: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  return (
    <View style={[styles.outlineWrap, containerStyle]}>
      <Text style={styles.outlineLabel}>{label}</Text>
      <View style={styles.outlineInner}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.outlineInput, inputStyle]}
          {...inputProps}
        />
        {rightSlot ? <View style={styles.outlineRight}>{rightSlot}</View> : null}
      </View>
    </View>
  );
}

type Tipo = 'nome' | 'login' | 'senha';

export default function ContaAlterarScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboardVisible();
  const { patchConta, userName, loginUsuario } = useAuth();
  const params = useLocalSearchParams<{ tipo?: string }>();
  const tipo = useMemo((): Tipo => {
    const t = String(params.tipo ?? 'nome').toLowerCase();
    if (t === 'login' || t === 'senha') {
      return t;
    }
    return 'nome';
  }, [params.tipo]);

  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tipo === 'nome') {
      setNome(userName);
    }
    if (tipo === 'login') {
      setLogin(loginUsuario ?? '');
    }
  }, [tipo, userName, loginUsuario]);

  const canSubmitSenha = senhaAtual.length > 0 && senhaNova.length >= 6;
  const canSubmitNome = nome.trim().length >= 2;
  const canSubmitLogin = /^[a-z0-9._-]+$/.test(login.trim()) && login.trim().length >= 3;

  const handleAtualizar = async () => {
    if (tipo === 'nome') {
      if (!canSubmitNome) {
        Alert.alert('Nome', 'Indique um nome com pelo menos 2 caracteres.');
        return;
      }
      setBusy(true);
      try {
        const res = await apiUpdateContaNome(nome.trim());
        if (res.ok) {
          patchConta({ userName: res.nome_real ?? nome.trim() });
          Alert.alert('Dados da conta', res.message ?? 'Nome atualizado.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        } else {
          Alert.alert('Dados da conta', res.error ?? 'Não foi possível atualizar.');
        }
      } catch {
        Alert.alert('Rede', 'Sem ligação ao servidor.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (tipo === 'login') {
      if (!canSubmitLogin) {
        Alert.alert(
          'Utilizador',
          'Use pelo menos 3 caracteres: letras minúsculas, números, ponto, traço ou sublinhado.',
        );
        return;
      }
      setBusy(true);
      try {
        const res = await apiUpdateContaLogin(login.trim().toLowerCase());
        if (res.ok) {
          patchConta({ loginUsuario: res.login_usuario ?? login.trim().toLowerCase() });
          Alert.alert('Dados da conta', res.message ?? 'Utilizador atualizado.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        } else {
          Alert.alert('Dados da conta', res.error ?? 'Não foi possível atualizar.');
        }
      } catch {
        Alert.alert('Rede', 'Sem ligação ao servidor.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!canSubmitSenha) {
      Alert.alert('Senha', 'Preencha a senha atual e a nova senha (mínimo 6 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const res = await apiUpdateContaPassword(senhaAtual, senhaNova);
      if (res.ok) {
        Alert.alert('Dados da conta', res.message ?? 'Senha atualizada.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Dados da conta', res.error ?? 'Não foi possível atualizar.');
      }
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setBusy(false);
    }
  };

  const sectionTitle =
    tipo === 'nome' ? 'Nome pessoal' : tipo === 'login' ? 'Usuário de acesso' : 'Senha de acesso';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
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
          <Text style={styles.headerTitle}>Alterar dados</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.headerRule} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 20) + 24 + keyboardHeight },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>

          {tipo === 'senha' ? (
            <>
              <Text style={styles.sectionHelp}>
                Insira sua senha atual no primeiro campo e logo abaixo a nova senha que deseja definir
              </Text>
              <OutlinedField
                label="senha atual"
                value={senhaAtual}
                onChangeText={setSenhaAtual}
                secureTextEntry={!showAtual}
                autoCapitalize="none"
                rightSlot={
                  <Pressable onPress={() => setShowAtual((v) => !v)} hitSlop={8} accessibilityLabel="Mostrar senha">
                    <FontAwesome name={showAtual ? 'eye-slash' : 'eye'} size={20} color={colors.textMuted} />
                  </Pressable>
                }
              />
              <OutlinedField
                label="nova senha"
                value={senhaNova}
                onChangeText={setSenhaNova}
                secureTextEntry={!showNova}
                autoCapitalize="none"
                placeholder="nova senha"
                containerStyle={{ marginTop: 14 }}
                rightSlot={
                  <Pressable onPress={() => setShowNova((v) => !v)} hitSlop={8} accessibilityLabel="Mostrar senha">
                    <FontAwesome name={showNova ? 'eye-slash' : 'eye'} size={20} color={colors.textMuted} />
                  </Pressable>
                }
              />
              <Pressable
                onPress={() => router.push('/esqueci-senha')}
                style={styles.forgotLink}
                accessibilityRole="link"
              >
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </Pressable>
            </>
          ) : tipo === 'login' ? (
            <>
              <Text style={styles.sectionHelp}>
                O novo utilizador deve ter pelo menos 3 caracteres (letras minúsculas, números, ponto, traço ou
                sublinhado).
              </Text>
              <OutlinedField
                label="usuário"
                value={login}
                onChangeText={(t) => setLogin(t.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : (
            <>
              <Text style={styles.sectionHelp}>Este nome pode ser visto pelos administradores da escola.</Text>
              <OutlinedField label="nome" value={nome} onChangeText={setNome} autoCapitalize="words" />
            </>
          )}

          <View style={styles.rule} />

          <Pressable
            onPress={() => void handleAtualizar()}
            disabled={busy || (tipo === 'nome' ? !canSubmitNome : tipo === 'login' ? !canSubmitLogin : !canSubmitSenha)}
            style={({ pressed }) => [
              styles.btn,
              (busy ||
                (tipo === 'nome' && !canSubmitNome) ||
                (tipo === 'login' && !canSubmitLogin) ||
                (tipo === 'senha' && !canSubmitSenha)) &&
                styles.btnDisabled,
              pressed && !busy && { opacity: 0.9 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text
                style={[
                  styles.btnText,
                  (tipo === 'nome' && !canSubmitNome) ||
                    (tipo === 'login' && !canSubmitLogin) ||
                    (tipo === 'senha' && !canSubmitSenha)
                    ? styles.btnTextDisabled
                    : null,
                ]}
              >
                ATUALIZAR
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
  headerRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
  sectionHelp: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  outlineWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  outlineLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  outlineInner: { flexDirection: 'row', alignItems: 'center' },
  outlineInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    color: colors.text,
    minHeight: 40,
  },
  outlineRight: { paddingLeft: 8, paddingBottom: 4 },
  forgotLink: { alignSelf: 'flex-end', marginTop: 12 },
  forgotText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: colors.border },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.6 },
  btnTextDisabled: { color: colors.textMuted },
});
}
