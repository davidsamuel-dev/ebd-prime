/**
 * Paleta oficial EBD Prime — documentação (Guia Mestre de Identidade Visual).
 * Texto em barras/botões azuis: sempre branco (#FFFFFF).
 */
export const ThemeLight = {
  primary: '#0078D4',
  primaryDark: '#005A9E',
  primaryMuted: '#93C5FD',
  background: '#FFFFFF',
  card: '#F3F4F6',
  surface: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  accent: '#3B82F6',
  success: '#10B981',
  warningBanner: '#FEF3C7',
  warningBannerText: '#92400E',
  border: '#E5E7EB',
  danger: '#DC2626',
  overlay: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  tabInactive: '#9CA3AF',
  tipBackground: '#F0F9FF',
  tipBorder: '#BFDBFE',
  buttonSecondary: '#E5E7EB',
  buttonSecondaryText: '#1F2937',
  statusPending: '#8B3A42',
} as const;

/** Modo escuro — azul marinho profundo com contraste legível. */
export const ThemeDark = {
  primary: '#0078D4',
  primaryDark: '#005A9E',
  primaryMuted: '#60A5FA',
  background: '#0C1527',
  card: '#101E32',
  surface: '#162236',
  text: '#E2E8F0',
  textMuted: '#8B9CB3',
  accent: '#3B82F6',
  success: '#34D399',
  warningBanner: '#422006',
  warningBannerText: '#FCD34D',
  border: '#243752',
  danger: '#F87171',
  overlay: 'rgba(0,0,0,0.65)',
  white: '#FFFFFF',
  tabInactive: '#64748B',
  tipBackground: '#152A45',
  tipBorder: '#2563EB',
  buttonSecondary: '#1E3349',
  buttonSecondaryText: '#E2E8F0',
  statusPending: '#F4A261',
} as const;

/** Compatibilidade com imports existentes (modo claro). */
export const Theme = ThemeLight;

export type ThemeColors = {
  readonly primary: string;
  readonly primaryDark: string;
  readonly primaryMuted: string;
  readonly background: string;
  readonly card: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly success: string;
  readonly warningBanner: string;
  readonly warningBannerText: string;
  readonly border: string;
  readonly danger: string;
  readonly overlay: string;
  readonly white: string;
  readonly tabInactive: string;
  readonly tipBackground: string;
  readonly tipBorder: string;
  readonly buttonSecondary: string;
  readonly buttonSecondaryText: string;
  readonly statusPending: string;
};
