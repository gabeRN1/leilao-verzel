<div align="center">

  <img src="../assets/logo.png" alt="logo" width="200" height="auto" />
  <h1>Leilão · Front-end</h1>

  <p>
    Interface do leilão: vitrine, sala ao vivo, carteira, painel do leiloeiro, comprovante e auditoria pública.
  </p>




<br />

<!-- Table of Contents -->
# Índice

- [Sobre o projeto](#sobre-o-projeto)
  * [Capturas de tela](#capturas-de-tela)
  * [Tecnologias](#tecnologias)
  * [Funcionalidades](#funcionalidades)
  * [Estrutura](#estrutura)
  * [Variáveis de ambiente](#variáveis-de-ambiente)
- [Primeiros passos](#primeiros-passos)
  * [Pré-requisitos](#pré-requisitos)
  * [Instalação](#instalação)
  * [Executando os testes](#executando-os-testes)
- [Uso](#uso)
  * [Rotas](#rotas)
  * [Como funciona](#como-funciona)
- [Decisões de interface](#decisões-de-interface)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
- [FAQ](#faq)
- [Licença](#licença)
- [Contato](#contato)
- [Agradecimentos](#agradecimentos)

<!-- About the Project -->
## Sobre o projeto

Front-end do leilão em Next.js: vitrine pública, sala ao vivo com lances em tempo real, carteira do licitante, painel do leiloeiro, comprovante anonimizado e página pública de auditoria da cadeia de lances.

<!-- Screenshots -->
### Capturas de tela

<div align="center">
  <img src="https://placehold.co/600x400?text=Sua+captura+de+tela+aqui" alt="screenshot" />
</div>

<!-- TechStack -->
### Tecnologias

<details>
  <summary>Cliente</summary>
  <ul>
    <li><a href="https://nextjs.org/">Next.js (App Router)</a></li>
    <li><a href="https://reactjs.org/">React</a></li>
    <li><a href="https://tailwindcss.com/">Tailwind CSS 4</a></li>
    <li><a href="https://socket.io/docs/v4/client-api/">socket.io-client</a></li>
  </ul>
</details>

<details>
  <summary>Fontes</summary>
  <ul>
    <li>Newsreader e IBM Plex Sans, via <code>next/font/google</code>, que baixa os arquivos no desenvolvimento e no build</li>
  </ul>
</details>

Sem biblioteca de componentes e sem biblioteca de ícones.

<!-- Features -->
### Funcionalidades

- Vitrine com filtro por status
- Sala ao vivo: valor, contador, lance e histórico atualizados por Socket.io
- Badge "Ganhando" ou "Superado" sem recarregar a página
- Contador sincronizado com o relógio do servidor, com aviso de anti-sniping
- Carteira com saldos e depósito simulado
- Painel do leiloeiro: lotes, cancelamento, resultados e criação de lote a partir de obra
- Comprovante anonimizado e auditoria pública (selo Íntegro ou Adulterado)

<!-- Estrutura -->
### Estrutura

```
app/              páginas e layout
components/       cabecalho e estado (só o que tem reuso)
lib/
├── api.ts        cliente HTTP e relógio sincronizado com o servidor
├── sessao.tsx    contexto de sessão e guarda de rotas por papel
├── format.ts     moeda, datas, duração e conversão de valores
└── tipos.ts      tipos das respostas da API
```

<!-- Env Variables -->
### Variáveis de ambiente

Para rodar o projeto, adicione a seguinte variável ao seu arquivo `.env.local`:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | Endereço da API. Padrão: `http://localhost:3001` |

O Next só lê o `.env.local` na inicialização. Depois de mudar, reinicie o `npm run dev`.

<!-- Getting Started -->
## Primeiros passos

<!-- Prerequisites -->
### Pré-requisitos

- Node.js LTS recente
- Back-end no ar em `http://localhost:3001` (veja o [README do back-end](../backend/README.md))

<!-- Installation -->
### Instalação

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

As páginas renderizadas no servidor chamam a API a cada carregamento. Com o back-end parado, elas mostram a tela de erro.

<!-- Running Tests -->
### Executando os testes

Não há testes automatizados no front. A validação manual é:

1. Com o seed aplicado, abrir a sala do lote em dois navegadores, entrando como `ana@exemplo.com` e `bruno@exemplo.com` (senha `senha1234`).
2. Dar lances alternados e conferir os badges trocando sem recarregar e o histórico crescendo nas duas telas.
3. Em **Carteira**, conferir o saldo comprometido mudando a cada troca de liderança.
4. Dar um lance nos últimos 2 minutos e conferir o contador e o novo fim.
5. Depois do fim, abrir **Meus arremates**, o comprovante e a auditoria (sem login).

<!-- Usage -->
## Uso

<!-- Rotas -->
### Rotas

| Rota | Acesso | Renderização | Descrição |
|---|---|---|---|
| `/` | público | servidor | Vitrine com filtro por status (`?status=`) |
| `/lotes/[id]` | público | cliente | Sala ao vivo: valor, contador, lance, histórico |
| `/entrar` | público | cliente | Login e cadastro |
| `/carteira` | autenticado | cliente | Saldos e depósito simulado (depósito só para licitante) |
| `/arremates` | licitante | cliente | Meus arremates, com link do comprovante |
| `/painel` | leiloeiro | cliente | Lotes, cancelamento e resultados das vendas |
| `/painel/novo` | leiloeiro | cliente | Busca de obra e criação do lote |
| `/comprovante/[id]` | público | servidor | Comprovante anonimizado |
| `/auditoria/[loteId]` | público | servidor | Selo Íntegro ou Adulterado e a cadeia de lances |

<!-- Como funciona -->
### Como funciona

**Sessão.** Token e usuário ficam no `localStorage`. O hook `useExigir(papel?)` redireciona quem não tem sessão ou papel, e só libera a página quando o acesso é permitido. Uma resposta 401 encerra a sessão local.

**Tempo real.** A sala abre uma conexão Socket.io (com o token, se houver), entra na sala do lote e atualiza valor, histórico, fim e badge a cada evento. Ao reconectar, relê o estado pela API, porque os eventos perdidos na queda não voltam.

**Badge Ganhando ou Superado.** O estado inicial vem de `GET /lotes/:id/lances/situacao`, que diferencia "superado" de "nunca dei lance". Depois disso, os eventos `ganhando` e `superado` mantêm o badge sem recarregar.

**Contador.** Usa o cabeçalho `Date` das respostas da API para calcular o desvio entre o relógio do navegador e o do servidor. Entre 2 minutos e zero, o contador muda de cor e avisa que um lance estende o fim. O servidor é quem decide: um lance fora do prazo volta 409, mesmo que o contador ainda mostre segundos.

**Valores.** O servidor trabalha em centavos. Os campos aceitam `1.250,50` e `1250,5`, e a conversão acontece na borda em `lib/format.ts`.

<!-- Decisões de interface -->
## Decisões de interface

- Sem gradientes, sombras, cantos arredondados nem cards. A estrutura vem de linhas finas, tabelas e listas densas.
- Paleta fechada: neutros quentes, um azul de acento e três cores só para estado (`ok`, `alerta`, `erro`). Os tokens ficam em `app/globals.css`.
- Numerais tabulares no corpo inteiro, por se tratar de valores e contagens.
- Classes reutilizadas definidas no `globals.css`: `.campo`, `.btn`, `.btn-cheio`, `.rotulo`, `.tabela`.
- Componentes só quando há reuso real. O restante fica inline na página.

<!-- Roadmap -->
## Roadmap

- [x] Sala ao vivo com Socket.io e reconexão
- [x] Contador sincronizado com o servidor
- [ ] Token em cookie `HttpOnly` em vez de `localStorage`
- [ ] Estilo de impressão para `/comprovante/[id]`
- [ ] Servir as imagens das obras sem depender de `nrs.harvard.edu` no navegador
- [ ] Testes automatizados

Limites conhecidos:

- O token no `localStorage` é exposto a XSS. Em produção, o correto é cookie `HttpOnly`.
- A precisão do desvio de relógio é de cerca de 1 s, limite do cabeçalho `Date`.
- As imagens são carregadas direto de `nrs.harvard.edu` pelo navegador.
- A rota `/comprovante/[id]` não tem estilo de impressão dedicado.

<!-- Contributing -->
## Contribuindo

Contribuições são sempre bem-vindas!

Veja `contributing.md` para saber como começar e leia o [Código de Conduta](https://github.com/SEU_USUARIO/leilao/blob/master/CODE_OF_CONDUCT.md).

<!-- FAQ -->
## FAQ

- Por que a vitrine mostra tela de erro?

  + As páginas renderizadas no servidor consultam a API a cada carregamento. Suba o back-end e recarregue.

- Mudei o `.env.local` e nada aconteceu.

  + O Next só lê o arquivo na inicialização. Reinicie o `npm run dev`.

- O contador mostra segundos, mas meu lance voltou 409.

  + O servidor decide o prazo. O contador tem precisão de cerca de 1 s por usar o cabeçalho `Date`.

<!-- License -->
## Licença

Distribuído sob a licença INDICAR_LICENÇA. Veja `LICENSE.txt` para mais informações.

<!-- Contact -->
## Contato

Seu Nome - [@seu_usuario](https://twitter.com/seu_usuario) - email@exemplo.com

Link do projeto: [https://github.com/SEU_USUARIO/leilao](https://github.com/SEU_USUARIO/leilao)

<!-- Acknowledgments -->
## Agradecimentos

- [Harvard Art Museums API](https://harvardartmuseums.org/collections/api)
- [Shields.io](https://shields.io/)
- [Awesome README](https://github.com/matiassingers/awesome-readme)
- [Awesome README Template](https://github.com/Louis3797/awesome-readme-template)
