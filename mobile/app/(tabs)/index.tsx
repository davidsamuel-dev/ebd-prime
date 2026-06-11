import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { MainSwipeHub } from '@/components/MainSwipeHub';
import { useMainSwipe } from '@/context/MainSwipeContext';

/** Carrossel Início ↔ Turmas ↔ Cadastros; Geral está em `geral.tsx`. */
export default function TabsIndexScreen() {
  const params = useLocalSearchParams<{ swipe?: string }>();
  const { setSwipePage, requestPortalRefresh } = useMainSwipe();

  useFocusEffect(
    useCallback(() => {
      requestPortalRefresh();
    }, [requestPortalRefresh]),
  );

  useEffect(() => {
    const s = params.swipe;
    if (s === '1') setSwipePage(1, { animated: true });
    else if (s === '2') setSwipePage(2, { animated: true });
    else if (s === '0') setSwipePage(0, { animated: true });
  }, [params.swipe, setSwipePage]);

  return (
    <View style={{ flex: 1 }}>
      <MainSwipeHub />
    </View>
  );
}
