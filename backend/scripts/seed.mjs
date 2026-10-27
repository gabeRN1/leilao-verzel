const API = process.env.API_URL ?? 'http://localhost:3001';
const OBRA_ID = Number(process.env.OBRA_ID ?? 228650);
const SENHA = 'senha1234';
const SALDO = 2_000_000; // R$ 20.000,00, em centavos
const DIA = 86_400_000;

const contas = {
  leiloeiro: { nome: 'Helena Prado', email: 'leiloeiro@exemplo.com', papel: 'LEILOEIRO' },
  ana: { nome: 'Ana Souza', email: 'ana@exemplo.com', papel: 'LICITANTE' },
  bruno: { nome: 'Bruno Lima', email: 'bruno@exemplo.com', papel: 'LICITANTE' },
};

async function chamar(caminho, { token, corpo } = {}) {
  const res = await fetch(API + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: corpo && JSON.stringify(corpo),
  }).catch(() => null);
  if (!res) throw new Error(`API fora do ar em ${API}. Suba o backend antes do seed.`);
  return { status: res.status, corpo: await res.json().catch(() => null) };
}

async function exigir(resposta, o_que) {
  if (resposta.status >= 400) {
    throw new Error(`${o_que}: ${resposta.status} ${JSON.stringify(resposta.corpo)}`);
  }
  return resposta.corpo;
}

async function garantirConta(conta) {
  const registro = await chamar('/auth/registro', { corpo: { ...conta, senha: SENHA } });
  if (registro.status === 201) return registro.corpo.token;
  if (registro.status !== 409) await exigir(registro, `registro de ${conta.email}`);

  const login = await chamar('/auth/login', { corpo: { email: conta.email, senha: SENHA } });
  if (login.status !== 200) throw new Error(`${conta.email} já existe com outra senha`);
  return login.corpo.token;
}

async function completarSaldo(token) {
  const carteira = await exigir(await chamar('/carteira', { token }), 'consulta de carteira');
  const falta = SALDO - Number(carteira.saldoTotal);
  if (falta > 0) {
    await exigir(await chamar('/carteira/depositos', { token, corpo: { valor: falta } }), 'depósito');
  }
}

const token = {
  leiloeiro: await garantirConta(contas.leiloeiro),
  ana: await garantirConta(contas.ana),
  bruno: await garantirConta(contas.bruno),
};
await completarSaldo(token.ana);
await completarSaldo(token.bruno);

const meus = await exigir(await chamar('/lotes/meus', { token: token.leiloeiro }), 'lotes do leiloeiro');
let lote = meus.find((l) => l.status === 'AO_VIVO');

if (lote) {
  console.log(`Já existe um lote ao vivo (${lote.id}); nada a criar.`);
} else {
  const agora = Date.now();
  lote = await exigir(
    await chamar('/lotes', {
      token: token.leiloeiro,
      corpo: {
        obraId: OBRA_ID,
        lanceInicial: 100_000,
        incremento: 10_000,
        inicioEm: new Date(agora).toISOString(),
        fimEm: new Date(agora + 7 * DIA).toISOString(),
      },
    }),
    'criação do lote',
  );

  const lances = [
    ['ana', 100_000],
    ['bruno', 110_000],
    ['ana', 120_000],
  ];
  for (const [quem, valor] of lances) {
    await exigir(
      await chamar(`/lotes/${lote.id}/lances`, { token: token[quem], corpo: { valor } }),
      `lance de ${quem}`,
    );
  }
  console.log(`Lote criado: ${lote.titulo} (${lote.id}), 3 lances, líder: Ana.`);
}

console.log(`
Contas (senha de todas: ${SENHA})
  leiloeiro  ${contas.leiloeiro.email}
  licitante  ${contas.ana.email}
  licitante  ${contas.bruno.email}

Sala:      http://localhost:3000/lotes/${lote.id}
Auditoria: http://localhost:3000/auditoria/${lote.id}`);