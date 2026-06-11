import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

import { apiInviteCoAdmin } from '@/lib/api';

const screenW = Dimensions.get('window').width;
const STEPS_FORM = 2;

function StepperBar({ stepIndex }: { stepIndex: number }) {
  const stepper = useThemedStyles(createStepper);
  const pct = Math.min(1, (stepIndex + 1) / STEPS_FORM);
  const barW = screenW - 56;
  return (
    <View style={stepper.track}>
      <View style={[stepper.fill, { width: barW * pct, }]} />
    </View>
  );
}

function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0];
  return p && p.length > 0 ? p : nome.trim();
}

function montarMensagemCredenciais(nomeCompleto: string, login: string, senha: string): string {
  const primeiro = primeiroNome(nomeCompleto);
  return `Olá ${primeiro}, aqui estão seus dados de acesso ao Portal EBD:

Usuário: ${login}
Senha: ${senha}

Guarde esta mensagem para entrar na tela de login do aplicativo quando quiser.`;
}

export default function ConvidarAdministradorScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { congregacaoId } = useAuth();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | null>(null);
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const [criadoNome, setCriadoNome] = useState('');
  const [criadoLogin, setCriadoLogin] = useState('');
  const [criadoSenha, setCriadoSenha] = useState('');

  const nomeBtnWhats = useMemo(() => primeiroNome(criadoNome).toLocaleUpperCase('pt-BR'), [criadoNome]);

  const avancarDados = () => {
    if (nome.trim().length < 2) {
      Alert.alert('Nome', 'Informe o nome do administrador.');
      return;
    }
    if (sexo == null) {
      Alert.alert('Sexo', 'Selecione feminino ou masculino.');
      return;
    }
    setStep(1);
  };

  const enviarConvite = async () => {
    const u = usuario.trim().toLowerCase();
    if (!/^[a-z0-9]{3,40}$/.test(u)) {
      Alert.alert(
        'Usuário',
        'O nome de usuário deve ser único. Use apenas letras minúsculas e números (3 a 40 caracteres).',
      );
      return;
    }
    if (senha.length < 6) {
      Alert.alert('Senha', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (congregacaoId == null || congregacaoId <= 0) {
      Alert.alert('Sessão', 'Sessão inválida. Volte a entrar na conta.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiInviteCoAdmin(
        {
          nome_real: nome.trim(),
          sexo: sexo!,
          login_usuario: u,
          senha,
          congregacao_id: congregacaoId,
        },
        congregacaoId,
      );
      if (!res.ok) {
        Alert.alert('Convite', res.error ?? 'Não foi possível criar o acesso.');
        return;
      }
      setCriadoNome(res.nome_real);
      setCriadoLogin(res.login_usuario);
      setCriadoSenha(senha);
      setStep(2);
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setBusy(false);
    }
  };

  const abrirWhatsOuPartilhar = async () => {
    const msg = montarMensagemCredenciais(criadoNome, criadoLogin, criadoSenha);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* continuar para Share */
    }
    try {
      await Share.share({ message: msg, title: 'Portal EBD — acesso' });
    } catch {
      /* cancelado */
    }
  };

  const fecharFluxo = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View style={styles.topRow}>
          {step < 2 ? (
            <Pressable
              onPress={() => {
                if (step === 0) {
                  router.back();
                } else {
                  setStep(0);
                }
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <FontAwesome name="arrow-left" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          <FontAwesome name="book" size={28} color={colors.primary} />
          {step === 2 ? (
            <Pressable
              onPress={fecharFluxo}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <FontAwesome name="times" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>

        {step < 2 ? <StepperBar stepIndex={step} /> : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        >
          {step === 0 && (
            <>
              <Text style={styles.title}>Dados do administrador</Text>
              <Text style={styles.body}>
                Este é um pré-cadastro para criar o acesso. O usuário poderá alterar os dados depois
              </Text>
              <TextInput
                style={styles.input}
                placeholder="nome"
                placeholderTextColor={colors.textMuted}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
              <View style={styles.sexoRow}>
                <Pressable
                  onPress={() => setSexo('F')}
                  style={({ pressed }) => [
                    styles.sexoHalf,
                    sexo === 'F' && styles.sexoHalfOn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.sexoText, sexo === 'F' && styles.sexoTextOn]}>feminino</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSexo('M')}
                  style={({ pressed }) => [
                    styles.sexoHalf,
                    sexo === 'M' && styles.sexoHalfOn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.sexoText, sexo === 'M' && styles.sexoTextOn]}>masculino</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={avancarDados}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.primaryBtnText}>ENVIAR</Text>
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.title}>Crie um login</Text>
              <Text style={styles.body}>
                O nome de usuário servirá como identificação para o administrador acessar o aplicativo. O usuário deve
                ser único. Você pode utilizar letras minúsculas e números
              </Text>
              <Text style={styles.fieldLbl}>usuário</Text>
              <TextInput
                style={styles.input}
                placeholder="usuário"
                placeholderTextColor={colors.textMuted}
                value={usuario}
                onChangeText={(t) => setUsuario(t.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLbl}>senha</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="mínimo 6 caracteres"
                  placeholderTextColor={colors.textMuted}
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!showPass}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} style={styles.eye} hitSlop={8}>
                  <FontAwesome name={showPass ? 'eye-slash' : 'eye'} size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => void enviarConvite()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (pressed || busy) && { opacity: busy ? 0.75 : 0.92 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>ENVIAR</Text>
                )}
              </Pressable>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.rule} />
              <View style={styles.heroCircle}>
                <FontAwesome name="clipboard" size={72} color="#9CA3AF" />
                <View style={styles.badgeOk}>
                  <FontAwesome name="check" size={28} color={colors.white} />
                </View>
              </View>
              <Text style={styles.title}>Tudo pronto</Text>
              <Text style={styles.body}>
                {primeiroNome(criadoNome)} já pode ter acesso ao aplicativo :){'\n\n'}
                Basta ele inserir os dados abaixo na tela de login:
              </Text>
              <View style={styles.credBox}>
                <Text style={styles.credLine}>
                  Usuário: <Text style={styles.credStrong}>{criadoLogin}</Text>
                </Text>
              </View>
              <View style={styles.credBox}>
                <Text style={styles.credLine}>
                  Senha: <Text style={styles.credStrong}>{criadoSenha}</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => void abrirWhatsOuPartilhar()}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.primaryBtnText}>ENVIAR PARA {nomeBtnWhats}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStepper(colors: ThemeColors) {
  return StyleSheet.create({
  track: {
    alignSelf: 'center',
    width: screenW - 56,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backBtn: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  backPlaceholder: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: 28,
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
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
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.background,
  },
  inputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  eye: {
    padding: 10,
  },
  sexoRow: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 28,
  },
  sexoHalf: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  sexoHalfOn: {
    backgroundColor: colors.primary,
  },
  sexoText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sexoTextOn: {
    color: colors.white,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rule: {
    height: 4,
    backgroundColor: colors.primary,
    marginHorizontal: -28,
    marginBottom: 24,
    borderRadius: 2,
  },
  heroCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badgeOk: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  credLine: {
    fontSize: 15,
    color: colors.text,
  },
  credStrong: {
    fontWeight: '800',
  },
});
}
