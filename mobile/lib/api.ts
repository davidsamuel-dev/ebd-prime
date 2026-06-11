/**
 * Cliente HTTP para a API PHP (PDO / MySQL).
 * Configure `EXPO_PUBLIC_API_URL` no `.env` (sem barra final).
 */

import { getAuthToken } from '@/lib/auth-storage';
import {
  getActiveDataBackend,
  isBackendConfigured,
  isRestApiConfigured,
  useRestAuthBackend,
} from '@/lib/backend-config';
const DEFAULT_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 8_000;

export function getApiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return isBackendConfigured();
}

async function restForgotLookup(usuario: string): Promise<ForgotLookupResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/auth/forgot-lookup.php`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario.trim() }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await parseJsonBody<ForgotLookupResponse>(res);
  if (data === null) {
    return { ok: false, error: 'Resposta inválida', code: 'VALIDATION_ERROR' };
  }
  return data;
}

async function restForgotSend(usuario: string, email: string): Promise<ForgotSendResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/auth/forgot-send.php`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario.trim(), email: email.trim() }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await parseJsonBody<ForgotSendResponse>(res);
  if (data === null) {
    return {
      ok: false,
      error:
        res.status >= 500
          ? 'Erro no servidor ao enviar o e-mail. Verifique se o SMTP e o PHPMailer estão configurados na Hostinger.'
          : `Resposta inválida do servidor (HTTP ${res.status}).`,
      code: 'VALIDATION_ERROR',
    };
  }
  return data;
}

function mapForgotNetworkError(): ForgotSendResponse {
  const base = getApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      error: 'API não configurada. Defina EXPO_PUBLIC_API_URL no mobile/.env e reinicie com npx expo start -c.',
      code: 'STORE_FAILED',
    };
  }
  return {
    ok: false,
    error: `Sem ligação à API (${base}). Publique o backend em ebd.adparaiso.com.br ou use a API local no emulador.`,
    code: 'STORE_FAILED',
  };
}

export type ApiErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_JSON'
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'FORBIDDEN'
  | 'DB_UNAVAILABLE'
  | 'NO_CONGREGACAO'
  | 'DUPLICATE_ENTRY'
  | 'STORE_FAILED'
  | 'NOT_FOUND';

export type ApiMeta = {
  service: string;
  version: string;
};

export type ApiUser = {
  id: number;
  nome_real: string;
  email: string | null;
  nivel_acesso: string;
  congregacao_id: number | null;
  /** Login de acesso (API PHP). */
  login_usuario?: string | null;
  /** Quando o login PHP enviar dados da congregação (opcional). */
  congregacao_nome?: string | null;
  congregacao_bairro?: string | null;
  congregacao_subtitulo?: string | null;
};

export type LoginApiResponse =
  | { ok: true; meta?: ApiMeta; user: ApiUser; token?: string; expires_at?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type StoreUsuarioPayload = {
  nome_real: string;
  sexo: 'M' | 'F';
  data_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  escolaridade?: string | null;
  estado_civil?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavel_1_nome?: string | null;
  responsavel_1_tel?: string | null;
  responsavel_2_nome?: string | null;
  responsavel_2_tel?: string | null;
  data_matricula?: string | null;
  cadastrar_como_professor?: boolean;
  congregacao_id?: number | null;
  /** Matricula o novo utilizador nesta turma (aluno ou professor conforme o toggle). */
  turma_id?: number | null;
  /** Com `usuario_id` > 0: atualiza cadastro existente via API REST. */
  usuario_id?: number | null;
  /** Com `usuario_id`: desativa o vínculo de aluno (some das chamadas). */
  inativar_vinculo_aluno?: boolean;
};

export type StoreUsuarioResponse =
  | { ok: true; meta?: ApiMeta; id: number; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type HealthApiResponse = {
  ok: boolean;
  service?: string;
  version?: string;
  time?: string;
  /** Dicas quando a BD está em baixo (`/api/health.php`). */
  hints?: string[];
  database?: {
    status: string;
    latency_ms?: number | null;
    error_code?: string;
  };
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** GET/POST autenticados com `Authorization: Bearer` quando existe token guardado. */
async function authFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetchWithTimeout(url, { ...init, headers }, timeoutMs);
}

async function parseJsonBody<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type HealthCheckResult =
  | {
      status: 'ok';
      version?: string;
      databaseLatencyMs?: number | null;
    }
  | { status: 'unreachable'; reason: 'network' | 'not_configured' | 'invalid_response' }
  | { status: 'degraded'; reason: 'database_down'; payload: HealthApiResponse }
  | { status: 'down'; payload: HealthApiResponse };

/** GET `/api/health.php` — valida URL base e disponibilidade da API + MySQL. */
export async function apiHealth(): Promise<HealthCheckResult> {
  const base = getApiBaseUrl();
  if (!base) {
    return { status: 'unreachable', reason: 'not_configured' };
  }

  const url = `${base}/api/health.php`;

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      HEALTH_TIMEOUT_MS,
    );

    const data = await parseJsonBody<HealthApiResponse>(res);
    if (data === null) {
      return { status: 'unreachable', reason: 'invalid_response' };
    }

    if (data.database?.status === 'down') {
      return { status: 'degraded', reason: 'database_down', payload: data };
    }

    if (res.ok && data.ok) {
      return {
        status: 'ok',
        version: data.version,
        databaseLatencyMs: data.database?.latency_ms ?? null,
      };
    }

    return { status: 'down', payload: data };
  } catch {
    return { status: 'unreachable', reason: 'network' };
  }
}

