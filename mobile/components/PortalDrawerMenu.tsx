import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { getHelpUrl } from '@/lib/site-urls';


const DRAWER_W = Math.min(Dimensions.get('window').width * 0.82, 360);

const OPEN_MS = 420;
const CLOSE_MS = 360;
/** Abrir: fundo surge suavemente (ease-out). Fechar: some sem cortar (ease-in). */
const easeOpen = Easing.bezier(0.22, 1, 0.36, 1);
const easeClose = Easing.bezier(0.4, 0, 1, 1);

/** Ajuste quando tiver páginas oficiais. */
const URL_INSTAGRAM = 'https://www.instagram.com';
const URL_FACEBOOK = 'https://www.facebook.com';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
};

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

function Divider()  {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.divider} />;
}

export function PortalDrawerMenu({ visible, onClose, onLogout }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const slide = useRef(new Animated.Value(DRAWER_W)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const versionLine = useMemo(() => {
    const v = Constants.expoConfig?.version ?? '1.0.0';
    const build =
      Constants.expoConfig?.android?.versionCode ??
      Constants.expoConfig?.ios?.buildNumber ??
      '';
    return build !== '' && build != null ? `Versão: ${v} (${build})` : `Versão: ${v}`;
  }, []);

  const animateOpen = useCallback(() => {
    slide.setValue(DRAWER_W);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: OPEN_MS,
        easing: easeOpen,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: OPEN_MS,
        easing: easeOpen,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, slide]);

  const animateClose = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: DRAWER_W,
          duration: CLOSE_MS,
          easing: easeClose,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: easeClose,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          after?.();
          onClose();
        }
      });
    },
    [backdropOpacity, onClose, slide],
  );

  useEffect(() => {
    if (visible) {
      animateOpen();
    }
  }, [animateOpen, visible]);

  const handleBackdrop = useCallback(() => {
    animateClose();
  }, [animateClose]);

  const emBreve = useCallback((titulo: string) => {
    animateClose();
    setTimeout(() => Alert.alert(titulo, 'Funcionalidade em breve.'), CLOSE_MS + 40);
  }, [animateClose]);

  const handleShare = useCallback(async () => {
    animateClose();
    setTimeout(async () => {
      try {
        await Share.share({
          message: 'Conheça o Portal EBD — gestão de Escola Bíblica Dominical.',
          title: 'Portal EBD',
        });
      } catch {
        /* cancelado */
      }
    }, CLOSE_MS + 40);
  }, [animateClose]);

  const openUrl = useCallback(
    (url: string) => {
      animateClose();
      setTimeout(() => {
        void Linking.openURL(url).catch(() => {
          Alert.alert('Link', 'Não foi possível abrir o endereço.');
        });
      }, CLOSE_MS + 40);
    },
    [animateClose],
  );

  const handleLogout = useCallback(() => {
    animateClose();
    setTimeout(() => onLogout(), CLOSE_MS + 40);
  }, [animateClose, onLogout]);

  const openConfiguracoes = useCallback(() => {
    animateClose();
    setTimeout(() => router.push('/configuracoes'), CLOSE_MS + 40);
  }, [animateClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => animateClose()}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdropLayer, { opacity: backdropOpacity }]}>
          <Pressable
            style={styles.backdropPress}
            onPress={handleBackdrop}
            accessibilityLabel="Fechar menu"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_W,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <SafeAreaView style={styles.drawerSafe} edges={['top', 'right', 'bottom']}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.drawerHeader}>
                <Image
                  source={require('@/assets/images/logo_comprida.png')}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                  accessibilityLabel="EBD Prime"
                />
              </View>

              <Divider />

              <MenuRow
                icon={<FontAwesome name="cog" size={20} color={colors.textMuted} />}
                label="Configurações"
                onPress={openConfiguracoes}
              />
              <MenuRow
                icon={<FontAwesome name="bar-chart" size={20} color={colors.textMuted} />}
                label="Relatório financeiro"
                onPress={() => emBreve('Relatório financeiro')}
              />
              <MenuRow
                icon={<FontAwesome name="list-ul" size={20} color={colors.textMuted} />}
                label="Registro de atividades"
                onPress={() => emBreve('Registro de atividades')}
              />
              <MenuRow
                icon={<FontAwesome name="file-text-o" size={20} color={colors.textMuted} />}
                label="Avisos"
                onPress={() => emBreve('Avisos')}
              />
              <MenuRow
                icon={<FontAwesome name="sign-out" size={20} color={colors.textMuted} />}
                label="Sair da conta"
                onPress={handleLogout}
              />

              <Divider />

              <MenuRow
                icon={<FontAwesome name="share-alt" size={20} color={colors.textMuted} />}
                label="Compartilhe o Portal EBD"
                onPress={handleShare}
              />
              <MenuRow
                icon={<FontAwesome5 name="instagram" size={20} color={colors.textMuted} brand />}
                label="Siga nosso Instagram"
                onPress={() => openUrl(URL_INSTAGRAM)}
              />
              <MenuRow
                icon={<FontAwesome5 name="facebook" size={20} color={colors.textMuted} brand />}
                label="Curta nossa página"
                onPress={() => openUrl(URL_FACEBOOK)}
              />

              <Divider />

              <MenuRow
                icon={<FontAwesome name="question-circle" size={22} color={colors.textMuted} />}
                label="Ajuda e suporte"
                onPress={() => openUrl(getHelpUrl())}
              />

              <Text style={styles.footerVer}>{versionLine}</Text>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  /** Opacidade animada no wrapper — transição suave com o painel. */
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropPress: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 12,
  },
  drawerSafe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  drawerLogo: {
    height: 40,
    width: 160,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuRowPressed: {
    backgroundColor: colors.card,
  },
  menuIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
    marginLeft: 8,
  },
  footerVer: {
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.85,
  },
});
}
