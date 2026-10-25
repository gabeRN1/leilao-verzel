import assert from 'node:assert/strict';

const API = 'http://localhost:3001';
const N = 20;
const rodada = Date.now();

async function chamar(caminho, { token, corpo } = {}) {
  const res = await fetch(API + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: corpo && JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json() };
}

const leiloeiro = (
  await chamar('/auth/login', { corpo: { email: 'leo@teste.com', senha: '12345678' } })
).corpo.token;

const agora = Date.now();
const lote = (
  await chamar('/lotes', {
    token: leiloeiro,
    corpo: {
      obraId: 228650,
      lanceInicial: 100000,
      incremento: 10000,
      inicioEm: new Date(agora - 1000).toISOString(),
      fimEm: new Date(agora + 3600000).toISOString(),
    },
  })
).corpo;

const licitantes = await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const { corpo } = await chamar('/auth/registro', {
      corpo: {
        nome: `Teste ${i}`,
        email: `conc${rodada}-${i}@teste.com`,
        senha: '12345678',
        papel: 'LICITANTE',
      },
    });
    await chamar('/carteira/depositos', { token: corpo.token, corpo: { valor: 1_000_000 } });
    return corpo.token;
  }),
);

const lance = (token, valor) =>
  chamar(`/lotes/${lote.id}/lances`, { token, corpo: { valor } });
const aceitos = (respostas) => respostas.filter((r) => r.status === 201).length;

// Rodada A: 20 lances idênticos ao mesmo tempo. Só um pode ser aceito.
const rodadaA = await Promise.all(licitantes.map((t) => lance(t, 100000)));
assert.equal(aceitos(rodadaA), 1, 'mesmo valor simultâneo: só um lance pode ser aceito');

// Rodada B: 20 valores distintos e crescentes ao mesmo tempo.
const rodadaB = await Promise.all(licitantes.map((t, i) => lance(t, 100000 + 10000 * (i + 1))));

assert.ok(
  [...rodadaA, ...rodadaB].every((r) => r.status < 500),
  'nenhuma requisição pode terminar em erro 5xx',
);

const final = (await chamar(`/lotes/${lote.id}`)).corpo;
const carteiras = await Promise.all(licitantes.map((t) => chamar('/carteira', { token: t })));
const comprometidos = carteiras.map((c) => BigInt(c.corpo.saldoComprometido));
const soma = comprometidos.reduce((a, b) => a + b, 0n);

assert.equal(final.totalLances, 1 + aceitos(rodadaB), 'lances gravados = lances aceitos');
assert.equal(soma, BigInt(final.valorAtual), 'comprometido total = valor do lance líder');
assert.equal(comprometidos.filter((c) => c > 0n).length, 1, 'só o líder tem saldo comprometido');

console.log('OK', {
  loteId: lote.id,
  aceitosA: aceitos(rodadaA),
  aceitosB: aceitos(rodadaB),
  valorAtual: final.valorAtual,
});