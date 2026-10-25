import { type INestApplication } from '@nestjs/common';
import { type StatusLote } from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { calcularHash } from '../src/auditoria/hash';
import { configurar } from '../src/configurar';
import { PrismaService } from '../src/prisma/prisma.service';

const prefixo = `lances-e2e-${Date.now()}`;
const MIN = 60_000;

describe('lances', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leiloeiro: { token: string; id: string };
  let contador = 0;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const dar = (loteId: string, token: string, valor: number) =>
    http().post(`/lotes/${loteId}/lances`).set(auth(token)).send({ valor });

  async function registrar(papel: 'LEILOEIRO' | 'LICITANTE', saldo = 0) {
    const n = contador++;
    const { body } = await http()
      .post('/auth/registro')
      .send({ nome: `u${n}`, email: `${prefixo}-${n}@teste.com`, senha: '12345678', papel })
      .expect(201);
    if (saldo > 0) {
      await http().post('/carteira/depositos').set(auth(body.token)).send({ valor: saldo }).expect(201);
    }
    return { token: body.token as string, id: body.usuario.id as string };
  }

  // Lote criado direto no banco: o teste do motor não depende da API externa.
  function criarLote(
    opcoes: {
      inicio?: number;
      fim?: number;
      lanceInicial?: number;
      incremento?: number;
      status?: StatusLote;
    } = {},
  ) {
    const { inicio = -1000, fim = 60 * MIN, lanceInicial = 10_000, incremento = 1_000, status = 'ABERTO' } = opcoes;
    return prisma.lote.create({
      data: {
        leiloeiroId: leiloeiro.id,
        titulo: 'Obra de teste',
        imagemUrl: 'https://exemplo.test/obra.jpg',
        atributos: {},
        origemId: '1',
        lanceInicial: BigInt(lanceInicial),
        incremento: BigInt(incremento),
        inicioEm: new Date(Date.now() + inicio),
        fimEm: new Date(Date.now() + fim),
        status,
      },
    });
  }

  async function saldo(token: string) {
    const { body } = await http().get('/carteira').set(auth(token)).expect(200);
    return {
      total: body.saldoTotal as string,
      comprometido: body.saldoComprometido as string,
      disponivel: body.saldoDisponivel as string,
    };
  }

  async function verificarCadeia(loteId: string) {
    const lances = await prisma.lance.findMany({ where: { loteId }, orderBy: { sequencia: 'asc' } });
    lances.forEach((lance, i) => {
      expect(lance.sequencia).toBe(i + 1);
      expect(lance.hashAnterior).toBe(i === 0 ? null : lances[i - 1].hash);
      expect(lance.hash).toBe(calcularHash(lance));
    });
    return lances;
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurar(app);
    // Com o servidor já escutando, requisições simultâneas do supertest não tentam
    // abrir a mesma porta duas vezes.
    await app.listen(0);
    prisma = app.get(PrismaService);
    leiloeiro = await registrar('LEILOEIRO');
  });

  afterAll(async () => {
    await prisma.lance.deleteMany({
      where: { lote: { leiloeiro: { email: { startsWith: prefixo } } } },
    });
    await prisma.lote.deleteMany({ where: { leiloeiro: { email: { startsWith: prefixo } } } });
    await prisma.carteira.deleteMany({ where: { usuario: { email: { startsWith: prefixo } } } });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: prefixo } } });
    await app.close();
  });

  describe('acesso e validação', () => {
    it('exige autenticação e papel de licitante', async () => {
      const lote = await criarLote();
      await http().post(`/lotes/${lote.id}/lances`).send({ valor: 10_000 }).expect(401);
      await dar(lote.id, leiloeiro.token, 10_000).expect(403);
    });

    it('recusa valor inválido e id malformado', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 0).expect(400);
      await dar(lote.id, token, -5).expect(400);
      await dar(lote.id, token, 10.5).expect(400);
      await http().post(`/lotes/${lote.id}/lances`).set(auth(token)).send({}).expect(400);
      await dar('abc', token, 10_000).expect(400);
    });

    it('responde 404 para lote inexistente', async () => {
      const { token } = await registrar('LICITANTE', 50_000);
      await dar('00000000-0000-4000-8000-000000000000', token, 10_000).expect(404);
    });
  });

  describe('lote precisa estar ao vivo', () => {
    it.each([
      ['agendado', { inicio: 60 * MIN, fim: 120 * MIN }],
      ['com fim vencido, mesmo antes da liquidação', { inicio: -120 * MIN, fim: -60 * MIN }],
      ['cancelado', { status: 'CANCELADO' as const }],
      ['encerrado', { status: 'ENCERRADO' as const }],
    ])('recusa lance em lote %s', async (_, opcoes) => {
      const lote = await criarLote(opcoes);
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 10_000).expect(409);
      expect(await prisma.lance.count({ where: { loteId: lote.id } })).toBe(0);
    });
  });

  describe('valor mínimo', () => {
    it('recusa primeiro lance abaixo do inicial e aceita exatamente o inicial', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 9_999).expect(422);
      const { body } = await dar(lote.id, token, 10_000).expect(201);
      expect(body.lance).toMatchObject({ sequencia: 1, valor: '10000' });
    });

    it('exige valor atual + incremento e aceita exatamente esse valor', async () => {
      const lote = await criarLote();
      const a = await registrar('LICITANTE', 50_000);
      const b = await registrar('LICITANTE', 50_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      await dar(lote.id, b.token, 10_500).expect(422);
      await dar(lote.id, b.token, 10_999).expect(422);
      await dar(lote.id, b.token, 11_000).expect(201);
    });

    it('recusa o líder cobrindo o próprio lance', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 10_000).expect(201);
      await dar(lote.id, token, 20_000).expect(409);
      expect(await prisma.lance.count({ where: { loteId: lote.id } })).toBe(1);
    });
  });

  describe('saldo comprometido', () => {
    it('liderar bloqueia o valor sem reduzir o saldo total', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 10_000).expect(201);
      expect(await saldo(token)).toEqual({ total: '50000', comprometido: '10000', disponivel: '40000' });
    });

    it('ser superado devolve o valor na hora, e o novo líder passa a ter o bloqueio', async () => {
      const lote = await criarLote();
      const a = await registrar('LICITANTE', 50_000);
      const b = await registrar('LICITANTE', 50_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      await dar(lote.id, b.token, 11_000).expect(201);

      expect(await saldo(a.token)).toEqual({ total: '50000', comprometido: '0', disponivel: '50000' });
      expect(await saldo(b.token)).toEqual({ total: '50000', comprometido: '11000', disponivel: '39000' });
    });

    it('quem foi superado pode retomar a liderança', async () => {
      const lote = await criarLote();
      const a = await registrar('LICITANTE', 50_000);
      const b = await registrar('LICITANTE', 50_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      await dar(lote.id, b.token, 11_000).expect(201);
      await dar(lote.id, a.token, 12_000).expect(201);

      expect((await saldo(a.token)).comprometido).toBe('12000');
      expect((await saldo(b.token)).comprometido).toBe('0');
    });

    it('recusa lance acima do saldo disponível, sem alterar nada', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 50_001).expect(422);

      expect(await saldo(token)).toEqual({ total: '50000', comprometido: '0', disponivel: '50000' });
      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.valorAtual).toBeNull();
      expect(atual.liderId).toBeNull();
    });

    it('o saldo comprometido em um lote reduz o disponível para os outros', async () => {
      const loteA = await criarLote();
      const loteB = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);

      await dar(loteA.id, token, 40_000).expect(201);
      await dar(loteB.id, token, 10_001).expect(422);
      await dar(loteB.id, token, 10_000).expect(201);
      expect((await saldo(token)).disponivel).toBe('0');
    });

    it('lance exatamente igual ao saldo disponível é aceito', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 10_000);
      await dar(lote.id, token, 10_000).expect(201);
    });
  });

  describe('estado do lote e resposta', () => {
    it('atualiza valor atual, líder e total de lances, e responde com o lance aceito', async () => {
      const lote = await criarLote();
      const a = await registrar('LICITANTE', 50_000);
      const b = await registrar('LICITANTE', 50_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      const { body } = await dar(lote.id, b.token, 11_000).expect(201);

      expect(body).toMatchObject({ lance: { sequencia: 2, valor: '11000' }, prorrogado: false });

      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.valorAtual).toBe(11_000n);
      expect(atual.liderId).toBe(b.id);

      const publico = await http().get(`/lotes/${lote.id}`).expect(200);
      expect(publico.body).toMatchObject({ valorAtual: '11000', totalLances: 2 });
      expect(publico.body).not.toHaveProperty('liderId');
    });

    it('lote com lance não pode mais ser cancelado', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 10_000).expect(201);
      await http().delete(`/lotes/${lote.id}`).set(auth(leiloeiro.token)).expect(409);
    });
  });

  describe('hash chain', () => {
    it('cada lance guarda o hash do anterior e o próprio hash é reproduzível', async () => {
      const lote = await criarLote();
      const a = await registrar('LICITANTE', 100_000);
      const b = await registrar('LICITANTE', 100_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      await dar(lote.id, b.token, 11_000).expect(201);
      await dar(lote.id, a.token, 12_000).expect(201);

      const lances = await verificarCadeia(lote.id);
      expect(lances).toHaveLength(3);
      expect(lances[0].hashAnterior).toBeNull();
    });

    it('lances recusados não entram na cadeia', async () => {
      const lote = await criarLote();
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 10_000).expect(201);
      await dar(lote.id, token, 20_000).expect(409);
      await dar(lote.id, token, 1).expect(409);

      expect(await verificarCadeia(lote.id)).toHaveLength(1);
    });

    it('cadeias de lotes diferentes são independentes', async () => {
      const loteA = await criarLote();
      const loteB = await criarLote();
      const { token } = await registrar('LICITANTE', 100_000);
      await dar(loteA.id, token, 10_000).expect(201);
      await dar(loteB.id, token, 10_000).expect(201);

      const [a] = await verificarCadeia(loteA.id);
      const [b] = await verificarCadeia(loteB.id);
      expect(a.sequencia).toBe(1);
      expect(b.sequencia).toBe(1);
      expect(b.hashAnterior).toBeNull();
    });
  });

  describe('anti-sniping', () => {
    it('lance nos últimos 2 minutos estende o fim em exatamente 2 minutos', async () => {
      const lote = await criarLote({ fim: 90_000 });
      const { token } = await registrar('LICITANTE', 50_000);
      const { body } = await dar(lote.id, token, 10_000).expect(201);

      expect(body.prorrogado).toBe(true);
      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.fimEm.getTime()).toBe(lote.fimEm.getTime() + 2 * MIN);
      expect(new Date(body.fimEm).getTime()).toBe(atual.fimEm.getTime());
    });

    it('lance fora da janela não altera o fim', async () => {
      const lote = await criarLote({ fim: 10 * MIN });
      const { token } = await registrar('LICITANTE', 50_000);
      const { body } = await dar(lote.id, token, 10_000).expect(201);

      expect(body.prorrogado).toBe(false);
      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.fimEm.getTime()).toBe(lote.fimEm.getTime());
    });

    it('depois de prorrogado, o fim passa de 2 minutos e o lance seguinte não prorroga de novo', async () => {
      const lote = await criarLote({ fim: 90_000 });
      const a = await registrar('LICITANTE', 50_000);
      const b = await registrar('LICITANTE', 50_000);
      await dar(lote.id, a.token, 10_000).expect(201);
      const { body } = await dar(lote.id, b.token, 11_000).expect(201);

      expect(body.prorrogado).toBe(false);
      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.fimEm.getTime()).toBe(lote.fimEm.getTime() + 2 * MIN);
    });

    it('lance recusado não prorroga o lote', async () => {
      const lote = await criarLote({ fim: 90_000 });
      const { token } = await registrar('LICITANTE', 50_000);
      await dar(lote.id, token, 9_999).expect(422);

      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.fimEm.getTime()).toBe(lote.fimEm.getTime());
    });
  });

  describe('concorrência', () => {
    const N = 10;
    const licitantes = () => Promise.all(Array.from({ length: N }, () => registrar('LICITANTE', 1_000_000)));

    it('lances idênticos e simultâneos: só um é aceito', async () => {
      const lote = await criarLote();
      const pessoas = await licitantes();
      const respostas = await Promise.all(pessoas.map((p) => dar(lote.id, p.token, 10_000)));

      const status = respostas.map((r) => r.status);
      expect(status.filter((s) => s === 201)).toHaveLength(1);
      expect(status.every((s) => s < 500)).toBe(true);
      expect(await verificarCadeia(lote.id)).toHaveLength(1);
    }, 30_000);

    it('valores distintos e simultâneos: cadeia íntegra e saldo comprometido consistente', async () => {
      const lote = await criarLote();
      const pessoas = await licitantes();
      const respostas = await Promise.all(
        pessoas.map((p, i) => dar(lote.id, p.token, 10_000 + 1_000 * i)),
      );

      const aceitos = respostas.filter((r) => r.status === 201).length;
      expect(respostas.every((r) => r.status === 201 || r.status === 422)).toBe(true);

      const lances = await verificarCadeia(lote.id);
      expect(lances).toHaveLength(aceitos);
      for (let i = 1; i < lances.length; i++) {
        expect(lances[i].valor - lances[i - 1].valor).toBeGreaterThanOrEqual(1_000n);
      }

      // O maior valor sempre é aceito: fica pelo menos um incremento acima de qualquer outro.
      const maior = 10_000n + 1_000n * BigInt(N - 1);
      const atual = await prisma.lote.findUniqueOrThrow({ where: { id: lote.id } });
      expect(atual.valorAtual).toBe(maior);
      expect(atual.liderId).toBe(pessoas[N - 1].id);

      const carteiras = await prisma.carteira.findMany({
        where: { usuarioId: { in: pessoas.map((p) => p.id) } },
      });
      const comprometidos = carteiras.filter((c) => c.saldoComprometido > 0n);
      expect(comprometidos).toHaveLength(1);
      expect(comprometidos[0].usuarioId).toBe(atual.liderId);
      expect(comprometidos[0].saldoComprometido).toBe(maior);
      expect(carteiras.every((c) => c.saldoTotal === 1_000_000n)).toBe(true);
    }, 30_000);

    it('o mesmo licitante em dois lotes ao mesmo tempo nunca compromete mais que o saldo', async () => {
      const [loteA, loteB] = await Promise.all([criarLote(), criarLote()]);
      const { token, id } = await registrar('LICITANTE', 15_000);
      const respostas = await Promise.all([dar(loteA.id, token, 10_000), dar(loteB.id, token, 10_000)]);

      expect(respostas.map((r) => r.status).sort()).toEqual([201, 422]);
      const carteira = await prisma.carteira.findUniqueOrThrow({ where: { usuarioId: id } });
      expect(carteira.saldoComprometido).toBe(10_000n);
    }, 30_000);
  });
});