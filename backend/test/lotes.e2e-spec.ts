import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { configurar } from '../src/configurar';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.HARVARD_API_KEY ||= 'chave-de-teste';

const HARVARD = 'https://api.harvardartmuseums.org';
const prefixo = `lotes-e2e-${Date.now()}`;

const obra = {
  id: 228650,
  title: 'Red Boats, Argenteuil',
  primaryimageurl: 'https://nrs.harvard.edu/urn-3:HUAM:DDC231457_dynmc',
  imagepermissionlevel: 0,
  dated: '1875',
  classification: 'Paintings',
  medium: 'Oil on canvas',
  dimensions: '60 x 81 cm',
  culture: 'French',
  objectnumber: '1951.65',
  creditline: 'Harvard Art Museums',
  people: [{ role: 'Artist', displayname: 'Claude Monet' }],
};
const obraSemImagem = { ...obra, id: 777, primaryimageurl: null };

let harvardFora = false;
const fetchReal = globalThis.fetch;

function simularHarvard() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.startsWith(HARVARD)) return fetchReal(input, init);
    if (harvardFora) throw new Error('rede indisponível');

    const { pathname } = new URL(url);
    if (pathname === '/object') return Response.json({ records: [obra, obraSemImagem] });
    if (pathname === `/object/${obra.id}`) return Response.json(obra);
    if (pathname === `/object/${obraSemImagem.id}`) return Response.json(obraSemImagem);
    return new Response('{}', { status: 404 });
  });
}

