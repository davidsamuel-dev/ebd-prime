import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAdaptiveHero } from '@/components/KeyboardAdaptiveHero';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { apiForgotLookup, apiForgotSend, isApiConfigured } from '@/lib/api';
import { getActiveDataBackend } from '@/lib/backend-config';

const PROGRESS_TOTAL = 3;
/** Sem EXPO_PUBLIC_API_URL: fluxo só para demonstração (sem rede). */
const FORGOT_SIM_DELAY_MS = 400;

function demoForgotMaskedEmail(usuario: string): string {
  const u = usuario.trim().toLowerCase();
  const head = u.slice(0, Math.min(3, Math.max(1, u.length)));
  return `${head}***@email.com`;
}

function demoForgotContaHandle(usuario: string): string {
  const u = usuario.trim().toLowerCase().replace(/\s+/g, '');
  return u.length >= 2 ? u : 'conta';
}

function forgotSimDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FORGOT_SIM_DELAY_MS));
}
const screenW = Dimensions.get('window').width;

function StepperBar({ stepIndex }: { stepIndex: number }) {
  const stepper = useThemedStyles(createStepper);
  const pct = Math.min(1, (stepIndex + 1) / PROGRESS_TOTAL);
  const barW = screenW - 48;
  return (
    <View style={stepper.track}>
      <View style={[stepper.fill, { width: barW * pct }]} />
    </View>
  );
}

function IllustrationCircle({ children }: { children: React.ReactNode }) {
  const illus = useThemedStyles(createIllus);
  return (
    <KeyboardAdaptiveHero keyboardScale={0.58} collapseLayout layoutBaseSize={200}>
      <View style={illus.circle}>{children}</View>
    </KeyboardAdaptiveHero>
  );
}

function PhoneHandIllustration() {
  const illus = useThemedStyles(createIllus);
  return (
    <Image
      source={require('@/assets/mão_celular.png')}
      style={illus.phoneHandImage}
      resizeMode="contain"
      accessibilityLabel="Ilustração de telefone na mão"
    />
  );
}

