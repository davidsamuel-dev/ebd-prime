/**
 * Backend REST (PHP/MySQL na Hostinger).
 * Configure `EXPO_PUBLIC_API_URL` no `mobile/.env` (sem barra final).
 */

export function isRestApiConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_API_URL?.trim();
}

export type DataBackend = 'rest';

export function getActiveDataBackend(): DataBackend | null {
  return isRestApiConfigured() ? 'rest' : null;
}

/** Login e recuperação de senha usam a API REST quando a URL está configurada. */
export function useRestAuthBackend(): boolean {
  return isRestApiConfigured();
}

export function isBackendConfigured(): boolean {
  return isRestApiConfigured();
}
