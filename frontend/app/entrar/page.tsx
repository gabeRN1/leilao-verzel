'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useSessao, type Usuario } from '@/lib/sessao';

export default function Entrar() {
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { entrar } = useSessao();
  const router = useRouter();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const { token, usuario } = await api<{ token: string; usuario: Usuario }>(
        registrando ? '/auth/registro' : '/auth/login',
        { corpo: registrando ? dados : { email: dados.email, senha: dados.senha } },
      );
      entrar(token, usuario);
      router.push(usuario.papel === 'LEILOEIRO' ? '/painel' : '/');
    } catch (erro) {
      setErro((erro as Error).message);
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="mb-4 text-3xl">{registrando ? 'Criar conta' : 'Entrar'}</h1>
      <form onSubmit={enviar} className="space-y-3">
        {registrando && (
          <label className="block">
            <span className="rotulo">Nome</span>
            <input name="nome" required minLength={2} className="campo" />
          </label>
        )}
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input name="email" type="email" required className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input name="senha" type="password" required minLength={8} className="campo" />
        </label>
        {registrando && (
          <label className="block">
            <span className="rotulo">Perfil</span>
            <select name="papel" className="campo" defaultValue="LICITANTE">
              <option value="LICITANTE">Licitante (dá lances)</option>
              <option value="LEILOEIRO">Leiloeiro (cria lotes)</option>
            </select>
          </label>
        )}
        {erro && <p className="text-sm text-erro">{erro}</p>}
        <button className="btn btn-cheio w-full" disabled={enviando}>
          {registrando ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <button onClick={() => setRegistrando(!registrando)} className="mt-4 text-sm underline">
        {registrando ? 'Já tenho conta' : 'Criar conta'}
      </button>
    </div>
  );
}