'use client';

import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSessao } from '@/lib/sessao';

export function Cabecalho() {
  const { usuario, pronta, sair } = useSessao();
  const caminho = usePathname();
  const [tema, setTema] = useState<'claro' | 'escuro' | null>(null);

  // O tema efetivo só é conhecido no navegador: dataset (escolha salva) ou preferência do sistema.
  useEffect(() => {
    const salvo = document.documentElement.dataset.tema;
    setTema(salvo === 'claro' || salvo === 'escuro' ? salvo : matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  }, []);

  function alternarTema() {
    const novo = tema === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    try { localStorage.setItem('leilao:tema', novo); } catch {}
    setTema(novo);
  }

  const extras: [string, string][] =
    usuario?.papel === 'LICITANTE'
      ? [['/carteira', 'Carteira'], ['/arremates', 'Meus arremates']]
      : usuario?.papel === 'LEILOEIRO'
        ? [['/painel', 'Painel'], ['/carteira', 'Carteira']]
        : [];
  const links: [string, string][] = [['/', 'Vitrine'], ...extras];
  const atual = (href: string) => caminho === href || (href !== '/' && caminho.startsWith(`${href}/`));

  return (
    <header className="border-t-4 border-acento border-b-[3px] border-double border-b-tinta print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 px-4">
        <Link href="/" className="alvo font-serif text-2xl italic tracking-tight">Leilão</Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-x-4 text-sm">
          {links.map(([href, texto]) => (
            <Link
              key={href}
              href={href}
              aria-current={atual(href) ? 'page' : undefined}
              className="alvo aria-[current=page]:font-medium aria-[current=page]:text-acento aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {texto}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 text-sm">
          {tema && (
            <button type="button" onClick={alternarTema} className="alvo gap-1.5">
              {tema === 'escuro' ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
              {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
            </button>
          )}
          {pronta &&
            (usuario ? (
              <>
                <span>
                  {usuario.nome} <span className="rotulo">{usuario.papel === 'LEILOEIRO' ? 'Leiloeiro' : 'Licitante'}</span>
                </span>
                <button onClick={sair} className="alvo link">Sair</button>
              </>
            ) : (
              <Link href="/entrar" className="alvo">Entrar</Link>
            ))}
        </div>
      </div>
    </header>
  );
}
