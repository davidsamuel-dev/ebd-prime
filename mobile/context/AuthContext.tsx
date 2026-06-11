import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiGetContaProfile, apiLogout, isApiConfigured } from '@/lib/api';
import { clearAuthToken, getAuthToken } from '@/lib/auth-storage';
import { clearRelatorioGeralGate } from '@/lib/geral-report-gate';
import { getActiveDataBackend } from '@/lib/backend-config';

export type AuthContextValue = {
  userName: string;
  loginUsuario: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  userId: number | null;
  congregacaoId: number | null;
  congregacaoNome: string | null;
  congregacaoSubtitulo: string | null;
  congregacaoBairro: string | null;
  nivelAcesso: string | null;
  authMode: 'api' | 'demo';
  login: (payload: {
    userName: string;
    userId?: number | null;
    congregacaoId?: number | null;
    congregacaoNome?: string | null;
    congregacaoSubtitulo?: string | null;
    congregacaoBairro?: string | null;
    nivelAcesso?: string | null;
    loginUsuario?: string | null;
    mode?: 'api' | 'demo';
  }) => void;
  patchCongregacaoEscola: (p: {
    nome?: string | null;
    subtitulo?: string | null;
    bairro?: string | null;
  }) => void;
  patchConta: (p: { userName?: string; loginUsuario?: string | null }) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [userName, setUserName] = useState('David');
  const [loginUsuario, setLoginUsuario] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [congregacaoId, setCongregacaoId] = useState<number | null>(null);
  const [congregacaoNome, setCongregacaoNome] = useState<string | null>(null);
  const [congregacaoSubtitulo, setCongregacaoSubtitulo] = useState<string | null>(null);
  const [congregacaoBairro, setCongregacaoBairro] = useState<string | null>(null);
  const [nivelAcesso, setNivelAcesso] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'api' | 'demo'>('demo');

  const applySession = useCallback(
    (payload: {
      userName: string;
      userId?: number | null;
      congregacaoId?: number | null;
      congregacaoNome?: string | null;
      congregacaoSubtitulo?: string | null;
      congregacaoBairro?: string | null;
      nivelAcesso?: string | null;
      loginUsuario?: string | null;
      mode?: 'api' | 'demo';
    }) => {
      const name = payload.userName.trim();
      setUserName(name.length > 0 ? name : 'Usuário');
      const lu = payload.loginUsuario?.trim();
      setLoginUsuario(lu && lu.length > 0 ? lu : null);
      setUserId(payload.userId ?? null);
      setCongregacaoId(payload.congregacaoId ?? null);
      setCongregacaoNome(payload.congregacaoNome?.trim() ? payload.congregacaoNome.trim() : null);
      const st = payload.congregacaoSubtitulo?.trim();
      setCongregacaoSubtitulo(st && st.length > 0 ? st : null);
      setCongregacaoBairro(payload.congregacaoBairro?.trim() ? payload.congregacaoBairro.trim() : null);
      setNivelAcesso(payload.nivelAcesso ?? null);
      setAuthMode(payload.mode ?? 'demo');
      setAuthenticated(true);
    },
    [],
  );

  const login = useCallback(
    (payload: Parameters<AuthContextValue['login']>[0]) => {
      applySession(payload);
    },
    [applySession],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!isApiConfigured() || getActiveDataBackend() === null) {
          return;
        }
        const token = await getAuthToken();
        if (!token) {
          return;
        }
        const res = await apiGetContaProfile();
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          await clearAuthToken();
          return;
        }
        const s = res.session;
        if (s) {
          applySession({
            userName: s.nome_real,
            userId: s.id,
            congregacaoId: s.congregacao_id,
            congregacaoNome: s.congregacao_nome ?? null,
            congregacaoSubtitulo: s.congregacao_subtitulo ?? null,
            congregacaoBairro: s.congregacao_bairro ?? null,
            nivelAcesso: s.nivel_acesso,
            loginUsuario: s.login_usuario,
            mode: 'api',
          });
        }
      } catch {
        await clearAuthToken();
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const patchCongregacaoEscola = useCallback((p: { nome?: string | null; subtitulo?: string | null; bairro?: string | null }) => {
    if (p.nome !== undefined) {
      const n = p.nome?.trim();
      setCongregacaoNome(n && n.length > 0 ? n : null);
    }
    if (p.subtitulo !== undefined) {
      const s = p.subtitulo?.trim();
      setCongregacaoSubtitulo(s && s.length > 0 ? s : null);
    }
    if (p.bairro !== undefined) {
      const b = p.bairro?.trim();
      setCongregacaoBairro(b && b.length > 0 ? b : null);
    }
  }, []);

  const patchConta = useCallback((p: { userName?: string; loginUsuario?: string | null }) => {
    if (p.userName !== undefined) {
      const n = p.userName.trim();
      setUserName(n.length > 0 ? n : 'Usuário');
    }
    if (p.loginUsuario !== undefined) {
      const l = p.loginUsuario?.trim();
      setLoginUsuario(l && l.length > 0 ? l : null);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    await clearAuthToken();
    await clearRelatorioGeralGate(congregacaoId);
    setAuthenticated(false);
    setUserId(null);
    setLoginUsuario(null);
    setCongregacaoId(null);
    setCongregacaoNome(null);
    setCongregacaoSubtitulo(null);
    setCongregacaoBairro(null);
    setNivelAcesso(null);
    setAuthMode('demo');
  }, [congregacaoId]);

  const value = useMemo(
    () => ({
      userName,
      loginUsuario,
      isAuthenticated,
      isBootstrapping,
      userId,
      congregacaoId,
      congregacaoNome,
      congregacaoSubtitulo,
      congregacaoBairro,
      nivelAcesso,
      authMode,
      login,
      patchCongregacaoEscola,
      patchConta,
      logout,
    }),
    [
      userName,
      loginUsuario,
      isAuthenticated,
      isBootstrapping,
      userId,
      congregacaoId,
      congregacaoNome,
      congregacaoSubtitulo,
      congregacaoBairro,
      nivelAcesso,
      authMode,
      login,
      patchCongregacaoEscola,
      patchConta,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
