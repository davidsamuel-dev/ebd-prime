import { Redirect, type Href } from 'expo-router';

/** Compatibilidade: links antigos `/turmas` abrem o separador Turmas no carrossel. */
export default function TurmasLegacyRedirect() {
  return (
    <Redirect
      href={
        {
          pathname: '/(tabs)/index',
          params: { swipe: '1' },
        } as unknown as Href
      }
    />
  );
}
