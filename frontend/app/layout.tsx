import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google';
import { Cabecalho } from '@/components/cabecalho';
import { SessaoProvider } from '@/lib/sessao';
import './globals.css';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
const newsreader = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--font-newsreader' });

export const viewport: Viewport = { colorScheme: 'light dark' };

export const metadata: Metadata = { title: { default: 'Leilão', template: '%s · Leilão' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${plex.variable} ${plexMono.variable} ${newsreader.variable}`}>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, para não piscar o tema errado. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('leilao:tema');if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}",
          }}
        />
      </head>
      <body className="font-sans">
        <SessaoProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:border focus:bg-papel focus:px-3 focus:py-2"
          >
            Ir para o conteúdo
          </a>
          <Cabecalho />
          <main id="conteudo" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 focus:outline-none">
            {children}
          </main>
          <footer className="mx-auto max-w-5xl border-t border-linha px-4 py-6 text-sm text-suave print:hidden">
            Cada lance entra numa cadeia SHA-256 que pode ser conferida na auditoria do lote.
          </footer>
        </SessaoProvider>
      </body>
    </html>
  );
}