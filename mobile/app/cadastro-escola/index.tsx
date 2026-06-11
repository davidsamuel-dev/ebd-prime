import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { KeyboardHideWhenOpen } from '@/components/KeyboardHideWhenOpen';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  apiOnboardingRegister,
  apiOnboardingSmsRequest,
  apiOnboardingSmsVerify,
} from '@/lib/api';
import { getActiveDataBackend } from '@/lib/backend-config';
import { fetchIbgeEstados, fetchIbgeMunicipios, type IbgeEstado, type IbgeMunicipio } from '@/lib/ibge';
import { formatBrMobileDisplayFromDigits, normalizeBrPhoneDigits } from '@/lib/phone-br';
import { saveAuthToken } from '@/lib/auth-storage';
import {
  isPushAvailableInThisBuild,
  requestNotificationPermissionAfterOnboarding,
} from '@/lib/notifications-permission';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

const PROGRESS_TOTAL = 8;
const screenW = Dimensions.get('window').width;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function IllustrationCircle({
  children,
  keyboardScale,
}: {
  children: React.ReactNode;
  /** Opcional: menos encolhimento no passo telefone para caber título + formulário. */
  keyboardScale?: number;
}) {
  const illus = useThemedStyles(createIllus);
  return (
    <KeyboardAdaptiveHero
      keyboardScale={keyboardScale ?? 0.52}
      collapseLayout
      layoutBaseSize={200}
    >
      <View style={illus.circle}>{children}</View>
    </KeyboardAdaptiveHero>
  );
}

