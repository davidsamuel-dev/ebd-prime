import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainPortalHeader } from '@/components/MainPortalHeader';
import { CadastrosPage } from '@/components/tab-pages/CadastrosPage';
import { InicioPage } from '@/components/tab-pages/InicioPage';
import { TurmasPage } from '@/components/tab-pages/TurmasPage';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAppTheme } from '@/context/AppThemeContext';
import { useMainSwipe } from '@/context/MainSwipeContext';

/**
 * Carrossel horizontal entre Início, Turmas e Cadastros (gesto ou tab bar).
 * Geral fica noutra rota e não participa aqui.
 */
export function MainSwipeHub() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const { swipePage, setSwipePage, consumeScrollAnimated } = useMainSwipe();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (width <= 0) return;
    const animated = consumeScrollAnimated();
    scrollRef.current?.scrollTo({ x: swipePage * width, animated });
  }, [swipePage, width, consumeScrollAnimated]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / Math.max(width, 1));
      setSwipePage(page);
    },
    [setSwipePage, width],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MainPortalHeader />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.flex}
        contentContainerStyle={styles.row}
      >
        <View style={[styles.page, { width }]}>
          <InicioPage />
        </View>
        <View style={[styles.page, { width }]}>
          <TurmasPage />
        </View>
        <View style={[styles.page, { width }]}>
          <CadastrosPage />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.card,
    },
    flex: {
      flex: 1,
    },
    row: {
      flexGrow: 1,
    },
    page: {
      flex: 1,
    },
  });
}
