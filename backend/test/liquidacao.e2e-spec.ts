import { type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LiquidacaoService } from '../src/liquidacao/liquidacao.service';
import { ambiente, iniciarApp, MIN, type Pessoa } from './helpers';

describe('liquidação', () => {
  let app: INestApplication;
  let liquidacao: LiquidacaoService;
  let amb: ReturnType<typeof ambiente>;

  beforeAll(async () => {
    app = await iniciarApp();
    amb = ambiente(app, `liquidacao-e2e-${Date.now()}`);
    liquidacao = app.get(LiquidacaoService);
  });

  afterAll(async () => {
    await amb.limpar();
    await app.close();
  });

  async function loteComLances(valores: number[]) {
    const leiloeiro = await amb.registrar('LEILOEIRO');
    const licitantes = await Promise.all(valores.map(() => amb.registrar('LICITANTE', 50_000)));
    const lote = await amb.criarLote(leiloeiro.id, { inicio: -10 * MIN });
    for (const [i, valor] of valores.entries()) {
      await amb.dar(lote.id, licitantes[i].token, valor).expect(201);
    }
    return { leiloeiro, licitantes, lote };
  }

  describe('liquidar', () => {
    it('debita o vencedor, credita o leiloeiro e cria o arremate', async () => {
      const { leiloeiro, licitantes: [a, b], lote } = await loteComLances([10_000, 11_000]);
      await amb.vencer(lote.id);

      const resultado = await liquidacao.liquidar(lote.id);

      expect(resultado).toMatchObject({ vencedorId: b.id, valor: 11_000n });
      expect(await amb.carteira(b.id)).toMatchObject({ saldoTotal: 39_000n, saldoComprometido: 0n });
      expect(await amb.carteira(a.id)).toMatchObject({ saldoTotal: 50_000n, saldoComprometido: 0n });
      expect(await amb.carteira(leiloeiro.id)).toMatchObject({ saldoTotal: 11_000n });

      expect((await amb.prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })).status).toBe('ENCERRADO');
      expect(await amb.prisma.arremate.findUniqueOrThrow({ where: { loteId: lote.id } })).toMatchObject({
        vencedorId: b.id,
        leiloeiroId: leiloeiro.id,
        valor: 11_000n,
      });
    });

    it('é idempotente, mesmo com execuções simultâneas', async () => {
      const { leiloeiro, licitantes: [a], lote } = await loteComLances([10_000]);
      await amb.vencer(lote.id);

      const resultados = await Promise.all([
        liquidacao.liquidar(lote.id),
        liquidacao.liquidar(lote.id),
        liquidacao.liquidar(lote.id),
      ]);
      await liquidacao.liquidar(lote.id);

      expect(resultados.filter((r) => r !== null)).toHaveLength(1);
      expect(await amb.prisma.arremate.count({ where: { loteId: lote.id } })).toBe(1);
      expect(await amb.carteira(a.id)).toMatchObject({ saldoTotal: 40_000n, saldoComprometido: 0n });
      expect((await amb.carteira(leiloeiro.id)).saldoTotal).toBe(10_000n);
    });

    it('lote sem lances fecha sem vencedor e sem movimentar saldo', async () => {
      const leiloeiro = await amb.registrar('LEILOEIRO');
      const lote = await amb.criarLote(leiloeiro.id, { inicio: -10 * MIN });
      await amb.vencer(lote.id);

      expect(await liquidacao.liquidar(lote.id)).toEqual({ vencedorId: null, valor: null, arremateId: null });
      expect((await amb.prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })).status).toBe('ENCERRADO');
      expect(await amb.prisma.arremate.count({ where: { loteId: lote.id } })).toBe(0);
      expect((await amb.carteira(leiloeiro.id)).saldoTotal).toBe(0n);
    });

    it('não liquida lote ainda ao vivo, nem mexe no saldo comprometido', async () => {
      const { licitantes: [a], lote } = await loteComLances([10_000]);

      expect(await liquidacao.liquidar(lote.id)).toBeNull();
      expect((await amb.prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })).status).toBe('ABERTO');
      expect((await amb.carteira(a.id)).saldoComprometido).toBe(10_000n);
    });

    it('não liquida lote cancelado', async () => {
      const leiloeiro = await amb.registrar('LEILOEIRO');
      const lote = await amb.criarLote(leiloeiro.id, { inicio: -10 * MIN, status: 'CANCELADO' });
      await amb.vencer(lote.id);

      expect(await liquidacao.liquidar(lote.id)).toBeNull();
      expect((await amb.prisma.lote.findUniqueOrThrow({ where: { id: lote.id } })).status).toBe('CANCELADO');
    });

    it('depois de liquidado o lote recusa novos lances', async () => {
      const { lote } = await loteComLances([10_000]);
      await amb.vencer(lote.id);
      await liquidacao.liquidar(lote.id);

      const retardatario = await amb.registrar('LICITANTE', 50_000);
      await amb.dar(lote.id, retardatario.token, 20_000).expect(409);
    });
  });

  describe('varrer', () => {
    it('liquida todos os vencidos e ignora os que ainda estão ao vivo', async () => {
      const [x, y] = [await loteComLances([10_000]), await loteComLances([10_000])];
      const aoVivo = await loteComLances([10_000]);
      await amb.vencer(x.lote.id);
      await amb.vencer(y.lote.id);

      await liquidacao.varrer();

      const status = async (id: string) =>
        (await amb.prisma.lote.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(x.lote.id)).toBe('ENCERRADO');
      expect(await status(y.lote.id)).toBe('ENCERRADO');
      expect(await status(aoVivo.lote.id)).toBe('ABERTO');
    });
  });

  describe('arremates e comprovante', () => {
    let leiloeiro: Pessoa;
    let a: Pessoa;
    let b: Pessoa;
    let loteId: string;
    let arremateId: string;

    beforeAll(async () => {
      const cenario = await loteComLances([10_000, 11_000]);
      ({ leiloeiro, lote: { id: loteId } } = cenario);
      [a, b] = cenario.licitantes;
      await amb.vencer(loteId);
      await liquidacao.liquidar(loteId);
      arremateId = (await amb.prisma.arremate.findUniqueOrThrow({ where: { loteId } })).id;
    });

    it('GET /arremates/meus lista só os arremates do vencedor', async () => {
      await amb.http().get('/arremates/meus').expect(401);
      await amb.http().get('/arremates/meus').set(amb.auth(leiloeiro.token)).expect(403);

      const doVencedor = await amb.http().get('/arremates/meus').set(amb.auth(b.token)).expect(200);
      expect(doVencedor.body).toEqual([
        expect.objectContaining({ id: arremateId, loteId, valor: '11000', titulo: 'Obra de teste' }),
      ]);

      const doDerrotado = await amb.http().get('/arremates/meus').set(amb.auth(a.token)).expect(200);
      expect(doDerrotado.body).toEqual([]);
    });

    it('GET /arremates/vendas lista as vendas do leiloeiro com o vencedor anonimizado', async () => {
      await amb.http().get('/arremates/vendas').set(amb.auth(b.token)).expect(403);

      const { body } = await amb.http().get('/arremates/vendas').set(amb.auth(leiloeiro.token)).expect(200);
      expect(body).toEqual([
        expect.objectContaining({ id: arremateId, valor: '11000', vencedor: expect.stringMatching(/^\*\*\*[0-9a-f]{4}$/) }),
      ]);
      expect(JSON.stringify(body)).not.toContain(b.id);
    });

    it('GET /arremates/:id/comprovante é público e anonimizado', async () => {
      const { body } = await amb.http().get(`/arremates/${arremateId}/comprovante`).expect(200);
      const ultimo = await amb.prisma.lance.findFirstOrThrow({ where: { loteId }, orderBy: { sequencia: 'desc' } });

      expect(body).toMatchObject({
        id: arremateId,
        valor: '11000',
        totalLances: 2,
        hashFinal: ultimo.hash,
        lote: { id: loteId, titulo: 'Obra de teste' },
        vencedor: expect.stringMatching(/^\*\*\*[0-9a-f]{4}$/),
      });
      const texto = JSON.stringify(body);
      for (const id of [a.id, b.id, leiloeiro.id]) expect(texto).not.toContain(id);
      expect(texto).not.toContain('@teste.com');
    });

    it('comprovante inexistente é 404 e id malformado é 400', async () => {
      await amb.http().get('/arremates/00000000-0000-4000-8000-000000000000/comprovante').expect(404);
      await amb.http().get('/arremates/abc/comprovante').expect(400);
    });
  });
});