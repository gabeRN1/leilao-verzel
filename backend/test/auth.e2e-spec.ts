import { type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ambiente, iniciarApp } from './helpers';

const prefixo = `auth-e2e-${Date.now()}`;

describe('auth e carteira', () => {
  let app: INestApplication;
  let amb: ReturnType<typeof ambiente>;
  const email = (nome: string) => `${prefixo}-${nome}@teste.com`;
  const corpo = (nome: string, papel = 'LICITANTE') => ({
    nome,
    email: email(nome),
    senha: '12345678',
    papel,
  });

  beforeAll(async () => {
    app = await iniciarApp();
    amb = ambiente(app, prefixo);
  });

  afterAll(async () => {
    await amb.limpar();
    await app.close();
  });

  describe('registro', () => {
    it('devolve token e usuário, cria a carteira zerada e não expõe a senha', async () => {
      const { body } = await amb.http().post('/auth/registro').send(corpo('ana')).expect(201);

      expect(body.token).toEqual(expect.any(String));
      expect(body.usuario).toMatchObject({ nome: 'ana', papel: 'LICITANTE' });
      expect(JSON.stringify(body)).not.toContain('12345678');

      const { body: carteira } = await amb.http().get('/carteira').set(amb.auth(body.token)).expect(200);
      expect(carteira).toEqual({ saldoTotal: '0', saldoComprometido: '0', saldoDisponivel: '0' });
    });

    it('guarda só o hash da senha, com salt', async () => {
      const usuario = await amb.prisma.usuario.findUniqueOrThrow({ where: { email: email('ana') } });
      expect(usuario.senhaHash).not.toContain('12345678');
      expect(usuario.senhaHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('recusa e-mail repetido, inclusive com outra capitalização', async () => {
      await amb.http().post('/auth/registro').send(corpo('ana')).expect(409);
      await amb
        .http()
        .post('/auth/registro')
        .send({ ...corpo('ana'), email: email('ana').toUpperCase() })
        .expect(409);
    });

    it('recusa corpo inválido', async () => {
      const post = (dados: object) => amb.http().post('/auth/registro').send(dados);
      await post({}).expect(400);
      await post({ ...corpo('curta'), senha: '1234567' }).expect(400);
      await post({ ...corpo('semmail'), email: 'nao-e-email' }).expect(400);
      await post({ ...corpo('papel'), papel: 'ADMIN' }).expect(400);
      await post({ ...corpo('n'), nome: 'a' }).expect(400);
    });
  });

  describe('login', () => {
    it('autentica e ignora capitalização e espaços no e-mail', async () => {
      const { body } = await amb
        .http()
        .post('/auth/login')
        .send({ email: `  ${email('ana').toUpperCase()} `, senha: '12345678' })
        .expect(201);
      expect(body.usuario.nome).toBe('ana');
    });

    it('usa a mesma resposta para senha errada e e-mail inexistente', async () => {
      const errada = await amb.http().post('/auth/login').send({ email: email('ana'), senha: 'errada123' }).expect(401);
      const inexistente = await amb.http().post('/auth/login').send({ email: email('fantasma'), senha: '12345678' }).expect(401);
      expect(errada.body.message).toBe(inexistente.body.message);
    });
  });

  describe('proteção de rotas', () => {
    it('recusa token ausente, malformado e adulterado', async () => {
      const { body } = await amb.http().post('/auth/login').send({ email: email('ana'), senha: '12345678' });
      const adulterado = body.token.slice(0, -3) + (body.token.endsWith('aaa') ? 'bbb' : 'aaa');

      await amb.http().get('/carteira').expect(401);
      await amb.http().get('/carteira').set({ authorization: 'Bearer lixo' }).expect(401);
      await amb.http().get('/carteira').set({ authorization: `Basic ${body.token}` }).expect(401);
      await amb.http().get('/carteira').set(amb.auth(adulterado)).expect(401);
    });
  });

  describe('depósito', () => {
    it('acumula depósitos do licitante', async () => {
      const { token } = await amb.registrar('LICITANTE');
      await amb.http().post('/carteira/depositos').set(amb.auth(token)).send({ valor: 5_000 }).expect(201);
      const { body } = await amb.http().post('/carteira/depositos').set(amb.auth(token)).send({ valor: 2_500 }).expect(201);
      expect(body).toEqual({ saldoTotal: '7500', saldoComprometido: '0', saldoDisponivel: '7500' });
    });

    it('leiloeiro não deposita e sem token é 401', async () => {
      const { token } = await amb.registrar('LEILOEIRO');
      await amb.http().post('/carteira/depositos').set(amb.auth(token)).send({ valor: 100 }).expect(403);
      await amb.http().post('/carteira/depositos').send({ valor: 100 }).expect(401);
    });

    it('recusa valor inválido e respeita o teto por depósito', async () => {
      const { token } = await amb.registrar('LICITANTE');
      const depositar = (valor: unknown) =>
        amb.http().post('/carteira/depositos').set(amb.auth(token)).send({ valor });

      for (const invalido of [0, -5, 10.5, '100', null]) await depositar(invalido).expect(400);
      await depositar(100_000_001).expect(400);
      await depositar(100_000_000).expect(201);
    });
  });
});