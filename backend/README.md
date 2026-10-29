# Leilão · Back-end

API do leilão: autenticação, carteira, lotes, motor de lances, tempo real, liquidação automática, comprovante e auditoria.

Em produção: https://leilao-verzel-96i4.onrender.com (plano gratuito, a primeira requisição leva cerca de 1 minuto).

## Índice

- [Tecnologias](#tecnologias)
- [Funcionalidades](#funcionalidades)
- [Estrutura](#estrutura)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Instalação](#instalação)
- [Scripts](#scripts)
- [Testes](#testes)
- [Seed](#seed)
- [Deploy](#deploy)
- [Rotas](#rotas)
- [Tempo real](#tempo-real)
- [Regras de negócio](#regras-de-negócio)
- [Concorrência](#concorrência)
- [Resiliência da API externa](#resiliência-da-api-externa)
- [Auditoria](#auditoria)
- [Limites conhecidos](#limites-conhecidos)
- [FAQ](#faq)

## Tecnologias

- TypeScript, em CommonJS (sem `"type": "module"` no `package.json`)
- NestJS 12
- Socket.io
- Prisma 6
- PostgreSQL 16 (Neon em produção)
- Vitest

## Funcionalidades

- Registro, login e guard JWT com papéis (leiloeiro e licitante)
- Carteira com saldo total, comprometido e disponível
- Lotes criados a partir de obras da Harvard, com status derivado do horário
- Motor de lances com locks ordenados, anti-sniping e saldo comprometido
- Eventos em tempo real por Socket.io (`lance`, `encerrado`, `ganhando`, `superado`, `arrematado`)
- Liquidação automática e idempotente
- Comprovante anonimizado e auditoria por cadeia de hashes

## Estrutura

```
src/
├── auth/          registro, login, guard JWT com papéis
├── carteira/      saldo e depósito simulado
├── lotes/         CRUD, busca de obras na Harvard, status derivado
├── lances/        motor de lances, histórico e situação do usuário
├── realtime/      gateway Socket.io
├── liquidacao/    varredura de lotes vencidos e liquidação
├── arremates/     arremates do licitante, vendas do leiloeiro, comprovante
├── auditoria/     hash, anonimização e verificação da cadeia
├── prisma/        cliente do banco
├── configurar.ts  validação e serialização de BigInt, compartilhada com os testes
└── origens.ts     origens permitidas no CORS (lê FRONTEND_URL)
prisma/            schema e migrations
scripts/           seed, concorrência e escuta de eventos
test/              testes e2e e helpers
```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL. Local: `postgresql://leilao:leilao@localhost:5432/leilao` |
| `JWT_SECRET` | Segredo de assinatura dos tokens (expiram em 1 dia) |
| `HARVARD_API_KEY` | Chave da Harvard Art Museums. Sem ela, criar lote e buscar obras retornam 500 |
| `FRONTEND_URL` | Origem(ns) permitida(s) no CORS e no WebSocket, separadas por vírgula, sem barra final. Padrão: `http://localhost:3000` |
| `PORT` | Porta da API. Padrão: `3001` |

O `.env.example` traz as variáveis sem valores reais. O `.env` não é versionado. O CORS compara a origem exatamente: `https://app.vercel.app/` (com barra) não bate com `https://app.vercel.app`. Domínios de preview da Vercel são outras origens e precisam ser listados.

## Instalação

Pré-requisitos: Node.js LTS recente, PostgreSQL 16 no ar (`docker compose up -d db` na raiz do repositório) e a chave da Harvard.

```bash
cd backend
cp .env.example .env     # preencha HARVARD_API_KEY e troque JWT_SECRET
npm install
npx prisma migrate deploy
npm run start:dev        # http://localhost:3001
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run start:dev` | Sobe a API em `localhost:3001` com recarga |
| `npm run build` | Compila para `dist/` |
| `npm run seed` | Cria contas e um lote ao vivo com lances, pela própria API |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de integração contra o PostgreSQL |
| `node scripts/concorrencia.mjs` | 20 lances simultâneos contra o servidor real |
| `node scripts/ouvir.mjs <loteId> [token]` | Escuta os eventos de uma sala no terminal |

Migrations: `npx prisma migrate deploy`.

## Testes

- **Unitários** (`src/**/*.spec.ts`): hash, anonimização, verificação da cadeia e status derivado do lote.
- **E2E** (`test/*.e2e-spec.ts`): auth e carteira, lotes (com a Harvard simulada), lances (limites exatos, saldo, anti-sniping e concorrência), liquidação (idempotência), realtime e auditoria (adulteração direto no banco).

Os e2e usam o banco do `DATABASE_URL`. Cada arquivo cria usuários com e-mail prefixado e apaga tudo no fim, sem tocar nos seus dados. Com `NODE_ENV=test` o timer de liquidação fica desligado, e os testes chamam a liquidação diretamente. **Não aponte o `DATABASE_URL` para o banco de produção ao rodar os testes.**

## Seed

`scripts/seed.mjs` fala com a API em execução em vez de escrever no banco, para que os lances passem pelo motor real e a auditoria valide o resultado. Aceita `API_URL` e `OBRA_ID` por variável de ambiente. Para popular a produção:

```bash
API_URL=https://leilao-verzel-96i4.onrender.com npm run seed
```

A chave usada para criar o lote é a `HARVARD_API_KEY` do servidor (Render), não a da sua máquina.

## Deploy

| Campo (Render) | Valor |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npx prisma migrate deploy && node dist/main` |
| Health Check Path | `/lotes` |

O `--include=dev` é necessário porque o Nest CLI e o Prisma CLI estão em `devDependencies`, e o `prisma generate` explícito cobre ambientes que bloqueiam scripts de instalação. A API lê `PORT`, que o Render define.

No Neon, use a connection string **direta** (sem `-pooler` no host), com `?sslmode=require&connect_timeout=15`. Os locks `FOR UPDATE` do motor de lances e o `migrate deploy` funcionam melhor sem o pooler, e o `connect_timeout` cobre o banco acordando depois de ocioso.

Evite pingar a API para mantê-la acordada: a liquidação consulta o banco a cada segundo, o que manteria o Neon ligado o tempo todo e pode estourar o limite do plano gratuito.

## Rotas

Todas as rotas autenticadas usam `Authorization: Bearer <token>`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/registro` | público | Cria conta e carteira, devolve token |
| POST | `/auth/login` | público | Devolve token |
| GET | `/carteira` | autenticado | Saldo total, comprometido e disponível |
| POST | `/carteira/depositos` | licitante | Depósito simulado, em centavos |
| GET | `/lotes?status=` | público | Vitrine (até 100 lotes). Status: `AGENDADO`, `AO_VIVO`, `ENCERRADO`, `CANCELADO` |
| GET | `/lotes/:id` | público | Detalhe do lote |
| GET | `/lotes/meus` | leiloeiro | Lotes do leiloeiro |
| GET | `/lotes/obras?q=` | leiloeiro | Busca obras na Harvard (mínimo 2 caracteres) |
| POST | `/lotes` | leiloeiro | Cria lote a partir de `obraId` |
| DELETE | `/lotes/:id` | leiloeiro dono | Cancela, somente sem lances |
| GET | `/lotes/:id/lances` | público | Histórico, com licitante anonimizado |
| GET | `/lotes/:id/lances/situacao` | licitante | `{ lider, participou }` |
| POST | `/lotes/:id/lances` | licitante | Dá um lance, valor em centavos |
| GET | `/arremates/meus` | licitante | Arremates do usuário |
| GET | `/arremates/vendas` | leiloeiro | Vendas, com vencedor anonimizado |
| GET | `/arremates/:id/comprovante` | público | Comprovante anonimizado |
| GET | `/auditoria/:loteId` | público | Selo e cadeia de lances |

Erros do lance: `409` (lote fora do ar ou líder repetido), `422` (abaixo do mínimo ou saldo insuficiente). A busca por texto da vitrine é feita no front, sobre o que `GET /lotes` devolve. A API só filtra por status.

## Tempo real

Socket.io no mesmo endereço da API. O token é opcional no handshake (`auth: { token }`): sem ele a conexão é anônima e só assiste. A origem precisa estar em `FRONTEND_URL`, igual ao HTTP.

| Direção | Evento | Conteúdo |
|---|---|---|
| cliente → servidor | `entrar` | `loteId`. Responde `true` ou `false` |
| servidor → sala do lote | `lance` | sequência, valor, instante, novo `fimEm`, `prorrogado`, licitante anonimizado |
| servidor → sala do lote | `encerrado` | vencedor anonimizado e valor |
| servidor → usuário | `ganhando` | lote e valor |
| servidor → usuário | `superado` | lote e valor |
| servidor → vencedor | `arrematado` | lote, id do arremate e valor |

Os eventos de `ganhando`, `superado` e `arrematado` vão para a sala privada do usuário. O id real nunca vai no broadcast.

## Regras de negócio

- **Papéis.** O leiloeiro cria e cancela lotes e vê resultados, mas não dá lances. O licitante deposita e dá lances.
- **Lote ao vivo.** Lance só é aceito com o lote `ABERTO` e dentro de `inicioEm` e `fimEm`.
- **Valor mínimo.** Primeiro lance maior ou igual ao inicial. Seguintes, maior ou igual ao atual mais o incremento.
- **Líder.** Não pode cobrir o próprio lance.
- **Saldo comprometido.** O lance só é aceito se couber em `saldoTotal - saldoComprometido`. O líder anterior recebe o valor de volta na mesma transação. CHECKs no banco recusam comprometido negativo ou acima do total.
- **Anti-sniping.** Lance nos últimos 2 minutos soma 2 minutos ao `fimEm`.
- **Liquidação.** Ao vencer, o valor sai do saldo total e do comprometido do vencedor, entra no saldo do leiloeiro e o `Arremate` é criado. Lote sem lances fecha sem vencedor.
- **Status.** Só `ABERTO`, `ENCERRADO` e `CANCELADO` são gravados. `AGENDADO` e `AO_VIVO` são derivados do horário, e um lote aberto com fim vencido já aparece como encerrado.
- **Cancelamento.** Um único `UPDATE` condicional (aberto, sem líder, dono): não há janela entre checar lances e cancelar.

## Concorrência

Ordem de locks, igual no motor de lances e na liquidação: primeiro a linha do lote, depois as carteiras por id crescente. O relógio é lido depois do lock, então quem esperou na fila é avaliado no instante real e esse mesmo instante vira o `criadoEm` do lance. Os eventos de tempo real saem após o commit, para nunca anunciar um lance que sofreu rollback.

## Resiliência da API externa

`POST /lotes` consulta a Harvard uma vez e grava `titulo`, `imagemUrl`, `origemId` e `atributos` no lote. Nenhuma outra rota chama a API externa. Com a Harvard fora, a criação responde 502 e todo o resto continua funcionando. O comportamento é coberto por teste e2e.

## Auditoria

Cada lance guarda:

```
hash = SHA256(id | valor | instante ISO UTC | licitanteId | hash do lance anterior)
```

O primeiro lance usa texto vazio no lugar do hash anterior. O separador `|` evita colisão por concatenação.

`GET /auditoria/:loteId` percorre os lances por sequência e, para cada um, confere nesta ordem:

1. A sequência é contígua (`SEQUENCIA_QUEBRADA`).
2. O `hashAnterior` é o hash do lance precedente (`ENCADEAMENTO_QUEBRADO`).
3. O hash gravado é o recalculado (`HASH_DIVERGENTE`).

No fim compara o último lance com `valorAtual` e `liderId` do lote (`LOTE_DIVERGENTE`), o que pega a remoção do último lance. A resposta traz o selo `INTEGRO` ou `ADULTERADO` e o primeiro lance afetado.

Quem altera um lance e recalcula o próprio hash é pego pelo encadeamento do lance seguinte. Quem reescreve a cadeia inteira não é detectado pela verificação em si; o `hashFinal` do comprovante serve de âncora externa para esse caso.

Para demonstrar a detecção, altere um lance direto no banco (`UPDATE "Lance" SET valor = valor + 1 WHERE ...`), recarregue a página de auditoria e **desfaça a alteração em seguida**.

**Privacidade.** Licitantes aparecem como `***` mais 4 caracteres do SHA-256 do id, sem expor o id. A mesma função serve a auditoria, o comprovante, a sala e as vendas.

## Limites conhecidos

- A liquidação só roda com o servidor ligado. No plano gratuito do Render a API dorme, e os lotes vencidos nesse intervalo são liquidados na primeira varredura ao acordar.
- O timer de liquidação roda no processo da API. Com várias instâncias, o lock e a releitura sob lock mantêm a operação correta, mas cada instância faria a varredura.
- Em caso de queda entre o commit e o envio do evento, o evento se perde. O front se recupera relendo o estado ao reconectar.
- O cancelamento só aceita lotes sem lances, então não há estorno.

## FAQ

**Por que o seed usa a API em vez de escrever no banco?**
Para que os lances passem pelo motor real e a auditoria valide o resultado.

**O que acontece com eventos de tempo real perdidos numa queda?**
Eles não voltam. O front relê o estado pela API ao reconectar.

**Por que `HARVARD_API_KEY` é obrigatória?**
Sem ela, criar lote e buscar obras retornam 500. As demais rotas não dependem da Harvard.

**O front na Vercel carrega, mas as chamadas falham com erro de CORS.**
`FRONTEND_URL` precisa ser a URL exata da Vercel, sem barra final. O mesmo vale para o WebSocket: se o HTTP funciona e os avisos de lance não atualizam, confira a origem do gateway.