describe('lotes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leiloeiro: string;
  let outroLeiloeiro: string;
  let licitante: { token: string; id: string };

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

  async function registrar(nome: string, papel: 'LEILOEIRO' | 'LICITANTE') {
    const { body } = await http()
      .post('/auth/registro')
      .send({ nome, email: `${prefixo}-${nome}@teste.com`, senha: '12345678', papel })
      .expect(201);
    return { token: body.token as string, id: body.usuario.id as string };
  }

  async function criarLote(token = leiloeiro, inicioEm = iso(3_600_000), fimEm = iso(7_200_000)) {
    const { body } = await http()
      .post('/lotes')
      .set(auth(token))
      .send({ obraId: obra.id, lanceInicial: 100000, incremento: 10000, inicioEm, fimEm })
      .expect(201);
    return body;
  }

  beforeAll(async () => {
    simularHarvard();
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurar(app);
    await app.init();
    prisma = app.get(PrismaService);

    leiloeiro = (await registrar('leiloeiro', 'LEILOEIRO')).token;
    outroLeiloeiro = (await registrar('outro', 'LEILOEIRO')).token;
    licitante = await registrar('licitante', 'LICITANTE');
  });

  afterAll(async () => {
    const dono = { usuario: { email: { startsWith: prefixo } } };
    await prisma.lote.deleteMany({
      where: { leiloeiro: { email: { startsWith: prefixo } } },
    });
    await prisma.carteira.deleteMany({ where: dono });
    await prisma.usuario.deleteMany({ where: { email: { startsWith: prefixo } } });
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /lotes/obras', () => {
    it('exige autenticação e papel de leiloeiro', async () => {
      await http().get('/lotes/obras?q=monet').expect(401);
      await http().get('/lotes/obras?q=monet').set(auth(licitante.token)).expect(403);
    });

    it('recusa termo com menos de 2 caracteres', async () => {
      await http().get('/lotes/obras?q=m').set(auth(leiloeiro)).expect(400);
    });

    it('lista só obras com imagem', async () => {
      const { body } = await http().get('/lotes/obras?q=monet').set(auth(leiloeiro)).expect(200);
      expect(body).toEqual([
        {
          obraId: obra.id,
          titulo: obra.title,
          artista: 'Claude Monet',
          datacao: '1875',
          imagemUrl: obra.primaryimageurl,
        },
      ]);
    });
  });

  describe('POST /lotes', () => {
    const corpo = () => ({
      obraId: obra.id,
      lanceInicial: 100000,
      incremento: 10000,
      inicioEm: iso(3_600_000),
      fimEm: iso(7_200_000),
    });

    it('exige autenticação e papel de leiloeiro', async () => {
      await http().post('/lotes').send(corpo()).expect(401);
      await http().post('/lotes').set(auth(licitante.token)).send(corpo()).expect(403);
    });

    it('recusa corpo inválido', async () => {
      await http().post('/lotes').set(auth(leiloeiro)).send({}).expect(400);
      await http().post('/lotes').set(auth(leiloeiro)).send({ ...corpo(), incremento: 0 }).expect(400);
      await http().post('/lotes').set(auth(leiloeiro)).send({ ...corpo(), lanceInicial: 10.5 }).expect(400);
    });

    it('recusa início no passado', async () => {
      await http()
        .post('/lotes')
        .set(auth(leiloeiro))
        .send({ ...corpo(), inicioEm: iso(-86_400_000) })
        .expect(400);
    });

    it('aceita início dentro da tolerância de 60 s', async () => {
      await http()
        .post('/lotes')
        .set(auth(leiloeiro))
        .send({ ...corpo(), inicioEm: iso(-30_000) })
        .expect(201);
    });

    it('recusa fim anterior ou igual ao início', async () => {
      const inicioEm = iso(3_600_000);
      await http().post('/lotes').set(auth(leiloeiro)).send({ ...corpo(), inicioEm, fimEm: iso(60_000) }).expect(400);
      await http().post('/lotes').set(auth(leiloeiro)).send({ ...corpo(), inicioEm, fimEm: inicioEm }).expect(400);
    });

    it('responde 404 para obra inexistente e 422 para obra sem imagem', async () => {
      await http().post('/lotes').set(auth(leiloeiro)).send({ ...corpo(), obraId: 1 }).expect(404);
      await http()
        .post('/lotes')
        .set(auth(leiloeiro))
        .send({ ...corpo(), obraId: obraSemImagem.id })
        .expect(422);
    });

    it('responde 502 quando a Harvard está fora', async () => {
      harvardFora = true;
      try {
        await http().post('/lotes').set(auth(leiloeiro)).send(corpo()).expect(502);
      } finally {
        harvardFora = false;
      }
    });

    it('cria o lote com snapshot da obra, sem expor líder nem id do leiloeiro', async () => {
      const lote = await criarLote();
      expect(lote).toMatchObject({
        titulo: obra.title,
        imagemUrl: obra.primaryimageurl,
        origemId: String(obra.id),
        status: 'AGENDADO',
        lanceInicial: '100000',
        incremento: '10000',
        valorAtual: null,
        totalLances: 0,
        atributos: { artista: 'Claude Monet', tecnica: 'Oil on canvas', dimensoes: '60 x 81 cm' },
      });
      expect(lote).not.toHaveProperty('liderId');
      expect(lote).not.toHaveProperty('leiloeiroId');
    });
  });

  describe('resiliência da API externa', () => {
    it('vitrine, detalhe e painel funcionam com a Harvard fora do ar', async () => {
      const criado = await criarLote();
      harvardFora = true;
      try {
        const detalhe = await http().get(`/lotes/${criado.id}`).expect(200);
        expect(detalhe.body).toMatchObject({
          titulo: obra.title,
          imagemUrl: obra.primaryimageurl,
          atributos: { artista: 'Claude Monet' },
        });

        const vitrine = await http().get('/lotes?status=AGENDADO').expect(200);
        expect(vitrine.body.map((l: { id: string }) => l.id)).toContain(criado.id);

        const painel = await http().get('/lotes/meus').set(auth(leiloeiro)).expect(200);
        expect(painel.body.map((l: { id: string }) => l.id)).toContain(criado.id);
      } finally {
        harvardFora = false;
      }
    });
  });

  describe('listagem e detalhe', () => {
    it('filtra por status derivado do horário', async () => {
      const agendado = await criarLote();
      const aoVivo = await criarLote(leiloeiro, iso(-1000), iso(3_600_000));
      expect(aoVivo.status).toBe('AO_VIVO');

      const ids = async (status: string) =>
        (await http().get(`/lotes?status=${status}`).expect(200)).body.map(
          (l: { id: string }) => l.id,
        );

      const vivos = await ids('AO_VIVO');
      expect(vivos).toContain(aoVivo.id);
      expect(vivos).not.toContain(agendado.id);

      const agendados = await ids('AGENDADO');
      expect(agendados).toContain(agendado.id);
      expect(agendados).not.toContain(aoVivo.id);
    });

    it('recusa status desconhecido e id malformado', async () => {
      await http().get('/lotes?status=XYZ').expect(400);
      await http().get('/lotes/abc').expect(400);
    });

    it('responde 404 para lote inexistente', async () => {
      await http().get('/lotes/00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('o painel mostra só os lotes do próprio leiloeiro', async () => {
      const meu = await criarLote(outroLeiloeiro);
      const doOutro = (await http().get('/lotes/meus').set(auth(outroLeiloeiro)).expect(200)).body;
      const deste = (await http().get('/lotes/meus').set(auth(leiloeiro)).expect(200)).body;

      expect(doOutro.map((l: { id: string }) => l.id)).toContain(meu.id);
      expect(deste.map((l: { id: string }) => l.id)).not.toContain(meu.id);
      await http().get('/lotes/meus').set(auth(licitante.token)).expect(403);
    });
  });

  describe('DELETE /lotes/:id', () => {
    it('exige autenticação e papel de leiloeiro', async () => {
      const { id } = await criarLote();
      await http().delete(`/lotes/${id}`).expect(401);
      await http().delete(`/lotes/${id}`).set(auth(licitante.token)).expect(403);
    });

    it('só o dono cancela', async () => {
      const { id } = await criarLote();
      await http().delete(`/lotes/${id}`).set(auth(outroLeiloeiro)).expect(403);
    });

    it('cancela uma vez e recusa o segundo cancelamento', async () => {
      const { id } = await criarLote();
      await http().delete(`/lotes/${id}`).set(auth(leiloeiro)).expect(204);
      await http().delete(`/lotes/${id}`).set(auth(leiloeiro)).expect(409);

      const { body } = await http().get(`/lotes/${id}`).expect(200);
      expect(body.status).toBe('CANCELADO');
    });

    it('responde 404 para lote inexistente', async () => {
      await http()
        .delete('/lotes/00000000-0000-4000-8000-000000000000')
        .set(auth(leiloeiro))
        .expect(404);
    });

    it('recusa cancelar lote que já tem líder', async () => {
      const { id } = await criarLote();
      // Fixa o estado de "tem lance" direto no banco, para o teste não depender do motor de lances.
      await prisma.lote.update({
        where: { id },
        data: { liderId: licitante.id, valorAtual: 100000n },
      });
      await http().delete(`/lotes/${id}`).set(auth(leiloeiro)).expect(409);
      expect((await http().get(`/lotes/${id}`).expect(200)).body.status).toBe('AO_VIVO'.length ? 'AGENDADO' : '');
    });
  });
});