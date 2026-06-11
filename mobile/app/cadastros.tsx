import { Redirect, type Href } from 'expo-router';

/** Compatibilidade: links antigos `/cadastros` abrem o separador Cadastros no carrossel. */
export default function CadastrosLegacyRedirect() {
  return (
    <Redirect
      href={
        {
          pathname: '/(tabs)/index',
          params: { swipe: '2' },
        } as unknown as Href
      }
    />
  );
}
