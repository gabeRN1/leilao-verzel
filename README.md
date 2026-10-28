<div align="center">

  <img src="assets/logo.png" alt="logo" width="200" height="auto" />
  <h1>Leilão</h1>

  <p>
    Casa de leilões online com lances em tempo real e auditoria pública por cadeia de hashes.
  </p>

<!-- Badges -->

</div>

<br />

<!-- Table of Contents -->
# Índice

- [Sobre o projeto](#sobre-o-projeto)
  * [Capturas de tela](#capturas-de-tela)
  * [Tecnologias](#tecnologias)
  * [Funcionalidades](#funcionalidades)
  * [Estrutura](#estrutura)
  * [Variáveis de ambiente](#variáveis-de-ambiente)
  * [Decisões de arquitetura](#decisões-de-arquitetura)
- [Primeiros passos](#primeiros-passos)
  * [Pré-requisitos](#pré-requisitos)
  * [Como rodar](#como-rodar)
  * [Executando os testes](#executando-os-testes)
- [Uso](#uso)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)
  * [Código de conduta](#código-de-conduta)
- [FAQ](#faq)
- [Licença](#licença)
- [Contato](#contato)
- [Agradecimentos](#agradecimentos)

<!-- About the Project -->
## Sobre o projeto

Leiloeiros criam lotes a partir do acervo do Harvard Art Museums, licitantes dão lances em tempo real e cada lance entra numa cadeia de hashes que qualquer pessoa pode auditar sem login.

Cada pasta tem o próprio README com o detalhe:

- [backend/README.md](backend/README.md): rotas, regras de negócio, concorrência, auditoria e testes
- [frontend/README.md](frontend/README.md): telas, sessão, tempo real e decisões de interface

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
    <li><a href="https://tailwindcss.com/">Tailwind CSS 4</a></li>
  </ul>
</details>

<details>
  <summary>Servidor</summary>
  <ul>
    <li><a href="https://nestjs.com/">NestJS 12</a></li>
    <li><a href="https://www.prisma.io/">Prisma 6</a></li>
    <li><a href="https://socket.io/">Socket.io</a></li>
  </ul>
</details>

<details>
<summary>Banco de dados</summary>
  <ul>
    <li><a href="https://www.postgresql.org/">PostgreSQL 16</a></li>
  </ul>
</details>

<details>
<summary>API externa</summary>
  <ul>
    <li><a href="https://harvardartmuseums.org/collections/api">Harvard Art Museums</a></li>
  </ul>
</details>

<details>
<summary>DevOps</summary>
  <ul>
    <li><a href="https://www.docker.com/">Docker Compose</a> (apenas o PostgreSQL)</li>
  </ul>
</details>

<!-- Features -->
### Funcionalidades

- Lotes criados a partir de obras do Harvard Art Museums
- Lances em tempo real via WebSocket, com badge "Ganhando" ou "Superado"
- Saldo comprometido: o valor do lance fica bloqueado para o líder e volta quando ele é superado
- Anti-sniping: lance nos últimos 2 minutos soma 2 minutos ao fim do lote
- Liquidação automática dos lotes vencidos
- Comprovante anonimizado e auditoria pública da cadeia de lances (selo Íntegro ou Adulterado)

<!-- Estrutura -->
### Estrutura

```
.
├── docker-compose.yml   PostgreSQL
├── backend/             API NestJS, WebSocket, liquidação, auditoria
└── frontend/            Next.js
```

<!-- Env Variables -->
### Variáveis de ambiente

Cada aplicação tem o próprio `.env.example`:

| Aplicação | Variável | Uso |
|---|---|---|
| backend | `DATABASE_URL` | Conexão com o PostgreSQL |
| backend | `JWT_SECRET` | Segredo de assinatura dos tokens |
| backend | `HARVARD_API_KEY` | Chave da Harvard Art Museums |
| frontend | `NEXT_PUBLIC_API_URL` | Endereço da API (padrão `http://localhost:3001`) |

<!-- Arquitetura -->
### Decisões de arquitetura

**Resiliência da API externa.** Ao criar um lote, título, URL da imagem e atributos da obra são copiados para o banco. Vitrine, sala, auditoria e comprovante leem só do PostgreSQL. Se a Harvard cair, apenas a criação de lotes novos fica indisponível.

**Motor de lances.** Cada lance roda em uma transação com `SELECT ... FOR UPDATE` no lote e, depois, nas carteiras envolvidas em ordem de id. O lock do lote serializa lances concorrentes, e a ordem fixa nas carteiras evita deadlock. O evento em tempo real só sai depois do commit.

**Saldo comprometido.** `disponível = total - comprometido`. O líder tem o valor do lance bloqueado, e o bloqueio volta no instante em que ele é superado.

**Anti-sniping.** Lance aceito nos últimos 2 minutos soma 2 minutos ao fim do lote.

**Liquidação.** Um timer de 1 s varre os lotes vencidos. Cada lote é liquidado em transação própria, relendo o estado sob lock, o que torna a operação idempotente.

**Auditoria.** Cada lance guarda `SHA256(id|valor|instante|licitante|hash anterior)`. A página pública recalcula a cadeia inteira a cada consulta. Detalhes em [backend/README.md](backend/README.md#auditoria).

**Dinheiro.** Sempre em centavos, inteiro (`BigInt` no banco, string no JSON).

<!-- Getting Started -->
## Primeiros passos

<!-- Prerequisites -->
### Pré-requisitos

- Node.js LTS recente
- Docker com Compose
- Chave gratuita da Harvard Art Museums: https://harvardartmuseums.org/collections/api

<!-- Run Locally -->
### Como rodar

**1. Banco**

```bash
docker compose up -d
docker compose ps        # db deve aparecer como healthy
```

**2. Back-end**

```bash
cd backend
cp .env.example .env     # preencha HARVARD_API_KEY e troque JWT_SECRET
npm install
npx prisma migrate deploy
npm run start:dev        # http://localhost:3001
```

**3. Seed** (com o back-end rodando, em outro terminal)

```bash
cd backend
npm run seed
```

**4. Front-end**

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3000
```

As páginas de vitrine, comprovante e auditoria são renderizadas no servidor do Next e consultam a API a cada carregamento, então o back-end precisa estar no ar.

<!-- Running Tests -->
### Executando os testes

```bash
cd backend
npm test                          # unitários
npm run test:e2e                  # integração, exige o PostgreSQL no ar
node scripts/concorrencia.mjs     # 20 lances simultâneos contra o servidor real
```

O front-end não tem testes automatizados.

<!-- Usage -->
## Uso

Contas criadas pelo seed (senha de todas: `senha1234`):

| Papel | E-mail |
|---|---|
| Leiloeiro | leiloeiro@exemplo.com |
| Licitante | ana@exemplo.com |
| Licitante | bruno@exemplo.com |

O seed cria um lote ao vivo com três lances (Ana lidera). Pode ser repetido: contas existentes são reaproveitadas e, se já houver um lote ao vivo do leiloeiro, nenhum outro é criado.

<!-- Roadmap -->
## Roadmap

- [x] Motor de lances com concorrência segura
- [x] Tempo real, liquidação automática e auditoria pública
- [ ] Guardar o token em cookie `HttpOnly` em vez de `localStorage`
- [ ] Âncora externa da cadeia de hashes (hoje só o `hashFinal` do comprovante)
- [ ] Estorno para cancelamento de lotes com lances
- [ ] Testes automatizados no front-end
- [ ] Back-end e front-end no Compose

Limites conhecidos hoje:

- A hash chain detecta alteração, mas quem controla o banco inteiro pode reescrever a cadeia recalculando todos os hashes. O comprovante traz o hash do último lance para o vencedor guardá-lo fora do sistema: uma cadeia reescrita deixa de bater com ele.
- A imagem do lote é carregada do servidor da Harvard pelo navegador. A URL fica salva, os bytes não.
- O papel (leiloeiro ou licitante) é escolhido no cadastro, para facilitar a demonstração.
- O anonimato usa 4 caracteres, então dois licitantes do mesmo lote podem colidir (cerca de 0,3% com 20 participantes).
- O cancelamento só é permitido em lotes sem lances, por isso não há estorno.

<!-- Contributing -->
## Contribuindo

<a href="https://github.com/SEU_USUARIO/leilao/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SEU_USUARIO/leilao" />
</a>

Contribuições são sempre bem-vindas!

Veja `contributing.md` para saber como começar.

<!-- Code of Conduct -->
### Código de conduta

Leia o [Código de Conduta](https://github.com/SEU_USUARIO/leilao/blob/master/CODE_OF_CONDUCT.md).

<!-- FAQ -->
## FAQ

- O que acontece se a Harvard Art Museums sair do ar?

  + Só a criação de lotes novos responde 502. Todo o resto lê do PostgreSQL e continua funcionando.

- O back-end precisa estar no ar para o front-end funcionar?

  + Sim. Vitrine, comprovante e auditoria são renderizadas no servidor do Next e consultam a API a cada carregamento.

- Como verifico se um lote foi adulterado?

  + Abra `/auditoria/[loteId]` (sem login). A página recalcula a cadeia inteira e mostra o selo Íntegro ou Adulterado.

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