export async function apiLogin(usuario: string, senha: string): Promise<LoginApiResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/auth/login.php`;

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuario: usuario.trim(), senha }),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const data = await parseJsonBody<LoginApiResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'VALIDATION_ERROR' };
    }

    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type CongregacaoDetalhe = {
  id: number;
  nome: string;
  subtitulo: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  estado: string | null;
  cidade: string | null;
  status?: string | null;
};

export type GetCongregacaoResponse =
  | { ok: true; congregacao: CongregacaoDetalhe }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetCongregacao(congregacaoId: number | null): Promise<GetCongregacaoResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  try {
    const res = await authFetch(
      `${base}/api/congregacao/get.php?${params.toString()}`,
      { method: 'GET' },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<{
      ok: boolean;
      congregacao?: Record<string, unknown>;
      error?: string;
      code?: ApiErrorCode;
    }>(res);
    if (data === null || !data.ok || data.congregacao == null) {
      return { ok: false, error: data?.error ?? 'Resposta inválida', code: data?.code ?? 'STORE_FAILED' };
    }
    const c = data.congregacao;
    const subt = c.subtitulo != null ? String(c.subtitulo).trim() : '';
    return {
      ok: true,
      congregacao: {
        id: Number(c.id),
        nome: String(c.nome ?? ''),
        subtitulo: subt.length > 0 ? subt : null,
        logradouro: c.logradouro != null && String(c.logradouro).trim() !== '' ? String(c.logradouro) : null,
        numero: c.numero != null && String(c.numero).trim() !== '' ? String(c.numero) : null,
        bairro: c.bairro != null && String(c.bairro).trim() !== '' ? String(c.bairro) : null,
        estado: c.estado != null && String(c.estado).trim() !== '' ? String(c.estado).trim().toUpperCase().slice(0, 2) : null,
        cidade: c.cidade != null && String(c.cidade).trim() !== '' ? String(c.cidade) : null,
        status: c.status != null ? String(c.status) : null,
      },
    };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateCongregacaoPayload = {
  congregacao_id: number;
  nome: string;
  subtitulo?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  estado?: string | null;
  cidade?: string | null;
};

export type UpdateCongregacaoResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateCongregacao(
  payload: UpdateCongregacaoPayload,
): Promise<UpdateCongregacaoResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/congregacao/update.php`;
  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<UpdateCongregacaoResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type ForgotLookupResponse =
  | { ok: true; masked_email: string; conta_handle: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiForgotLookup(usuario: string): Promise<ForgotLookupResponse> {
  if (useRestAuthBackend()) {
    try {
      return await restForgotLookup(usuario);
    } catch {
      throw new Error('NETWORK_ERROR');
    }
  }
  throw new Error('NETWORK_ERROR');
}

export type ForgotSendResponse =
  | { ok: true; message?: string; email_destino_mascarado?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiForgotSend(usuario: string, email: string): Promise<ForgotSendResponse> {
  try {
    return await restForgotSend(usuario, email);
  } catch {
    return mapForgotNetworkError();
  }
}

export type OnboardingSmsRequestResponse =
  | { ok: true; dev_code?: string; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiOnboardingSmsRequest(
  telefone: string,
): Promise<OnboardingSmsRequestResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/onboarding/sms-request.php`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telefone }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<OnboardingSmsRequestResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'VALIDATION_ERROR' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type OnboardingSmsVerifyResponse =
  | { ok: true; pre_token: string; pre_token_expires_at?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiOnboardingSmsVerify(
  telefone: string,
  codigo: string,
): Promise<OnboardingSmsVerifyResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/onboarding/sms-verify.php`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telefone, codigo }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<OnboardingSmsVerifyResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'VALIDATION_ERROR' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type OnboardingRegisterPayload = {
  pre_token: string;
  nome_real: string;
  email: string;
  sexo: 'M' | 'F';
  login_usuario: string;
  senha: string;
  congregacao_nome: string;
  logradouro: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  estado: string;
};

export type OnboardingRegisterResponse =
  | { ok: true; user: ApiUser; token?: string; expires_at?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiOnboardingRegister(
  payload: OnboardingRegisterPayload,
): Promise<OnboardingRegisterResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/onboarding/register.php`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<OnboardingRegisterResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiStoreUsuario(
  payload: StoreUsuarioPayload,
  scopeCongregacaoId?: number | null,
): Promise<StoreUsuarioResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/usuarios/store.php`;

  const body: StoreUsuarioPayload = { ...payload };
  if (
    (body.congregacao_id == null || body.congregacao_id <= 0) &&
    scopeCongregacaoId != null &&
    scopeCongregacaoId > 0
  ) {
    body.congregacao_id = scopeCongregacaoId;
  }

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const data = await parseJsonBody<StoreUsuarioResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }

    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type TurmaListItem = {
  id: number;
  nome_turma: string;
  congregacao_id: number;
  departamento_id: number | null;
  departamento_nome: string | null;
  alunos_count: number;
};

export type ListTurmasResponse =
  | { ok: true; turmas: TurmaListItem[]; congregacao_id?: number }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiListTurmas(congregacaoId?: number | null): Promise<ListTurmasResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (congregacaoId != null && congregacaoId > 0) {
    params.set('congregacao_id', String(congregacaoId));
  }
  const qs = params.toString();
  const url = `${base}/api/turmas/list.php${qs ? `?${qs}` : ''}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<ListTurmasResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UsuarioListItem = {
  id: number;
  nome_real: string;
  email: string | null;
  nivel_acesso: string;
  congregacao_id: number | null;
  turma_label: string | null;
  /** Turma ativa de aluno; ausente se a API não enviar. */
  turma_id?: number | null;
  sexo?: 'M' | 'F';
};

export type ListUsuariosResponse =
  | { ok: true; usuarios: UsuarioListItem[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiListUsuarios(options?: {
  congregacaoId?: number | null;
  q?: string;
  limit?: number;
}): Promise<ListUsuariosResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  const cid = options?.congregacaoId;
  if (cid != null && cid > 0) {
    params.set('congregacao_id', String(cid));
  }
  if (options?.q != null && options.q.trim() !== '') {
    params.set('q', options.q.trim());
  }
  if (options?.limit != null) {
    params.set('limit', String(options.limit));
  }
  const qs = params.toString();
  const url = `${base}/api/usuarios/list.php${qs ? `?${qs}` : ''}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<ListUsuariosResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UsuarioDetail = {
  id: number;
  nome_real: string;
  sexo: 'M' | 'F';
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  escolaridade: string | null;
  estado_civil: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  responsavel_1_nome: string | null;
  responsavel_1_tel: string | null;
  responsavel_2_nome: string | null;
  responsavel_2_tel: string | null;
  nivel_acesso: string;
  congregacao_id: number;
  turma_id: number | null;
};

export type GetUsuarioResponse =
  | { ok: true; meta?: ApiMeta; usuario: UsuarioDetail }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetUsuario(
  usuarioId: number,
  scopeCongregacaoId?: number | null,
): Promise<GetUsuarioResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ usuario_id: String(usuarioId) });
  if (scopeCongregacaoId != null && scopeCongregacaoId > 0) {
    params.set('congregacao_id', String(scopeCongregacaoId));
  }
  const url = `${base}/api/usuarios/get.php?${params.toString()}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<GetUsuarioResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UsuarioInativoListItem = {
  id: number;
  nome_real: string;
  sexo: 'M' | 'F';
  turma_id_hint: number | null;
  turma_label_hint: string | null;
};

export type ListUsuariosInativosResponse =
  | { ok: true; usuarios: UsuarioInativoListItem[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type AusenteListItem = {
  id: number;
  nome_real: string;
  turma_id: number;
  turma_nome: string | null;
};

export type ListAusentesResponse =
  | {
      ok: true;
      congregacao_id?: number;
      tem_dados_suficientes: boolean;
      aulas_consideradas: number;
      usuarios: AusenteListItem[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiListAusentes(
  congregacaoId?: number | null,
): Promise<ListAusentesResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (congregacaoId != null && congregacaoId > 0) {
    params.set('congregacao_id', String(congregacaoId));
  }
  const qs = params.toString();
  const url = `${base}/api/usuarios/ausentes-list.php${qs ? `?${qs}` : ''}`;

  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<ListAusentesResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiListUsuariosInativos(options?: {
  congregacaoId?: number | null;
  q?: string;
}): Promise<ListUsuariosInativosResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options?.congregacaoId != null && options.congregacaoId > 0) {
    params.set('congregacao_id', String(options.congregacaoId));
  }
  if (options?.q?.trim()) {
    params.set('q', options.q.trim());
  }
  const qs = params.toString();
  const url = `${base}/api/usuarios/inativos-list.php${qs ? `?${qs}` : ''}`;
  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<ListUsuariosInativosResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type AtivarUsuarioAlunoPayload = {
  usuario_id: number;
  turma_id: number;
  nome_real?: string | null;
  congregacao_id?: number | null;
};

export type InativarUsuarioCadastroResponse =
  | { ok: true; meta?: ApiMeta; id: number; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiInativarUsuarioCadastro(
  usuarioId: number,
  scopeCongregacaoId?: number | null,
  options?: { nome_real?: string; sexo?: 'M' | 'F' },
): Promise<InativarUsuarioCadastroResponse> {
  const uid = Math.floor(Number(usuarioId));
  if (uid <= 0) {
    return { ok: false, error: 'Cadastro inválido', code: 'VALIDATION_ERROR' };
  }

  const base = getApiBaseUrl();
  const congregacaoBody =
    scopeCongregacaoId != null && scopeCongregacaoId > 0 ? scopeCongregacaoId : null;

  const storePayload = {
    usuario_id: uid,
    id: uid,
    nome_real: (options?.nome_real ?? 'Cadastro').trim() || 'Cadastro',
    sexo: options?.sexo === 'F' ? 'F' : 'M',
    congregacao_id: congregacaoBody,
    inativar_vinculo_aluno: true,
    inativar: 1,
  };

  const postStore = async (): Promise<InativarUsuarioCadastroResponse> => {
    const res = await authFetch(
      `${base}/api/usuarios/store.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(storePayload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<InativarUsuarioCadastroResponse>(res);
    if (data !== null) {
      return data;
    }
    return {
      ok: false,
      error:
        res.status === 404
          ? 'API desatualizada no servidor. Execute npm run deploy:hostinger.'
          : `Servidor respondeu ${res.status} sem JSON válido. Atualize a API.`,
      code: 'STORE_FAILED',
    };
  };

  try {
    const resInativar = await authFetch(
      `${base}/api/usuarios/inativar.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: uid, id: uid, congregacao_id: congregacaoBody }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const dataInativar = await parseJsonBody<InativarUsuarioCadastroResponse>(resInativar);
    if (dataInativar?.ok) {
      return dataInativar;
    }
    if (dataInativar && !dataInativar.ok && dataInativar.error) {
      return dataInativar;
    }
    return postStore();
  } catch {
    try {
      return await postStore();
    } catch {
      throw new Error('NETWORK_ERROR');
    }
  }
}

export type AtivarUsuarioAlunoResponse =
  | { ok: true; meta?: ApiMeta; id: number; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiAtivarUsuarioAluno(
  payload: AtivarUsuarioAlunoPayload,
  scopeCongregacaoId?: number | null,
): Promise<AtivarUsuarioAlunoResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/usuarios/ativar.php`;
  const body = {
    ...payload,
    congregacao_id: payload.congregacao_id ?? scopeCongregacaoId ?? null,
  };
  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<AtivarUsuarioAlunoResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type DeleteUsuarioCadastroResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiDeleteUsuarioCadastro(
  usuarioId: number,
  scopeCongregacaoId?: number | null,
): Promise<DeleteUsuarioCadastroResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/usuarios/delete-cadastro.php`;
  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          congregacao_id: scopeCongregacaoId ?? null,
        }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<DeleteUsuarioCadastroResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type StoreTurmaPayload = {
  nome_turma: string;
  congregacao_id?: number | null;
  departamento_id?: number | null;
  /** Texto livre (ex.: faixa etária); o servidor faz correspondência ou cria `departamentos`. */
  departamento_nome?: string | null;
  /** Se > 0, atualiza turma existente em vez de criar. */
  turma_id?: number | null;
};

export type StoreTurmaResponse =
  | { ok: true; meta?: ApiMeta; id: number; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiStoreTurma(payload: StoreTurmaPayload): Promise<StoreTurmaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/turmas/store.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const data = await parseJsonBody<StoreTurmaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type DeleteTurmaResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiDeleteTurma(turmaId: number): Promise<DeleteTurmaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/turmas/delete.php`;
  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ turma_id: turmaId }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<DeleteTurmaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type HistoricoUsuarioResponse =
  | {
      ok: true;
      meta?: ApiMeta;
      usuario: { id: number; nome_real: string; turma_label: string | null };
      stats: {
        presencas: number;
        ausencias: number;
        registos: number;
        pontos: number;
        aproveitamento_pct: number;
      };
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiHistoricoUsuario(usuarioId: number): Promise<HistoricoUsuarioResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/usuarios/historico.php?usuario_id=${encodeURIComponent(String(usuarioId))}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<HistoricoUsuarioResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type AniversarianteRow = {
  id: number;
  nome_real: string;
  data_nascimento: string;
  dia: number;
};

export type AniversariantesResponse =
  | { ok: true; mes: number; aniversariantes: AniversarianteRow[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type EscalaAulaRow = {
  id: number;
  turma_id: number;
  data_aula: string;
  numero_licao?: number | null;
  professor_usuario_id: number | null;
  professor_visitante_nome: string | null;
  tema_licao: string | null;
  professor_nome: string | null;
  relatorio_id?: number | null;
  relatorio_status?: string | null;
  presentes?: number;
  ausentes?: number;
  chamadas_registadas?: number;
  media_pct?: number | null;
};

export type ListEscalaResponse =
  | { ok: true; turma_id: number; escala: EscalaAulaRow[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiListEscala(turmaId: number): Promise<ListEscalaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/escala/list.php?turma_id=${encodeURIComponent(String(turmaId))}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<ListEscalaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type StoreEscalaPayload = {
  turma_id: number;
  data_aula: string;
  numero_licao?: number | null;
  professor_usuario_id?: number | null;
  professor_visitante_nome?: string | null;
  tema_licao?: string | null;
};

export type StoreEscalaResponse =
  | { ok: true; meta?: ApiMeta; id: number | null; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type StoreRelatorioPayload = {
  turma_id: number;
  data_aula: string;
  tema_licao?: string | null;
  professor_usuario_id?: number | null;
  total_biblias?: number;
  total_revistas?: number;
  total_visitantes?: number;
  valor_oferta?: number;
  observacoes?: string | null;
  status?: 'rascunho' | 'enviado';
};

export type StoreRelatorioResponse =
  | { ok: true; meta?: ApiMeta; id: number | null; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export type RelatorioDetalhe = {
  id: number;
  turma_id: number;
  professor_usuario_id: number | null;
  data_aula: string;
  tema_licao: string | null;
  total_biblias: number;
  total_revistas: number;
  total_visitantes: number;
  valor_oferta: number;
  observacoes: string | null;
  status: string;
  /** Registos de frequência guardados (chamada feita). */
  chamadas_registadas?: number;
};

export type GetRelatorioResponse =
  | { ok: true; relatorio: RelatorioDetalhe | null }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetRelatorio(
  turmaId: number,
  dataAula: string,
): Promise<GetRelatorioResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/relatorios/get.php?turma_id=${encodeURIComponent(String(turmaId))}&data_aula=${encodeURIComponent(dataAula)}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<GetRelatorioResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiStoreRelatorio(payload: StoreRelatorioPayload): Promise<StoreRelatorioResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/relatorios/store.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const data = await parseJsonBody<StoreRelatorioResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type FrequenciaAlunoLinha = {
  id: number;
  nome_real: string;
  presenca: boolean;
  biblia: boolean;
  revista: boolean;
  pontuacao_total: number;
};

export type GetFrequenciaResponse =
  | {
      ok: true;
      meta?: ApiMeta;
      turma_id: number;
      data_aula: string;
      relatorio_id: number | null;
      linhas: FrequenciaAlunoLinha[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetFrequencia(turmaId: number, dataAula: string): Promise<GetFrequenciaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/frequencia/get.php?turma_id=${encodeURIComponent(String(turmaId))}&data_aula=${encodeURIComponent(dataAula)}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<GetFrequenciaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type TurmaAlunosChamadaResponse =
  | {
      ok: true;
      turma_id: number;
      linhas: FrequenciaAlunoLinha[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

function normalizeFrequenciaLinhas(linhas: FrequenciaAlunoLinha[]): FrequenciaAlunoLinha[] {
  return linhas.map((l) => ({
    ...l,
    id: Number(l.id),
    presenca: Boolean(l.presenca),
    biblia: Boolean(l.biblia),
    revista: Boolean(l.revista),
    pontuacao_total: Number(l.pontuacao_total ?? 0),
  }));
}

/** Alunos matriculados na turma (vínculo ativo) — lista base da chamada. */
export async function apiGetTurmaAlunosChamada(turmaId: number): Promise<TurmaAlunosChamadaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/turmas/alunos-chamada.php?turma_id=${encodeURIComponent(String(turmaId))}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<TurmaAlunosChamadaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    if (data.ok && Array.isArray(data.linhas)) {
      return { ...data, linhas: normalizeFrequenciaLinhas(data.linhas) };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

/** Carrega alunos da turma para chamada (frequência do dia + fallbacks). */
export async function apiLoadChamadaLinhas(
  turmaId: number,
  dataAula: string,
  congregacaoId?: number | null,
): Promise<{ linhas: FrequenciaAlunoLinha[]; error: string | null }> {
  let linhas: FrequenciaAlunoLinha[] = [];
  let lastError: string | null = null;

  try {
    const freq = await apiGetFrequencia(turmaId, dataAula);
    if (freq.ok && Array.isArray(freq.linhas) && freq.linhas.length > 0) {
      return { linhas: normalizeFrequenciaLinhas(freq.linhas), error: null };
    }
    if (!freq.ok) {
      lastError = freq.error ?? 'Não foi possível carregar a chamada.';
    } else {
      linhas = normalizeFrequenciaLinhas(freq.linhas ?? []);
    }
  } catch {
    lastError = 'Sem ligação ao servidor.';
  }

  if (linhas.length === 0) {
    try {
      const base = await apiGetTurmaAlunosChamada(turmaId);
      if (base.ok && base.linhas.length > 0) {
        return { linhas: base.linhas, error: null };
      }
      if (!base.ok && !lastError) {
        lastError = base.error ?? lastError;
      }
    } catch {
      if (!lastError) {
        lastError = 'Sem ligação ao servidor.';
      }
    }
  }

  if (linhas.length === 0 && congregacaoId != null && congregacaoId > 0) {
    try {
      const ur = await apiListUsuarios({ congregacaoId, limit: 500 });
      if (ur.ok) {
        const fromList = ur.usuarios
          .filter((u) => Number(u.turma_id) === turmaId)
          .map((u) => ({
            id: u.id,
            nome_real: u.nome_real,
            presenca: false,
            biblia: false,
            revista: false,
            pontuacao_total: 0,
          }));
        if (fromList.length > 0) {
          return { linhas: fromList, error: null };
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { linhas, error: linhas.length === 0 ? lastError : null };
}

export type TurmaResumoRankingLinha = {
  usuario_id: number;
  nome_real: string;
  valor: number;
  rank: number;
};

export type TurmaResumoIntervaloResponse =
  | {
      ok: true;
      turma_id: number;
      alunos_count: number;
      total_aulas: number;
      media_intervalo_pct: number;
      ranking_frequencia: TurmaResumoRankingLinha[];
      ranking_pontuacao: TurmaResumoRankingLinha[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetTurmaResumoIntervalo(
  turmaId: number,
  dateFrom: string,
  dateTo: string,
): Promise<TurmaResumoIntervaloResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({
    turma_id: String(turmaId),
    date_from: dateFrom,
    date_to: dateTo,
  });
  const url = `${base}/api/turmas/resumo-intervalo.php?${params}`;
  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<TurmaResumoIntervaloResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type GeralResumoRankingLinha = TurmaResumoRankingLinha;

export type GeralResumoTurmaLinha = {
  turma_id: number;
  nome_turma: string;
  valor: number;
  rank: number;
  alunos_count: number;
  total_aulas: number;
};

export type GeralResumoIndicadores = {
  matriculados: number;
  presentes: number;
  ausentes: number;
  visitantes: number;
  total: number;
  presenca_pct: number;
  biblias: number;
  revistas: number;
  oferta: number;
  total_aulas: number;
  relatorios_enviados: number;
  relatorios_total: number;
  turmas_total: number;
  todas_turmas_enviadas: boolean;
  tem_dados: boolean;
};

export type GeralResumoVencedorDepartamento = {
  departamento_nome: string;
  turma_id: number;
  nome_turma: string;
  presenca_pct: number;
  oferta: number;
  fechado: boolean;
};

export type GeralResumoResponse =
  | {
      ok: true;
      congregacao_id: number;
      date_from: string;
      date_to: string;
      papel: string;
      indicadores: GeralResumoIndicadores;
      vencedores_departamento: GeralResumoVencedorDepartamento[];
      ranking_turmas: GeralResumoTurmaLinha[];
      ranking_frequencia: GeralResumoRankingLinha[];
      ranking_pontuacao: GeralResumoRankingLinha[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetGeralResumo(options: {
  congregacaoId: number;
  dateFrom: string;
  dateTo: string;
  papel?: 'todos' | 'alunos' | 'professores';
}): Promise<GeralResumoResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({
    congregacao_id: String(options.congregacaoId),
    date_from: options.dateFrom,
    date_to: options.dateTo,
    papel: options.papel ?? 'todos',
  });
  const url = `${base}/api/relatorios/geral-resumo.php?${params}`;
  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<GeralResumoResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type AulaResumoTurmaLinha = {
  turma_id: number;
  nome_turma: string;
  numero_licao: number | null;
  matriculados: number;
  presentes: number;
  ausentes: number;
  visitantes: number;
  total: number;
  presenca_pct: number;
  biblias: number;
  revistas: number;
  oferta: number;
  chamada_feita: boolean;
  relatorio_status: string | null;
};

export type AulaResumoBarra = { label: string; pct?: number; valor?: number };

export type AulaResumoResponse =
  | {
      ok: true;
      congregacao_id: number;
      data_aula: string;
      numero_licao: number | null;
      finalizada: boolean;
      geral: {
        matriculados: number;
        presentes: number;
        ausentes: number;
        visitantes: number;
        total: number;
        presenca_pct: number;
        biblias: number;
        revistas: number;
        oferta: number;
        aproveitamento: AulaResumoBarra[];
        oferta_por_turma: AulaResumoBarra[];
      };
      professores: {
        matriculados: number;
        presentes: number;
        ausentes: number;
        presenca_pct: number;
      };
      turmas: AulaResumoTurmaLinha[];
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetAulaResumo(
  dataAula: string,
  congregacaoId: number,
): Promise<AulaResumoResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({
    data_aula: dataAula,
    congregacao_id: String(congregacaoId),
  });
  const url = `${base}/api/relatorios/aula-resumo.php?${params}`;
  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<AulaResumoResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type SmtpConfigView = {
  host: string;
  port: number;
  secure: string;
  user: string;
  from_email: string;
  from_name: string;
  password_reset_link_base: string;
  has_password: boolean;
  source: 'database' | 'env' | 'none';
  configured: boolean;
};

export type GetSmtpConfigResponse =
  | { ok: true; smtp: SmtpConfigView }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetSmtpConfig(congregacaoId: number): Promise<GetSmtpConfigResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ congregacao_id: String(congregacaoId) });
  try {
    const res = await authFetch(
      `${base}/api/congregacao/smtp-get.php?${params}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<GetSmtpConfigResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateSmtpConfigPayload = {
  congregacao_id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass?: string;
  smtp_from_email: string;
  smtp_from_name: string;
  password_reset_link_base?: string;
  test_email?: string;
};

export type UpdateSmtpConfigResponse =
  | { ok: true; message?: string; configured?: boolean }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateSmtpConfig(payload: UpdateSmtpConfigPayload): Promise<UpdateSmtpConfigResponse> {
  const base = getApiBaseUrl();
  try {
    const res = await authFetch(
      `${base}/api/congregacao/smtp-update.php`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<UpdateSmtpConfigResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type StoreFrequenciaLinhaPayload = {
  usuario_id: number;
  presenca?: boolean;
  biblia?: boolean;
  revista?: boolean;
  pontuacao_total?: number;
};

export type StoreFrequenciaPayload = {
  turma_id: number;
  data_aula: string;
  linhas: StoreFrequenciaLinhaPayload[];
};

export type StoreFrequenciaResponse =
  | { ok: true; meta?: ApiMeta; relatorio_id?: number; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiStoreFrequencia(payload: StoreFrequenciaPayload): Promise<StoreFrequenciaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/frequencia/store.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<StoreFrequenciaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type ProfessorChamadaLinha = {
  id: number;
  nome_real: string;
  turma_id: number;
  turma_nome: string;
  presenca: boolean;
  ministrando?: boolean;
};

export type GetProfessoresChamadaResponse =
  | { ok: true; meta?: ApiMeta; data_aula: string; linhas: ProfessorChamadaLinha[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiLoadProfessoresChamadaLinhas(
  dataAula: string,
  congregacaoId: number,
  turmas: TurmaListItem[],
): Promise<ProfessorChamadaLinha[]> {
  const nomePorTurma = new Map(turmas.map((t) => [t.id, t.nome_turma]));

  const escalaPorTurma = new Map<number, number | null>();
  await Promise.all(
    turmas.map(async (t) => {
      try {
        const es = await apiListEscala(t.id);
        if (es.ok) {
          const linha = es.escala.find((e) => e.data_aula === dataAula);
          escalaPorTurma.set(t.id, linha?.professor_usuario_id ?? null);
        }
      } catch {
        /* ignore */
      }
    }),
  );

  const mapLinha = (
    id: number,
    nome: string,
    turmaId: number,
    turmaNome: string,
    presencaSalva?: boolean,
  ): ProfessorChamadaLinha => {
    const escalaPid = escalaPorTurma.get(turmaId) ?? null;
    const ministrando = escalaPid === id;
    const presenca = presencaSalva ?? ministrando;
    return {
      id,
      nome_real: nome,
      turma_id: turmaId,
      turma_nome: turmaNome || nomePorTurma.get(turmaId) || 'Turma',
      presenca,
      ministrando,
    };
  };

  try {
    const prof = await apiGetProfessoresChamada(dataAula, congregacaoId);
    if (prof.ok && prof.linhas.length > 0) {
      return prof.linhas.map((p) =>
        mapLinha(p.id, p.nome_real, p.turma_id, p.turma_nome, p.presenca),
      );
    }
  } catch {
    /* fallback abaixo */
  }

  const ur = await apiListUsuarios({ congregacaoId, limit: 500 });
  if (!ur.ok) {
    return [];
  }

  const out: ProfessorChamadaLinha[] = [];
  for (const u of ur.usuarios) {
    if (String(u.nivel_acesso ?? '').toLowerCase() !== 'professor') {
      continue;
    }
    const tid = u.turma_id != null && u.turma_id > 0 ? u.turma_id : null;
    if (tid == null) {
      continue;
    }
    out.push(mapLinha(u.id, u.nome_real, tid, u.turma_label ?? ''));
  }

  return out;
}

export async function apiGetProfessoresChamada(
  dataAula: string,
  scopeCongregacaoId?: number | null,
): Promise<GetProfessoresChamadaResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ data_aula: dataAula });
  if (scopeCongregacaoId != null && scopeCongregacaoId > 0) {
    params.set('congregacao_id', String(scopeCongregacaoId));
  }
  const url = `${base}/api/frequencia/professores-chamada.php?${params.toString()}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<GetProfessoresChamadaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type StoreProfessoresChamadaPayload = {
  data_aula: string;
  linhas: Array<{ usuario_id: number; turma_id: number; presenca: boolean }>;
};

export type StoreProfessoresChamadaResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiStoreProfessoresChamada(
  payload: StoreProfessoresChamadaPayload,
): Promise<StoreProfessoresChamadaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/frequencia/professores-chamada.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<StoreProfessoresChamadaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiStoreEscala(payload: StoreEscalaPayload): Promise<StoreEscalaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/escala/store.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const data = await parseJsonBody<StoreEscalaResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida do servidor', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateEscalaAulaPayload = {
  turma_id: number;
  data_aula_anterior: string;
  data_aula: string;
  numero_licao: number | null;
};

export type MutateEscalaAulaResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateEscalaAula(
  payload: UpdateEscalaAulaPayload,
): Promise<MutateEscalaAulaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/escala/update.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<MutateEscalaAulaResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiDeleteEscalaAula(
  turmaId: number,
  dataAula: string,
): Promise<MutateEscalaAulaResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/escala/delete.php`;

  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma_id: turmaId, data_aula: dataAula }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<MutateEscalaAulaResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiAniversariantes(
  mes: number,
  congregacaoId?: number | null,
): Promise<AniversariantesResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  params.set('mes', String(mes));
  if (congregacaoId != null && congregacaoId > 0) {
    params.set('congregacao_id', String(congregacaoId));
  }
  const url = `${base}/api/usuarios/aniversariantes.php?${params.toString()}`;

  try {
    const res = await authFetch(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<AniversariantesResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

/**
 * Revoga o token atual no servidor (POST `/api/auth/logout.php`).
 * Ignora erros de rede; o cliente deve sempre apagar o token localmente depois.
 */
export type AdministradorListItem = {
  id: number;
  nome_real: string;
  login_usuario: string | null;
};

export type ListAdministradoresResponse =
  | { ok: true; administradores: AdministradorListItem[] }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiListAdministradores(options?: {
  congregacaoId?: number | null;
}): Promise<ListAdministradoresResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options?.congregacaoId != null && options.congregacaoId > 0) {
    params.set('congregacao_id', String(options.congregacaoId));
  }
  const qs = params.toString();
  const url = `${base}/api/administradores/list.php${qs ? `?${qs}` : ''}`;
  try {
    const res = await authFetch(url, { method: 'GET', headers: { Accept: 'application/json' } }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<ListAdministradoresResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type InviteCoAdminPayload = {
  nome_real: string;
  sexo: 'M' | 'F';
  login_usuario: string;
  senha: string;
  congregacao_id?: number | null;
};

export type InviteCoAdminResponse =
  | {
      ok: true;
      meta?: ApiMeta;
      id: number;
      nome_real: string;
      login_usuario: string;
      message?: string;
    }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiInviteCoAdmin(
  payload: InviteCoAdminPayload,
  scopeCongregacaoId?: number | null,
): Promise<InviteCoAdminResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/administradores/invite.php`;
  try {
    const res = await authFetch(
      url,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          congregacao_id: payload.congregacao_id ?? scopeCongregacaoId ?? null,
        }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<InviteCoAdminResponse>(res);
    return data ?? { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export async function apiLogout(): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) {
    return;
  }
  const token = await getAuthToken();
  if (!token) {
    return;
  }
  try {
    await authFetch(
      `${base}/api/auth/logout.php`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
      DEFAULT_TIMEOUT_MS,
    );
  } catch {
    /* ignorar */
  }
}

export type ContaProfile = {
  id: number;
  nome_real: string;
  login_usuario: string;
  email: string | null;
};

export type SessionUser = {
  id: number;
  nome_real: string;
  login_usuario: string;
  email: string | null;
  nivel_acesso: string;
  congregacao_id: number | null;
  congregacao_nome?: string | null;
  congregacao_subtitulo?: string | null;
  congregacao_bairro?: string | null;
};

export type GetContaProfileResponse =
  | { ok: true; meta?: ApiMeta; profile: ContaProfile; session?: SessionUser }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiGetContaProfile(): Promise<GetContaProfileResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/conta/get.php`;
  try {
    const res = await authFetch(url, { method: 'GET' }, DEFAULT_TIMEOUT_MS);
    const data = await parseJsonBody<GetContaProfileResponse>(res);
    if (data === null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateContaNomeResponse =
  | { ok: true; meta?: ApiMeta; message?: string; nome_real?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateContaNome(nomeReal: string): Promise<UpdateContaNomeResponse> {
  const base = getApiBaseUrl();
  try {
    const res = await authFetch(
      `${base}/api/conta/update-nome.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_real: nomeReal.trim() }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<UpdateContaNomeResponse>(res);
    if (data == null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateContaLoginResponse =
  | { ok: true; meta?: ApiMeta; message?: string; login_usuario?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateContaLogin(loginUsuario: string): Promise<UpdateContaLoginResponse> {
  const base = getApiBaseUrl();
  try {
    const res = await authFetch(
      `${base}/api/conta/update-login.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_usuario: loginUsuario.trim().toLowerCase() }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<UpdateContaLoginResponse>(res);
    if (data == null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type UpdateContaPasswordResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiUpdateContaPassword(
  senhaAtual: string,
  senhaNova: string,
): Promise<UpdateContaPasswordResponse> {
  const base = getApiBaseUrl();
  try {
    const res = await authFetch(
      `${base}/api/conta/update-password.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<UpdateContaPasswordResponse>(res);
    if (data == null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

export type DeleteContaResponse =
  | { ok: true; meta?: ApiMeta; message?: string }
  | { ok: false; error?: string; code?: ApiErrorCode };

export async function apiDeleteConta(senha: string): Promise<DeleteContaResponse> {
  const base = getApiBaseUrl();
  try {
    const res = await authFetch(
      `${base}/api/conta/delete.php`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      },
      DEFAULT_TIMEOUT_MS,
    );
    const data = await parseJsonBody<DeleteContaResponse>(res);
    if (data == null) {
      return { ok: false, error: 'Resposta inválida', code: 'STORE_FAILED' };
    }
    return data;
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}
