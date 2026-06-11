/** URLs públicas do site institucional (mesmo host da API em produção). */
export function getSiteBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (raw && raw.length > 0) {
    return raw.replace(/\/$/, '');
  }
  return 'https://ebd.adparaiso.com.br';
}

export function getHelpUrl(): string {
  return `${getSiteBaseUrl()}/ajuda.html`;
}
