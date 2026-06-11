import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { KeyboardAdaptiveHero } from '@/components/KeyboardAdaptiveHero';
import { KeyboardHideWhenOpen } from '@/components/KeyboardHideWhenOpen';
import { KeyboardSecondaryOpacity } from '@/components/KeyboardSecondaryOpacity';
import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { apiHealth, apiLogin, isApiConfigured } from '@/lib/api';
import { saveAuthToken } from '@/lib/auth-storage';
import { getHelpUrl } from '@/lib/site-urls';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WHATSAPP_URL =
  'https://wa.me/5563991249775?text=' +
  encodeURIComponent('Olá estou vindo do login do app');

/** Margens em repouso vs com teclado (login — animação suave). */
const LOGIN_LAYOUT = {
  passFieldMarginBottom: { open: 18, kb: 6 },
  linksRowMarginBottom: { open: 28, kb: 10 },
} as const;

const LAYOUT_ANIM_MS = 260;
const LAYOUT_EASING = Easing.out(Easing.cubic);

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { keyboardVisible, keyboardHeight } = useKeyboardVisible();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [healthTip, setHealthTip] = useState<{ ok: boolean; text: string } | null>(null);

  const passFieldMarginBottom = useRef(new Animated.Value(LOGIN_LAYOUT.passFieldMarginBottom.open)).current;
  const linksRowMarginBottom = useRef(new Animated.Value(LOGIN_LAYOUT.linksRowMarginBottom.open)).current;

  useEffect(() => {
    const kb = keyboardVisible;
    const ease = LAYOUT_EASING;
    const dur = LAYOUT_ANIM_MS;
    Animated.parallel([
      Animated.timing(passFieldMarginBottom, {
        toValue: kb ? LOGIN_LAYOUT.passFieldMarginBottom.kb : LOGIN_LAYOUT.passFieldMarginBottom.open,
        duration: dur,
        easing: ease,
        useNativeDriver: false,
      }),
      Animated.timing(linksRowMarginBottom, {
        toValue: kb ? LOGIN_LAYOUT.linksRowMarginBottom.kb : LOGIN_LAYOUT.linksRowMarginBottom.open,
        duration: dur,
        easing: ease,
        useNativeDriver: false,
      }),
    ]).start();
  }, [keyboardVisible]);

  useEffect(() => {
    if (!isApiConfigured()) {
      setHealthTip(null);
      return;
    }

    let cancelled = false;

    apiHealth().then((h) => {
      if (cancelled) return;
      switch (h.status) {
        case 'ok':
          setHealthTip(null);
          break;
        case 'degraded': {
          const err = h.payload.database?.error_code;
          const first = h.payload.hints?.[0];
          setHealthTip({
            ok: false,
            text: first
              ? `${first}${err ? ` (${err})` : ''}`
              : 'PHP responde · MySQL indisponível — confira backend/.env, XAMPP ou Docker.',
          });
          break;
        }
        case 'unreachable':
          if (h.reason === 'not_configured') {
            setHealthTip({
              ok: false,
              text: 'API não configurada. Defina EXPO_PUBLIC_API_URL em mobile/.env e reinicie com npx expo start -c.',
            });
            break;
          }
          if (h.reason === 'invalid_response') {
            setHealthTip({
              ok: false,
              text:
                'O endereço da API abre uma página HTML (404), não o PHP. Publique o backend na Hostinger (pasta api/ na raiz de ebd.adparaiso.com.br) ou use a API no PC com o IP da rede no .env.',
            });
            break;
          }
          setHealthTip({
            ok: false,
            text: 'Sem ligação à API. Confirme EXPO_PUBLIC_API_URL, Wi‑fi do telemóvel e se o servidor PHP está no ar (health.php).',
          });
          break;
        default:
          setHealthTip({ ok: false, text: 'Estado do servidor não disponível.' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEntrar() {
    setLoading(true);
    try {
      if (isApiConfigured()) {
        const res = await apiLogin(username, password);
        if (res.ok && res.user) {
          if (res.token) {
            await saveAuthToken(res.token);
          }
          login({
            userName: res.user.nome_real,
            userId: res.user.id,
            congregacaoId: res.user.congregacao_id ?? null,
            congregacaoNome: res.user.congregacao_nome ?? null,
            congregacaoSubtitulo: res.user.congregacao_subtitulo ?? null,
            congregacaoBairro: res.user.congregacao_bairro ?? null,
            nivelAcesso: res.user.nivel_acesso,
            loginUsuario: (res.user.login_usuario?.trim() || username.trim()) || null,
            mode: 'api',
          });
          router.replace('/(tabs)');
          return;
        }
        if (!res.ok) {
          Alert.alert(
            'Login',
            `${res.error ?? 'Credenciais inválidas.'}${res.code ? `\n(${res.code})` : ''}`,
          );
          return;
        }
        Alert.alert('Login', 'Resposta inválida do servidor.');
        return;
      }

      login({
        userName: username.trim() || 'David',
        userId: null,
        congregacaoId: null,
        nivelAcesso: null,
        loginUsuario: username.trim() || null,
        mode: 'demo',
      });
      router.replace('/(tabs)');
    } catch {
      if (isApiConfigured()) {
        Alert.alert(
          'Rede',
          'Não foi possível contactar a API. Confirme EXPO_PUBLIC_API_URL e o servidor PHP.',
        );
      } else {
        login({
          userName: username.trim() || 'David',
          userId: null,
          congregacaoId: null,
          nivelAcesso: null,
          loginUsuario: username.trim() || null,
          mode: 'demo',
        });
        router.replace('/(tabs)');
      }
    } finally {
      setLoading(false);
    }
  }

  const contentHeight = useMemo(
    () => windowHeight - insets.top - insets.bottom,
    [windowHeight, insets.top, insets.bottom],
  );

  const logoOffsetY = useMemo(
    () => (keyboardVisible ? 0 : contentHeight * 0.5 * 0.15),
    [contentHeight, keyboardVisible],
  );

  const scrollBottomPad = useMemo(() => {
    if (!keyboardVisible) {
      return 120;
    }
    /** Só o necessário para poder rolar o rodapé acima do teclado (sem scrollToEnd automático). */
    const kb = keyboardHeight > 48 ? keyboardHeight : 220;
    return Math.min(kb + Math.max(insets.bottom, 12) + 32, 420);
  }, [keyboardVisible, keyboardHeight, insets.bottom]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 4 : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            flexGrow: keyboardVisible ? 0 : 1,
            paddingBottom: scrollBottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.page,
            !keyboardVisible && { minHeight: contentHeight },
          ]}
        >
          <View
            style={[
              styles.heroZone,
              !keyboardVisible && { minHeight: contentHeight * 0.5 },
            ]}
          >
            <View style={{ transform: [{ translateY: logoOffsetY }] }}>
              <KeyboardAdaptiveHero keyboardScale={0.55}>
                <Image
                  source={require('@/assets/images/logo1.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessibilityLabel="EBD Prime"
                />
              </KeyboardAdaptiveHero>
            </View>
          </View>

          <View
            style={[
              styles.formZone,
              !keyboardVisible && { minHeight: contentHeight * 0.5 },
            ]}
          >
            <KeyboardHideWhenOpen>
              {healthTip && !healthTip.ok ? (
                <View style={[styles.healthBanner, styles.healthBannerBad]}>
                  <Text style={styles.healthBannerText}>{healthTip.text}</Text>
                </View>
              ) : null}
            </KeyboardHideWhenOpen>

            <View style={styles.field}>
              <Text style={styles.label}>usuário</Text>
              <TextInput
                style={styles.input}
                placeholder="usuário"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <Animated.View style={[styles.field, { marginBottom: passFieldMarginBottom }]}>
              <Text style={styles.label}>senha</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setShowPass((v) => !v)}
                  style={styles.eye}
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <FontAwesome name={showPass ? 'eye-slash' : 'eye'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View style={[styles.linksRow, { marginBottom: linksRowMarginBottom }]}>
              <Pressable onPress={() => router.push('/esqueci-senha' as Href)}>
                <Text style={styles.helpLinks}>Esqueci minha senha</Text>
              </Pressable>
              <Text style={styles.helpSep}> • </Text>
              <Pressable
                onPress={() => {
                  Linking.openURL(getHelpUrl()).catch(() => {
                    Alert.alert('Ajuda', 'Não foi possível abrir a central de ajuda no navegador.');
                  });
                }}
              >
                <Text style={styles.helpLinks}>Ajuda</Text>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleEntrar}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || loading) && { opacity: 0.85 },
                loading && { opacity: 0.65 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{loading ? 'CARREGANDO…' : 'ENTRAR'}</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/cadastro-escola' as Href)}
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.footer}>
                Cadastre uma <Text style={styles.footerBold}>nova escola</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <KeyboardSecondaryOpacity style={styles.fabWrap}>
        <Pressable
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel="WhatsApp"
          onPress={() => {
            Linking.openURL(WHATSAPP_URL).catch(() => {});
          }}
        >
          <FontAwesome name="whatsapp" size={28} color={colors.white} />
        </Pressable>
      </KeyboardSecondaryOpacity>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 28,
  },
  page: {
    flex: 1,
    width: '100%',
  },
  heroZone: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  formZone: {
    justifyContent: 'flex-start',
    width: '100%',
    paddingTop: 4,
  },
  logoImage: {
    width: 308,
    height: 171,
  },
  healthBanner: {
    marginTop: 0,
    marginBottom: 14,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  healthBannerBad: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.danger,
  },
  healthBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 17,
  },
  field: {
    marginBottom: 18,
  },
  label: {
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
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    paddingRight: 12,
    backgroundColor: colors.background,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
  },
  eye: {
    padding: 8,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  helpSep: {
    fontSize: 12,
    color: colors.textMuted,
  },
  helpLinks: {
    fontSize: 12,
    color: colors.textMuted,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 15,
    color: colors.textMuted,
  },
  footerBold: {
    fontWeight: '800',
    color: colors.primary,
  },
  fabWrap: {
    position: 'absolute',
    right: 22,
    bottom: 28,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
}
