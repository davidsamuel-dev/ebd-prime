import React from 'react';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

/**
 * Oculta conteúdo secundário (textos longos, links) quando o teclado está aberto,
 * para dar espaço ao formulário e ao botão principal (RNF08).
 */
export function KeyboardHideWhenOpen({ children }: { children: React.ReactNode }) {
  const { keyboardVisible } = useKeyboardVisible();
  if (keyboardVisible) {
    return null;
  }
  return <>{children}</>;
}
