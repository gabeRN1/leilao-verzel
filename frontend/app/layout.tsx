import type { Metadata } from 'next';
import { IBM_Plex_Sans, Newsreader } from 'next/font/google';
import { Cabecalho } from '@/components/cabecalho';
import { SessaoProvider } from '@/lib/sessao';
import './globals.css';

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' });

export const metadata: Metadata = { title: 'Leilão' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plex.variable} ${newsreader.variable}`}>
      <body className="font-sans">
        <SessaoProvider>
          <Cabecalho />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </SessaoProvider>
      </body>
    </html>
  );
}