import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GeralRelatorioDashboard } from '@/components/GeralRelatorioDashboard';
import { PortalDrawerMenu } from '@/components/PortalDrawerMenu';
import { useAuth } from '@/context/AuthContext';
import { type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/AppThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { isRelatorioGeralDisponivel } from '@/lib/geral-report-gate';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const HERO_MIN_H = Math.min(SCREEN_H * 0.4, 320);

/** Estado vazio (antes da primeira aula finalizada): arte em `assets/boneco_pc.png`. */
function GeralIllustration() {
  const illus = useThemedStyles(createIllus);
  return (
    <View style={illus.stage} accessibilityRole="image" accessibilityLabel="Ilustração">
      <Image
        source={require('@/assets/boneco_pc.png')}
        style={illus.heroImg}
        resizeMode="contain"
      />
    </View>
  );
}

export default function GeralScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { logout, congregacaoId, congregacaoNome, congregacaoBairro, congregacaoSubtitulo } = useAuth();
  const [relatorioReady, setRelatorioReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refreshRelatorioGate = useCallback(() => {
    void isRelatorioGeralDisponivel(congregacaoId).then(setRelatorioReady);
  }, [congregacaoId]);

  useEffect(() => {
    refreshRelatorioGate();
  }, [refreshRelatorioGate]);

  useFocusEffect(
    useCallback(() => {
      refreshRelatorioGate();
    }, [refreshRelatorioGate]),
  );

  const nomeIgrejaTitulo = useMemo(() => {
    const n = congregacaoNome?.trim();
    return n && n.length > 0 ? n : 'Sua igreja';
  }, [congregacaoNome]);

  const nomeIgrejaEmpty = useMemo(() => nomeIgrejaTitulo.toUpperCase(), [nomeIgrejaTitulo]);

  const bairroLinha = useMemo(() => {
    const s = congregacaoSubtitulo?.trim();
    if (s && s.length > 0) {
      return s;
    }
    const b = congregacaoBairro?.trim();
    return b && b.length > 0 ? b : 'Bairro';
  }, [congregacaoSubtitulo, congregacaoBairro]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Sessão', 'Deseja terminar sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await logout();
            router.replace('/login');
          })();
        },
      },
    ]);
  }, [logout]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  if (relatorioReady) {
    return (
      <>
        <GeralRelatorioDashboard
          nomeIgreja={nomeIgrejaTitulo}
          bairro={bairroLinha}
          onOpenMenu={openDrawer}
        />
        <PortalDrawerMenu
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onLogout={confirmLogout}
        />
      </>
    );
  }

  return (
    <>
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { minHeight: HERO_MIN_H }]}>
            <View style={styles.portalRow}>
              <View style={styles.portalSide} />
              <Text style={styles.portalTitle}>Portal EBD</Text>
              <Pressable
                onPress={openDrawer}
                style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Menu"
              >
                <FontAwesome name="bars" size={22} color={colors.white} />
              </Pressable>
            </View>

            <Text style={styles.churchName} numberOfLines={2}>
              {nomeIgrejaEmpty}
            </Text>
            <Text style={styles.neighborhood}>{bairroLinha}</Text>

            <View style={styles.bubbleWrap}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  Ainda não temos muitas informações. Volte após finalizar uma aula
                </Text>
              </View>
              <View style={styles.thoughtTrail}>
                <View style={[styles.thoughtDot, styles.d1]} />
                <View style={[styles.thoughtDot, styles.d2]} />
                <View style={[styles.thoughtDot, styles.d3]} />
              </View>
            </View>
          </View>

          <View style={styles.sheet}>
            <GeralIllustration />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
    <PortalDrawerMenu
      visible={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      onLogout={confirmLogout}
    />
    </>
  );
}

function createIllus(colors: ThemeColors) {
  return StyleSheet.create({
  stage: {
    width: '100%',
    minHeight: 248,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  heroImg: {
    width: Math.min(SCREEN_W - 56, 340),
    height: 260,
    alignSelf: 'center',
  },
});
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  safeTop: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  portalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  portalSide: {
    width: 44,
  },
  portalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  churchName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  neighborhood: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 20,
  },
  bubbleWrap: {
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    maxWidth: SCREEN_H > 700 ? 400 : 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  thoughtTrail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginRight: 24,
    marginTop: 6,
  },
  thoughtDot: {
    backgroundColor: colors.white,
    borderRadius: 99,
  },
  d1: {
    width: 10,
    height: 10,
    marginBottom: 0,
    marginRight: 10,
    opacity: 0.95,
  },
  d2: {
    width: 14,
    height: 14,
    marginBottom: -4,
    marginRight: 10,
    opacity: 0.92,
  },
  d3: {
    width: 20,
    height: 20,
    marginBottom: -10,
    opacity: 0.9,
  },
  sheet: {
    flex: 1,
    minHeight: SCREEN_H * 0.42,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
}
