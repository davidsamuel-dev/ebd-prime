import * as SecureStore from 'expo-secure-store';

const KEY = 'ebd_theme_mode_v1';

export type ThemeMode = 'light' | 'dark';

export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === 'light' || v === 'dark') return v;
    return null;
  } catch {
    return null;
  }
}

export async function setStoredThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, mode);
  } catch {
    /* ignorar falhas de armazenamento (ex.: quota web) */
  }
}
