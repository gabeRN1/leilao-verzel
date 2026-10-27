'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';

export type Usuario = { id: string; nome: string; papel: 'LEILOEIRO' | 'LICITANTE' };
type Guardado = { token: string; usuario: Usuario };
type Opcoes = { corpo?: unknown; metodo?: string };

type Contexto = {
  token: string | null;
  usuario: Usuario | null;
  pronta: boolean;
  entrar: (token: string, usuario: Usuario) => void;
  sair: () => void;
  chamar: <T>(caminho: string, opcoes?: Opcoes) => Promise<T>;
};

const Ctx = createContext<Contexto | null>(null);
const CHAVE = 'leilao:sessao';

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const [pronta, setPronta] = useState(false);

  // O storage só existe no navegador. `pronta` evita redirecionar antes de saber se há sessão.
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) setGuardado(JSON.parse(bruto));
    } catch {
      localStorage.removeItem(CHAVE);
    }
    setPronta(true);
  }, []);

  const entrar = useCallback((token: string, usuario: Usuario) => {
    const novo = { token, usuario };
    localStorage.setItem(CHAVE, JSON.stringify(novo));
    setGuardado(novo);
  }, []);

  const sair = useCallback(() => {
    localStorage.removeItem(CHAVE);
    setGuardado(null);
  }, []);

  const token = guardado?.token ?? null;

  // Token expirado (401) encerra a sessão local em vez de deixar a tela quebrada.
  const chamar = useCallback(
    <T,>(caminho: string, opcoes: Opcoes = {}) =>
      api<T>(caminho, { ...opcoes, token }).catch((erro) => {
        if (erro instanceof ApiError && erro.status === 401 && token) sair();
        throw erro;
      }),
    [token, sair],
  );

  const valor = useMemo(
    () => ({ token, usuario: guardado?.usuario ?? null, pronta, entrar, sair, chamar }),
    [token, guardado, pronta, entrar, sair, chamar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao() {
  const contexto = useContext(Ctx);
  if (!contexto) throw new Error('SessaoProvider ausente');
  return contexto;
}

// Redireciona quem não tem sessão (ou papel). Devolve a sessão só quando o acesso é permitido.
export function useExigir(papel?: Usuario['papel']) {
  const sessao = useSessao();
  const router = useRouter();
  const { pronta, usuario } = sessao;

  useEffect(() => {
    if (!pronta) return;
    if (!usuario) router.replace('/entrar');
    else if (papel && usuario.papel !== papel) router.replace('/');
  }, [pronta, usuario, papel, router]);

  return usuario && (!papel || usuario.papel === papel) ? sessao : null;
}