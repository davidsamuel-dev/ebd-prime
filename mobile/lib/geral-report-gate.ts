import * as SecureStore from 'expo-secure-store';

import { apiGetGeralResumo } from '@/lib/api';
import { getActiveDataBackend } from '@/lib/backend-config';
import { resolveUltimaAulaRange } from '@/lib/geral-resumo-dates';

function gateKey(congregacaoId: number | null | undefined): string {
  const cid = congregacaoId != null && congregacaoId > 0 ? congregacaoId : 0;
  return `eb_prime_geral_relatorio_disponivel_${cid}`;
}

/** Desbloqueia o painel na aba Geral quando a aula está totalmente finalizada. */
export async function markRelatorioGeralDisponivel(congregacaoId: number | null | undefined): Promise<void> {
  try {
    await SecureStore.setItemAsync(gateKey(congregacaoId), '1');
  } catch {
    /* dispositivo sem keychain, etc. */
  }
}

async function geralTemDadosNoServidor(congregacaoId: number): Promise<boolean> {
  if (getActiveDataBackend() === null) {
    return false;
  }
  try {
    const range = await resolveUltimaAulaRange(congregacaoId);
    if (range == null) {
      return false;
    }
    const res = await apiGetGeralResumo({
      congregacaoId,
      dateFrom: range.from,
      dateTo: range.to,
      papel: 'todos',
    });
    return res.ok && (res.indicadores?.tem_dados === true || res.ranking_turmas.length > 0);
  } catch {
    return false;
  }
}

export async function isRelatorioGeralDisponivel(congregacaoId: number | null | undefined): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(gateKey(congregacaoId));
    if (v === '1') {
      return true;
    }
  } catch {
    /* SecureStore indisponível */
  }

  if (congregacaoId != null && congregacaoId > 0) {
    return geralTemDadosNoServidor(congregacaoId);
  }
  return false;
}

export async function clearRelatorioGeralGate(congregacaoId?: number | null): Promise<void> {
  try {
    if (congregacaoId != null && congregacaoId > 0) {
      await SecureStore.deleteItemAsync(gateKey(congregacaoId));
      return;
    }
    await SecureStore.deleteItemAsync(gateKey(0));
  } catch {
    /* ignore */
  }
}
