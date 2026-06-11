import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type SetSwipePageOptions = {
  /** `true` quando a mudança vem do toque na tab — o carrossel rola com animação. */
  animated?: boolean;
};

type MainSwipeContextValue = {
  /** Página 0 = Início, 1 = Turmas, 2 = Cadastros (só quando a rota ativa é `index`). */
  swipePage: number;
  setSwipePage: (page: number, options?: SetSwipePageOptions) => void;
  /** Lido uma vez por atualização em `MainSwipeHub` para decidir `scrollTo` animado. */
  consumeScrollAnimated: () => boolean;
  /** Incrementado ao voltar ao portal (tabs) ou após criar turma/aula — refetch em Início/Turmas. */
  portalRefreshKey: number;
  requestPortalRefresh: () => void;
  /** Incrementado após cadastrar turma nova — `TurmaCadastroSuccessToast` no hub do portal. */
  turmaCadastroSuccessKey: number;
  requestTurmaCadastroSuccess: () => void;
  /** Incrementado ao finalizar/enviar a aula — confetes na tela Início. */
  aulaFinalizadaCelebrationKey: number;
  requestAulaFinalizadaCelebration: () => void;
};

const MainSwipeContext = createContext<MainSwipeContextValue | null>(null);

export function MainSwipeProvider({ children }: { children: React.ReactNode }) {
  const [swipePage, setSwipePageState] = useState(0);
  const [portalRefreshKey, setPortalRefreshKey] = useState(0);
  const [turmaCadastroSuccessKey, setTurmaCadastroSuccessKey] = useState(0);
  const [aulaFinalizadaCelebrationKey, setAulaFinalizadaCelebrationKey] = useState(0);
  const scrollAnimatedRef = useRef(false);

  const requestPortalRefresh = useCallback(() => {
    setPortalRefreshKey((k) => k + 1);
  }, []);

  const requestTurmaCadastroSuccess = useCallback(() => {
    setTurmaCadastroSuccessKey((k) => k + 1);
  }, []);

  const requestAulaFinalizadaCelebration = useCallback(() => {
    setAulaFinalizadaCelebrationKey((k) => k + 1);
  }, []);

  const consumeScrollAnimated = useCallback(() => {
    const v = scrollAnimatedRef.current;
    scrollAnimatedRef.current = false;
    return v;
  }, []);

  const setSwipePage = useCallback((page: number, options?: SetSwipePageOptions) => {
    setSwipePageState((prev) => {
      const p = Math.min(2, Math.max(0, Math.round(page)));
      if (options?.animated === true && p !== prev) {
        scrollAnimatedRef.current = true;
      }
      return p;
    });
  }, []);

  const value = useMemo(
    () => ({
      swipePage,
      setSwipePage,
      consumeScrollAnimated,
      portalRefreshKey,
      requestPortalRefresh,
      turmaCadastroSuccessKey,
      requestTurmaCadastroSuccess,
      aulaFinalizadaCelebrationKey,
      requestAulaFinalizadaCelebration,
    }),
    [
      swipePage,
      setSwipePage,
      consumeScrollAnimated,
      portalRefreshKey,
      requestPortalRefresh,
      turmaCadastroSuccessKey,
      requestTurmaCadastroSuccess,
      aulaFinalizadaCelebrationKey,
      requestAulaFinalizadaCelebration,
    ],
  );

  return <MainSwipeContext.Provider value={value}>{children}</MainSwipeContext.Provider>;
}

export function useMainSwipe(): MainSwipeContextValue {
  const ctx = useContext(MainSwipeContext);
  if (!ctx) {
    throw new Error('useMainSwipe deve ficar dentro de MainSwipeProvider');
  }
  return ctx;
}

/** Para modais na stack raiz (ex.: `nova-aula`) que ficam fora do `MainSwipeProvider`. */
export function useMainSwipeOptional(): MainSwipeContextValue | null {
  return useContext(MainSwipeContext);
}
