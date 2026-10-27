export type Status = 'AGENDADO' | 'AO_VIVO' | 'ENCERRADO' | 'CANCELADO';

export type Lote = {
  id: string;
  titulo: string;
  imagemUrl: string;
  atributos: Record<string, string | null>;
  lanceInicial: string;
  incremento: string;
  inicioEm: string;
  fimEm: string;
  status: Status;
  valorAtual: string | null;
  leiloeiro: string;
  totalLances: number;
};

export type LanceHistorico = { sequencia: number; valor: string; criadoEm: string; licitante: string };
export type Resumo = { saldoTotal: string; saldoComprometido: string; saldoDisponivel: string };
export type Arremate = { id: string; loteId: string; valor: string; liquidadoEm: string; titulo: string };
export type Venda = Arremate & { vencedor: string };
export type Obra = { obraId: number; titulo: string; artista: string; datacao: string | null; imagemUrl: string };

export type Comprovante = {
  id: string;
  liquidadoEm: string;
  valor: string;
  vencedor: string;
  leiloeiro: string;
  totalLances: number;
  hashFinal: string;
  lote: { id: string; titulo: string; imagemUrl: string; origemId: string; atributos: Record<string, string | null> };
};

export type Auditoria = {
  loteId: string;
  titulo: string;
  selo: 'INTEGRO' | 'ADULTERADO';
  primeiroInvalido: number | null;
  problema: string | null;
  totalLances: number;
  lances: {
    sequencia: number;
    valor: string;
    criadoEm: string;
    licitante: string;
    hashAnterior: string | null;
    hash: string;
  }[];
};