export default function CadastroEscolaScreen() {
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
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [notifPermissionBusy, setNotifPermissionBusy] = useState(false);
  const [acceptedTerm, setAcceptedTerm] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [smsPhase, setSmsPhase] = useState<'loading' | 'code'>('loading');
  const [smsCode, setSmsCode] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);

  const [preToken, setPreToken] = useState('');
  /** SMS sem backend (sem EXPO_PUBLIC_API_URL). */
  const [smsOfflineDemo, setSmsOfflineDemo] = useState(false);
  /** Último passo sem gravar no servidor. */
  const [registrationDemoOnly, setRegistrationDemoOnly] = useState(false);

  const [nomeReal, setNomeReal] = useState('');
  const [email, setEmail] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | null>(null);

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [nomeInstituicao, setNomeInstituicao] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [estadoUf, setEstadoUf] = useState('');
  const [cidadeNome, setCidadeNome] = useState('');

  const [estados, setEstados] = useState<IbgeEstado[]>([]);
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [modalEstado, setModalEstado] = useState(false);
  const [modalCidade, setModalCidade] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [ibgeLoading, setIbgeLoading] = useState(false);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<{
    token?: string;
    userName: string;
    userId: number;
    congregacaoId: number | null;
    loginUsuario?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!modalEstado || estados.length > 0) {
      return;
    }
    let cancelled = false;
    fetchIbgeEstados()
      .then((list) => {
        if (!cancelled) {
          setEstados(list);
        }
      })
      .catch(() => {
        Alert.alert('Localidades', 'Não foi possível carregar os estados. Verifique a internet.');
      });
    return () => {
      cancelled = true;
    };
  }, [modalEstado, estados.length]);

  const loadMunicipios = useCallback(async (uf: string) => {
    setIbgeLoading(true);
    setCitySearch('');
    try {
      const list = await fetchIbgeMunicipios(uf);
      setMunicipios(list);
    } catch {
      Alert.alert('Localidades', 'Não foi possível carregar as cidades.');
      setMunicipios([]);
    } finally {
      setIbgeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (modalCidade && estadoUf && municipios.length === 0 && !ibgeLoading) {
      void loadMunicipios(estadoUf);
    }
  }, [modalCidade, estadoUf, municipios.length, ibgeLoading, loadMunicipios]);

  const citiesFiltered = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) {
      return municipios;
    }
    return municipios.filter((m) => m.nome.toLowerCase().includes(q));
  }, [municipios, citySearch]);

  const phoneDisplayLine = phoneE164
    ? formatBrMobileDisplayFromDigits(phoneE164)
    : '';

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    if (step === 7) {
      return;
    }
    if (step === 3) {
      setStep(1);
      setSmsPhase('loading');
      setSmsCode('');
      setPreToken('');
      setSmsOfflineDemo(false);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };

  const handleTermContinue = () => {
    if (!acceptedTerm) {
      Alert.alert('Confirmação', 'Marque a caixa para confirmar que é responsável pela gestão.');
      return;
    }
    setStep(1);
  };

  const handlePhoneSubmit = async () => {
    const n = normalizeBrPhoneDigits(phoneInput);
    if (!n) {
      Alert.alert('Telefone', 'Informe um número válido com DDD.');
      return;
    }
    setPhoneE164(n);

    if (!getActiveDataBackend()) {
      setSmsOfflineDemo(true);
      setRegistrationDemoOnly(false);
      setStep(2);
      setSmsPhase('loading');
      setSmsBusy(true);
      try {
        await delay(1600);
        setPreToken('');
        setStep(3);
      } finally {
        setSmsBusy(false);
      }
      return;
    }

    setSmsOfflineDemo(false);
    setStep(2);
    setSmsPhase('loading');
    setSmsBusy(true);
    try {
      const r = await apiOnboardingSmsRequest(n);
      if (!r.ok) {
        Alert.alert('SMS', r.error ?? 'Não foi possível solicitar o código.');
        setStep(1);
        return;
      }
      if (r.dev_code) {
        const v = await apiOnboardingSmsVerify(n, r.dev_code);
        if (!v.ok) {
          Alert.alert('Verificação', v.error ?? 'Código inválido.');
          setStep(1);
          return;
        }
        setPreToken(v.pre_token);
        setStep(3);
        return;
      }
      setSmsPhase('code');
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
      setStep(1);
    } finally {
      setSmsBusy(false);
    }
  };

  const handleManualSmsVerify = async () => {
    if (smsOfflineDemo) {
      return;
    }
    const code = smsCode.replace(/\D/g, '');
    if (code.length !== 6) {
      Alert.alert('Código', 'Insira os 6 dígitos enviados por SMS.');
      return;
    }
    setSmsBusy(true);
    try {
      const v = await apiOnboardingSmsVerify(phoneE164, code);
      if (!v.ok) {
        Alert.alert('Verificação', v.error ?? 'Código incorreto.');
        return;
      }
      setPreToken(v.pre_token);
      setStep(3);
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setSmsBusy(false);
    }
  };

  const handlePersonalNext = () => {
    if (nomeReal.trim().length < 3) {
      Alert.alert('Nome', 'Informe seu nome completo.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('E-mail', 'Informe um e-mail válido.');
      return;
    }
    if (!sexo) {
      Alert.alert('Sexo', 'Selecione feminino ou masculino.');
      return;
    }
    setStep(5);
  };

  const handleCredentialsNext = () => {
    if (!/^[a-z0-9]{3,40}$/.test(usuario.trim())) {
      Alert.alert(
        'Usuário',
        'Use apenas letras minúsculas e números, entre 3 e 40 caracteres.',
      );
      return;
    }
    if (senha.length < 6) {
      Alert.alert('Senha', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setStep(6);
  };

  const handleInstitutionSubmit = async () => {
    if (!nomeInstituicao.trim()) {
      Alert.alert('Instituição', 'Informe o nome da igreja ou escola.');
      return;
    }
    if (!logradouro.trim() || !cidadeNome.trim() || estadoUf.length !== 2) {
      Alert.alert('Endereço', 'Preencha logradouro, estado e cidade.');
      return;
    }

    const demoOnly = getActiveDataBackend() === null || smsOfflineDemo;
    if (demoOnly) {
      setSubmitBusy(true);
      try {
        await delay(600);
        setPendingAuth(null);
        setRegistrationDemoOnly(true);
        setStep(7);
      } finally {
        setSubmitBusy(false);
      }
      return;
    }

    if (preToken.length !== 64) {
      Alert.alert('Sessão', 'Refaça a verificação do telefone.');
      return;
    }

    setSubmitBusy(true);
    try {
      const res = await apiOnboardingRegister({
        pre_token: preToken,
        nome_real: nomeReal.trim(),
        email: email.trim(),
        sexo: sexo!,
        login_usuario: usuario.trim(),
        senha,
        congregacao_nome: nomeInstituicao.trim(),
        logradouro: logradouro.trim(),
        numero: numero.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidadeNome.trim(),
        estado: estadoUf,
      });
      if (!res.ok) {
        Alert.alert('Cadastro', res.error ?? 'Não foi possível concluir.');
        return;
      }
      setRegistrationDemoOnly(false);
      setPendingAuth({
        token: res.token,
        userName: res.user.nome_real,
        userId: res.user.id,
        congregacaoId: res.user.congregacao_id ?? null,
        loginUsuario: usuario.trim().toLowerCase(),
      });
      setStep(7);
    } catch {
      Alert.alert('Rede', 'Sem ligação ao servidor.');
    } finally {
      setSubmitBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 7 || !isPushAvailableInThisBuild()) {
      return;
    }
    const t = setTimeout(() => {
      void requestNotificationPermissionAfterOnboarding();
    }, 600);
    return () => clearTimeout(t);
  }, [step]);

  const handlePermitirNotificacoes = async () => {
    setNotifPermissionBusy(true);
    try {
      await requestNotificationPermissionAfterOnboarding();
    } finally {
      setNotifPermissionBusy(false);
    }
  };

  const handleFinalEntrar = async () => {
    if (pendingAuth) {
      if (pendingAuth.token) {
        await saveAuthToken(pendingAuth.token);
      }
      login({
        userName: pendingAuth.userName,
        userId: pendingAuth.userId,
        congregacaoId: pendingAuth.congregacaoId,
        congregacaoNome: nomeInstituicao.trim() || null,
        congregacaoBairro: bairro.trim() || null,
        nivelAcesso: 'admin',
        loginUsuario: pendingAuth.loginUsuario ?? null,
        mode: 'api',
      });
    } else if (registrationDemoOnly) {
      login({
        userName: nomeReal.trim() || 'Usuário',
        userId: null,
        congregacaoId: null,
        congregacaoNome: nomeInstituicao.trim() || null,
        congregacaoBairro: bairro.trim() || null,
        nivelAcesso: null,
        loginUsuario: usuario.trim().toLowerCase() || null,
        mode: 'demo',
      });
    }
    router.replace('/(tabs)');
  };

  const openEstadoModal = () => {
    setModalEstado(true);
  };

  const pickEstado = (e: IbgeEstado) => {
    setEstadoUf(e.sigla);
    setCidadeNome('');
    setMunicipios([]);
    setModalEstado(false);
  };

  const openCidadeModal = () => {
    if (!estadoUf) {
      Alert.alert('Estado', 'Selecione primeiro o estado.');
      return;
    }
    setModalCidade(true);
    if (municipios.length === 0 && !ibgeLoading) {
      void loadMunicipios(estadoUf);
    }
  };

  const pickCidade = (m: IbgeMunicipio) => {
    setCidadeNome(m.nome);
    setModalCidade(false);
  };

  const showHeaderBack = step > 0 && step < 7;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View style={styles.topRow}>
          {showHeaderBack ? (
            <Pressable
              onPress={goBack}
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
          <View style={styles.backPlaceholder} />
        </View>

        <StepperBar stepIndex={step} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
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
                <FontAwesome name="building" size={72} color="#EAB308" />
              </IllustrationCircle>
              <Text style={styles.title}>Cadastrar nova escola</Text>
              <Text style={styles.body}>
                Se sua escola ainda não usa o Portal EBD e você é um(a) dos(as) responsáveis pela
                gestão, basta confirmar abaixo para continuar.
              </Text>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.linkCenter}>
                  Se sua escola já possui cadastro, clique aqui.
                </Text>
              </Pressable>

              <Pressable
                style={styles.checkRow}
                onPress={() => setAcceptedTerm((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerm }}
              >
                <View style={[styles.checkBox, acceptedTerm && styles.checkBoxOn]}>
                  {acceptedTerm ? (
                    <FontAwesome name="check" size={14} color={colors.white} />
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>
                  Confirmo que sou responsável pela gestão da minha escola, a qual ainda não utiliza
                  o aplicativo
                </Text>
              </Pressable>

              <Pressable
                onPress={handleTermContinue}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  !acceptedTerm && styles.primaryBtnDisabled,
                  pressed && acceptedTerm && { opacity: 0.9 },
                ]}
                disabled={!acceptedTerm}
              >
                <Text style={styles.primaryBtnText}>CONTINUAR</Text>
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              <IllustrationCircle keyboardScale={0.62}>
                <Image
                  source={require('@/assets/mão_celular.png')}
                  style={illus.phoneHandImage}
                  resizeMode="contain"
                  accessibilityLabel="Ilustração de telefone na mão"
                />
              </IllustrationCircle>
              <Text style={[styles.title, keyboardVisible && styles.titlePhoneKb]}>
                Insira seu telefone
              </Text>
              <Text style={[styles.body, keyboardVisible && styles.bodyPhoneKb]}>
                Insira o número do seu telefone no campo abaixo. Você receberá um SMS para confirmação
              </Text>
              <Text style={styles.fieldLbl}>telefone</Text>
              <TextInput
                style={styles.input}
                placeholder="telefone"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phoneInput}
                onChangeText={setPhoneInput}
              />
              <Text style={[styles.legal, keyboardVisible && styles.legalPhoneKb]}>
                Ao prosseguir o cadastro você concorda com nossas Políticas de Privacidade e Termos de
                Uso.
              </Text>
              <Pressable onPress={handlePhoneSubmit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.primaryBtnText}>ENVIAR</Text>
              </Pressable>
            </>
          )}

          {step === 2 && smsPhase === 'loading' && (
            <>
              <IllustrationCircle>
                <FontAwesome name="send" size={64} color={colors.primary} />
              </IllustrationCircle>
              <Text style={styles.title}>Aguarde um instante</Text>
              <Text style={styles.body}>
                Estamos enviando um SMS de confirmação para o número{' '}
                <Text style={styles.bold}>{phoneDisplayLine}</Text>
              </Text>
              {smsBusy ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
              ) : null}
              <Pressable disabled style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
                <Text style={styles.primaryBtnText}>SEGUIR</Text>
              </Pressable>
            </>
          )}

          {step === 2 && smsPhase === 'code' && (
            <>
              <Text style={styles.title}>Código SMS</Text>
              <KeyboardHideWhenOpen>
                <Text style={styles.body}>
                  Digite o código de 6 dígitos enviado para {phoneDisplayLine}
                </Text>
              </KeyboardHideWhenOpen>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={smsCode}
                onChangeText={(t) => setSmsCode(t.replace(/\D/g, ''))}
              />
              <Pressable
                onPress={handleManualSmsVerify}
                disabled={smsBusy}
                style={({ pressed }) => [styles.primaryBtn, (pressed || smsBusy) && { opacity: 0.85 }]}
              >
                {smsBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>CONFIRMAR</Text>
                )}
              </Pressable>
            </>
          )}

          {step === 3 && (
            <>
              <IllustrationCircle>
                <View style={illus.phoneOkWrap}>
                  <FontAwesome name="mobile" size={56} color={colors.textMuted} />
                  <View style={illus.badgeOk}>
                    <FontAwesome name="check" size={28} color={colors.white} />
                  </View>
                </View>
              </IllustrationCircle>
              <Text style={styles.title}>Verificado com sucesso</Text>
              <Text style={styles.body}>
                Seu telefone foi verificado, você já pode seguir para o próximo passo
              </Text>
              <Pressable onPress={() => setStep(4)} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.primaryBtnText}>SEGUIR</Text>
              </Pressable>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.title}>Dados pessoais</Text>
              <KeyboardHideWhenOpen>
                <Text style={styles.body}>
                  Informe seu nome, sobrenome e e-mail. As informações são privadas e serão utilizadas
                  para criar seu perfil no aplicativo
                </Text>
              </KeyboardHideWhenOpen>
              <Text style={styles.fieldLbl}>nome pessoal</Text>
              <TextInput
                style={styles.input}
                placeholder="nome pessoal"
                placeholderTextColor={colors.textMuted}
                value={nomeReal}
                onChangeText={setNomeReal}
              />
              <Text style={styles.fieldLbl}>e-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="e-mail"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.sexoRow}>
                <Pressable
                  onPress={() => setSexo('F')}
                  style={[styles.sexoBtn, sexo === 'F' && styles.sexoBtnActive]}
                >
                  <Text style={[styles.sexoText, sexo === 'F' && styles.sexoTextActive]}>feminino</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSexo('M')}
                  style={[styles.sexoBtn, sexo === 'M' && styles.sexoBtnActive]}
                >
                  <Text style={[styles.sexoText, sexo === 'M' && styles.sexoTextActive]}>masculino</Text>
                </Pressable>
              </View>
              <Pressable onPress={handlePersonalNext} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.primaryBtnText}>ENVIAR</Text>
              </Pressable>
            </>
          )}

          {step === 5 && (
            <>
              <Text style={styles.title}>Crie um login</Text>
              <KeyboardHideWhenOpen>
                <Text style={styles.body}>
                  O usuário pode conter letras minúsculas e números. Você deve guardá-lo com você, ele
                  servirá para você acessar sua conta futuramente
                </Text>
              </KeyboardHideWhenOpen>
              <Text style={styles.fieldLbl}>usuário</Text>
              <TextInput
                style={styles.input}
                placeholder="usuário"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={usuario}
                onChangeText={(t) => setUsuario(t.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              />
              <Text style={styles.fieldLbl}>nova senha</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="nova senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  value={senha}
                  onChangeText={setSenha}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} style={styles.eye}>
                  <FontAwesome name={showPass ? 'eye-slash' : 'eye'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <Pressable onPress={handleCredentialsNext} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.primaryBtnText}>ENVIAR</Text>
              </Pressable>
            </>
          )}

          {step === 6 && (
            <>
              <IllustrationCircle>
                <FontAwesome name="building" size={72} color="#EAB308" />
              </IllustrationCircle>
              <Text style={styles.title}>Informações do local</Text>
              <KeyboardHideWhenOpen>
                <Text style={styles.body}>Informe onde está localizada sua igreja ou escola</Text>
              </KeyboardHideWhenOpen>
              <Text style={styles.fieldLbl}>nome da igreja ou escola</Text>
              <TextInput
                style={styles.input}
                placeholder="nome"
                placeholderTextColor={colors.textMuted}
                value={nomeInstituicao}
                onChangeText={setNomeInstituicao}
              />
              <View style={styles.rowAddr}>
                <View style={styles.flex2}>
                  <Text style={styles.fieldLbl}>logradouro</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="logradouro"
                    placeholderTextColor={colors.textMuted}
                    value={logradouro}
                    onChangeText={setLogradouro}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLbl}>nº</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="nº"
                    placeholderTextColor={colors.textMuted}
                    value={numero}
                    onChangeText={setNumero}
                  />
                </View>
              </View>
              <Text style={styles.fieldLbl}>bairro</Text>
              <TextInput
                style={styles.input}
                placeholder="bairro"
                placeholderTextColor={colors.textMuted}
                value={bairro}
                onChangeText={setBairro}
              />
              <View style={styles.rowAddr}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLbl}>estado</Text>
                  <Pressable style={styles.inputLike} onPress={openEstadoModal}>
                    <Text style={estadoUf ? styles.inputLikeText : styles.placeholder}>
                      {estadoUf || 'UF'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.flex2}>
                  <Text style={styles.fieldLbl}>cidade</Text>
                  <Pressable style={styles.inputLike} onPress={openCidadeModal}>
                    <Text style={cidadeNome ? styles.inputLikeText : styles.placeholder}>
                      {cidadeNome || 'cidade'}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                onPress={handleInstitutionSubmit}
                disabled={submitBusy}
                style={({ pressed }) => [styles.primaryBtn, (pressed || submitBusy) && { opacity: 0.85 }]}
              >
                {submitBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>ENVIAR</Text>
                )}
              </Pressable>
            </>
          )}

          {step === 7 && (
            <>
              <IllustrationCircle>
                <View style={illus.schoolOkWrap}>
                  <FontAwesome name="building" size={56} color="#EAB308" />
                  <View style={illus.badgeOk}>
                    <FontAwesome name="check" size={28} color={colors.white} />
                  </View>
                </View>
              </IllustrationCircle>
              <Text style={styles.title}>Tudo pronto</Text>
              {registrationDemoOnly ? (
                <>
                  <Text style={styles.body}>
                    Percurso concluído em modo demonstração (sem API configurada).
                  </Text>
                  <Text style={styles.bodyMuted}>
                    Para gravar a escola: configure EXPO_PUBLIC_API_URL no mobile/.env e refaça o cadastro.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.body}>Seu cadastro foi criado com sucesso.</Text>
                  <Text style={styles.body}>Pressione o botão abaixo para entrar no seu perfil</Text>
                </>
              )}
              {Platform.OS !== 'web' && isPushAvailableInThisBuild() ? (
                <View style={styles.notifCard}>
                  <View style={styles.notifIconWrap}>
                    <FontAwesome name="bell" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.notifTextWrap}>
                    <Text style={styles.notifTitle}>Ative as notificações</Text>
                    <Text style={styles.notifDesc}>
                      Receba avisos da escola, lembretes de aula e novidades do EBD Prime.
                    </Text>
                  </View>
                  <Pressable
                    onPress={handlePermitirNotificacoes}
                    disabled={notifPermissionBusy}
                    style={({ pressed }) => [
                      styles.notifBtn,
                      (pressed || notifPermissionBusy) && { opacity: 0.85 },
                    ]}
                  >
                    {notifPermissionBusy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.notifBtnText}>PERMITIR</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
              <Pressable onPress={handleFinalEntrar} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.primaryBtnText}>ENTRAR</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalEstado} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setModalEstado(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Selecione o estado</Text>
            <FlatList
              data={estados}
              keyExtractor={(item) => String(item.id)}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable style={styles.cityItem} onPress={() => pickEstado(item)}>
                  <Text style={styles.cityItemText}>{item.nome} ({item.sigla})</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalCidade} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setModalCidade(false)}>
          <Pressable style={styles.modalSheetTall} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Selecione uma cidade</Text>
            {ibgeLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <FlatList
                data={citiesFiltered}
                keyExtractor={(item) => String(item.id)}
                style={styles.modalListFlex}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.cityItem} onPress={() => pickCidade(item)}>
                    <Text style={styles.cityItemText}>{item.nome}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyList}>Nenhuma cidade encontrada.</Text>
                }
              />
            )}
            <TextInput
              style={styles.searchFooter}
              placeholder="pesquise uma cidade"
              placeholderTextColor={colors.textMuted}
              value={citySearch}
              onChangeText={setCitySearch}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStepper(colors: ThemeColors) {
  return StyleSheet.create({
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
  phoneOkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolOkWrap: {
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
  /** Passo telefone: agrupa título + texto com o teclado aberto sem esconder conteúdo. */
  titlePhoneKb: {
    fontSize: 19,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  bodyPhoneKb: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  bodyMuted: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  bold: {
    fontWeight: '700',
  },
  linkCenter: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    textDecorationLine: 'underline',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
    marginBottom: 14,
  },
  eye: {
    padding: 10,
  },
  inputLike: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
    justifyContent: 'center',
  },
  inputLikeText: {
    fontSize: 15,
    color: colors.text,
  },
  placeholder: {
    fontSize: 15,
    color: colors.textMuted,
  },
  legal: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  legalPhoneKb: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10,
  },
  sexoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sexoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sexoBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  sexoText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sexoTextActive: {
    color: colors.primary,
  },
  notifCard: {
    marginTop: 20,
    marginBottom: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  notifIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTextWrap: {
    gap: 4,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  notifDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  notifBtn: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  notifBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.border,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  rowAddr: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalSheetTall: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxHeight: '88%',
    minHeight: 420,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: colors.text,
  },
  modalList: {
    maxHeight: 320,
  },
  modalListFlex: {
    flex: 1,
  },
  cityItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  cityItemText: {
    fontSize: 16,
    color: colors.text,
  },
  searchFooter: {
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 15,
    marginTop: 8,
  },
  emptyList: {
    textAlign: 'center',
    color: colors.textMuted,
    padding: 20,
  },
});
}