export default function EsqueciSenhaScreen() {
  const illus = useThemedStyles(createIllus);
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { keyboardVisible, keyboardHeight } = useKeyboardVisible();

  const scrollBottomPad = useMemo(() => {
    const base = 48 + Math.max(insets.bottom, 8);
    if (!keyboardVisible) {
      return base;
    }
    const kb = keyboardHeight > 48 ? keyboardHeight : 220;
    return Math.min(kb + Math.max(insets.bottom, 12) + 28, 400);
  }, [keyboardVisible, keyboardHeight, insets.bottom]);

  const [step, setStep] = useState(0);
  const [usuario, setUsuario] = useState('');
  const [usuarioSalvo, setUsuarioSalvo] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [contaHandle, setContaHandle] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [emailEnviadoPara, setEmailEnviadoPara] = useState('');
  const [busy, setBusy] = useState(false);

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const handleProsseguir = async () => {
    const u = usuario.trim();
    if (u.length < 2) {
      Alert.alert('Utilizador', 'Indique o nome de utilizador.');
      return;
    }
    setBusy(true);
    try {
      if (!isApiConfigured()) {
        await forgotSimDelay();
        setUsuarioSalvo(u);
        setMaskedEmail(demoForgotMaskedEmail(u));
        setContaHandle(demoForgotContaHandle(u));
        setEmailConfirm('');
        setStep(1);
        return;
      }
      const res = await apiForgotLookup(u);
      if (!res.ok) {
        Alert.alert('Recuperação', res.error ?? 'Não foi possível continuar.');
        return;
      }
      setUsuarioSalvo(u);
      setMaskedEmail(res.masked_email);
      setContaHandle(res.conta_handle);
      setEmailConfirm('');
      setStep(1);
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnviar = async () => {
    const em = emailConfirm.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      Alert.alert('E-mail', 'Informe um e-mail válido.');
      return;
    }
    setBusy(true);
    try {
      if (!isApiConfigured()) {
        await forgotSimDelay();
        setEmailEnviadoPara(em);
        setStep(2);
        return;
      }
      const res = await apiForgotSend(usuarioSalvo, em);
      if (!res.ok) {
        Alert.alert('Recuperação', res.error ?? 'Não foi possível enviar.');
        return;
      }
      setEmailEnviadoPara(em);
      setStep(2);
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View style={styles.topRow}>
          <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Voltar">
            <FontAwesome name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <FontAwesome name="book" size={28} color={colors.primary} />
          <View style={styles.backPlaceholder} />
        </View>

        <StepperBar stepIndex={step} />

        <ScrollView
          style={styles.scrollFlex}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={[
            styles.scroll,
            {
              flexGrow: 1,
              paddingBottom: scrollBottomPad,
            },
          ]}
        >
          {step === 0 && (
            <>
              <IllustrationCircle>
                <PhoneHandIllustration />
              </IllustrationCircle>
              <Text style={[styles.title, keyboardVisible && styles.titleKb]}>Insira seu usuário</Text>
              <Text style={[styles.body, keyboardVisible && styles.bodyKb]}>
                Insira o nome de usuário que você cadastrou. O usuário é utilizado junto com a senha para fazer login
                no aplicativo
              </Text>
              <Text style={styles.fieldLbl}>usuário</Text>
              <TextInput
                style={[styles.input, keyboardVisible && styles.inputKb]}
                placeholder="usuário"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={usuario}
                onChangeText={setUsuario}
              />
              <Pressable
                onPress={handleProsseguir}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  keyboardVisible && styles.primaryBtnKb,
                  (pressed || busy) && { opacity: 0.88 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>PROSSEGUIR</Text>
                )}
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              <IllustrationCircle>
                <PhoneHandIllustration />
              </IllustrationCircle>
              <Text style={[styles.title, keyboardVisible && styles.titleKb]}>Insira seu e-mail</Text>
              <Text style={[styles.body, keyboardVisible && styles.bodyKb]}>
                Encontramos sua conta <Text style={styles.bold}>@{contaHandle}</Text>. Para enviar o link de recuperação
                para <Text style={styles.bold}>{maskedEmail}</Text>, confirme seu e-mail abaixo:
              </Text>
              <Text style={styles.fieldLbl}>email</Text>
              <TextInput
                style={[styles.input, keyboardVisible && styles.inputKb]}
                placeholder="email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={emailConfirm}
                onChangeText={setEmailConfirm}
              />
              <Pressable
                onPress={handleEnviar}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  keyboardVisible && styles.primaryBtnKb,
                  (pressed || busy) && { opacity: 0.88 },
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
              <IllustrationCircle>
                <View style={illus.clipWrap}>
                  <FontAwesome name="clipboard" size={56} color={colors.textMuted} />
                  <View style={illus.badgeOk}>
                    <FontAwesome name="check" size={26} color={colors.white} />
                  </View>
                </View>
              </IllustrationCircle>
              <Text style={styles.title}>E-mail enviado</Text>
              <Text style={styles.body}>
                Um link de recuperação foi enviado para o seu e-mail{' '}
                <Text style={styles.bold}>{emailEnviadoPara}</Text>. Verifique também a pasta de spam. Abra o link no
                navegador, crie a nova senha e depois volte ao aplicativo para iniciar sessão.
              </Text>
              <Pressable
                onPress={() => router.replace('/login' as Href)}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.primaryBtnText}>VOLTAR</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

const stepper = StyleSheet.create({
  track: {
    alignSelf: 'center',
    width: screenW - 48,
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

function createIllus(colors: ThemeColors) {
  return StyleSheet.create({
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneHandImage: {
    width: 156,
    height: 156,
  },
  clipWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOk: {
    position: 'absolute',
    right: 36,
    bottom: 36,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  scrollFlex: {
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
  },
  backPlaceholder: {
    width: 38,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleKb: {
    fontSize: 19,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  bodyKb: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
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
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    backgroundColor: colors.background,
  },
  inputKb: {
    marginBottom: 10,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnKb: {
    marginTop: 4,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
});
}
