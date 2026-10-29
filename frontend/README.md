# Leilão · Front-end

Interface do leilão: vitrine, sala ao vivo, carteira, painel do leiloeiro, comprovante e auditoria pública.

Em produção: <URL DA VERCEL>. O back-end fica em plano gratuito e dorme após inatividade, então a primeira carga pode mostrar a tela de erro. Abra `https://leilao-verzel-96i4.onrender.com/lotes`, espere responder e recarregue.

## Índice

- [Capturas de tela](#capturas-de-tela)
- [Tecnologias](#tecnologias)
- [Funcionalidades](#funcionalidades)
- [Estrutura](#estrutura)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Instalação](#instalação)
- [Testes](#testes)
- [Deploy](#deploy)
- [Rotas](#rotas)
- [Como funciona](#como-funciona)
- [Decisões de interface](#decisões-de-interface)
- [Limites conhecidos](#limites-conhecidos)
- [FAQ](#faq)

## Capturas de tela

**Vitrine**: busca por título, artista ou cultura, filtro por estado e por categoria.

![Vitrine](../docs/prints/vitrine.jpeg)

**Sala ao vivo, visão do leiloeiro**

![Sala ao vivo](../docs/prints/sala.jpeg)

**Sala ao vivo, visão do licitante líder**: "Você está ganhando" sem recarregar a página.

![Sala do licitante](../docs/prints/sala-dois-licitantes.jpeg)

**Carteira**

![Carteira](../docs/prints/carteira.jpeg)

**Painel do leiloeiro, novo lote**

![Novo lote](../docs/prints/painel-novo-lote.jpeg)

**Auditoria pública**

![Auditoria](../docs/prints/auditoria-integro.jpeg)

## Tecnologias

- Next.js (App Router) e React
- Tailwind CSS 4
- socket.io-client
- lucide-react, para poucos ícones (tema, copiar, confirmação)
- Newsreader e IBM Plex Sans, via `next/font/google`, que baixa os arquivos no desenvolvimento e no build

Sem biblioteca de componentes.

## Funcionalidades

- Vitrine com busca (título, artista, classificação e cultura, sem diferenciar acento), filtro por estado e por categoria
- Sala ao vivo: valor, contador, lance e histórico atualizados por Socket.io
- Aviso "Ganhando" ou "Superado" sem recarregar a página, anunciado a leitores de tela por região `aria-live`
- Contador sincronizado com o relógio do servidor, com aviso de anti-sniping
- Carteira com saldos e depósito simulado
- Painel do leiloeiro: lotes, cancelamento, resultados e criação de lote a partir de obra
- Comprovante anonimizado e auditoria pública (selo Íntegro ou Adulterado), com cópia dos hashes e impressão
- Tema claro e escuro
- Estados de carregamento, erro e página não encontrada

## Estrutura

```
app/              páginas, layout, loading, error e not-found
components/
├── cabecalho.tsx navegação, sessão e alternância de tema
├── estado.tsx    rótulo de estado do lote e categoria
├── hash.tsx      hash curto com botão de copiar; inteiro na impressão
└── imprimir.tsx  botão de impressão (comprovante e auditoria)
lib/
├── api.ts        cliente HTTP e relógio sincronizado com o servidor
├── sessao.tsx    contexto de sessão e guarda de rotas por papel
├── format.ts     moeda, datas, duração e conversão de valores
└── tipos.ts      tipos das respostas da API
```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | Endereço da API. Padrão: `http://localhost:3001` |

`NEXT_PUBLIC_API_URL` é gravada no JavaScript durante o build. Mudar o valor exige novo build (ou redeploy na Vercel). Em desenvolvimento, o Next lê o `.env.local` só na inicialização.

## Instalação

Pré-requisitos: Node.js LTS recente e o back-end no ar em `http://localhost:3001` (veja o [README do back-end](../backend/README.md)).

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

As páginas renderizadas no servidor chamam a API a cada carregamento. Com o back-end parado, elas mostram a tela de erro.

## Testes

Não há testes automatizados no front. A validação manual é:

1. Com o seed aplicado, abrir a sala do lote em dois navegadores, entrando como `ana@exemplo.com` e `bruno@exemplo.com` (senha `senha1234`).
2. Dar lances alternados e conferir os avisos trocando sem recarregar e o histórico crescendo nas duas telas.
3. Em **Carteira**, conferir o saldo comprometido mudando a cada troca de liderança.
4. Dar um lance nos últimos 2 minutos e conferir o contador e o novo fim.
5. Depois do fim, abrir **Meus arremates**, o comprovante e a auditoria (sem login).
6. Na vitrine, testar a busca por artista, o filtro de estado e o de categoria.
7. Imprimir o comprovante e conferir que o hash aparece inteiro, em grupos.

## Deploy

| Campo (Vercel) | Valor |
|---|---|
| Root Directory | `frontend` |
| `NEXT_PUBLIC_API_URL` | `https://leilao-verzel-96i4.onrender.com` (sem barra final) |

Depois de salvar a variável, faça **redeploy**. No back-end (Render), `FRONTEND_URL` precisa ser a URL exata desta aplicação, senão o navegador bloqueia as chamadas e o WebSocket por CORS.

## Rotas

| Rota | Acesso | Renderização | Descrição |
|---|---|---|---|
| `/` | público | servidor | Vitrine: busca, estado (`?status=`) e categoria |
| `/lotes/[id]` | público | cliente | Sala ao vivo: valor, contador, lance, histórico |
| `/entrar` | público | cliente | Login e cadastro |
| `/carteira` | autenticado | cliente | Saldos e depósito simulado (depósito só para licitante) |
| `/arremates` | licitante | cliente | Meus arremates, com link do comprovante |
| `/painel` | leiloeiro | cliente | Lotes, cancelamento e resultados das vendas |
| `/painel/novo` | leiloeiro | cliente | Busca de obra e criação do lote |
| `/comprovante/[id]` | público | servidor | Comprovante anonimizado |
| `/auditoria/[loteId]` | público | servidor | Selo Íntegro ou Adulterado e a cadeia de lances |

## Como funciona

**Sessão.** Token e usuário ficam no `localStorage`. O hook `useExigir(papel?)` redireciona quem não tem sessão ou papel, e só libera a página quando o acesso é permitido. Uma resposta 401 encerra a sessão local.

**Vitrine.** A API devolve até 100 lotes por estado. A busca e o filtro de categoria são aplicados no servidor do Next sobre esse resultado, sem diferenciar acentos, e as categorias oferecidas vêm dos próprios lotes.

**Tempo real.** A sala abre uma conexão Socket.io (com o token, se houver), entra na sala do lote e atualiza valor, histórico, fim e aviso a cada evento. Ao reconectar, relê o estado pela API, porque os eventos perdidos na queda não voltam.

**Ganhando ou Superado.** O estado inicial vem de `GET /lotes/:id/lances/situacao`, que diferencia "superado" de "nunca dei lance". Depois disso, os eventos `ganhando` e `superado` mantêm o aviso sem recarregar.

**Contador.** Usa o cabeçalho `Date` das respostas da API para calcular o desvio entre o relógio do navegador e o do servidor. Nos últimos 2 minutos, o contador muda de cor e avisa que um lance estende o fim. O servidor é quem decide: um lance fora do prazo volta 409, mesmo que o contador ainda mostre segundos.

**Valores.** O servidor trabalha em centavos. Os campos aceitam `1.250,50` e `1250,5`, e a conversão acontece na borda em `lib/format.ts`.

## Decisões de interface

- Sem gradientes, sombras, cantos arredondados nem cards. A estrutura vem de linhas finas, tabelas e listas densas.
- Paleta fechada: neutros quentes, um azul-petróleo de acento e poucas cores de estado. Os tokens ficam em `app/globals.css`, com variação para o tema escuro.
- Numerais tabulares no corpo inteiro, por se tratar de valores e contagens.
- Ícones só onde substituem texto ou confirmam uma ação (tema, copiar hash).
- Acessibilidade: foco visível, rótulos associados e região `aria-live` para novos lances e encerramento.
- Impressão: o `@media print` do comprovante e da auditoria esconde os controles e mostra o hash inteiro, em grupos de 8 caracteres.
- Classes reutilizadas definidas no `globals.css`: `.campo`, `.btn`, `.btn-cheio`, `.rotulo`, `.tabela`.
- Componentes só quando há reuso real. O restante fica inline na página.

## Limites conhecidos

- O token no `localStorage` é exposto a XSS. Em produção, o correto é cookie `HttpOnly`.
- A precisão do desvio de relógio é de cerca de 1 s, limite do cabeçalho `Date`.
- As imagens são carregadas direto de `nrs.harvard.edu` pelo navegador.
- A busca opera sobre os 100 lotes que a API devolve por estado.
- Com a API em plano gratuito dormindo, a primeira página renderizada no servidor pode falhar por tempo esgotado.

## FAQ

**Por que a vitrine mostra tela de erro?**
As páginas renderizadas no servidor consultam a API a cada carregamento. Em desenvolvimento, suba o back-end. Em produção, a API gratuita pode estar dormindo: abra `/lotes` na URL dela, espere responder e use "Tentar de novo".

**Mudei `NEXT_PUBLIC_API_URL` e nada aconteceu.**
A variável é gravada no build. Na Vercel, faça redeploy; em desenvolvimento, reinicie o `npm run dev`.

**Os avisos de lance não atualizam, mas a vitrine carrega.**
O WebSocket está bloqueado, quase sempre por CORS. `FRONTEND_URL` no back-end precisa ser exatamente a URL desta aplicação, sem barra final.

**O contador mostra segundos, mas meu lance voltou 409.**
O servidor decide o prazo. O contador tem precisão de cerca de 1 s por usar o cabeçalho `Date`.