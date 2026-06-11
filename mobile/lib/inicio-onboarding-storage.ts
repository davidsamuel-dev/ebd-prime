import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'ebd_inicio_ob_v1_';

function key(congregacaoId: number, userId: number): string {
  return `${KEY_PREFIX}${congregacaoId}_${userId}`;
}

export async function getPortalInicioOnboardingDone(
  congregacaoId: number,
  userId: number,
): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(key(congregacaoId, userId));
    return v === '1';
  } catch {
    return false;
  }
}

export async function setPortalInicioOnboardingDone(
  congregacaoId: number,
  userId: number,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(congregacaoId, userId), '1');
  } catch {
    /* ignorar falhas de armazenamento (ex.: quota web) */
  }
}
