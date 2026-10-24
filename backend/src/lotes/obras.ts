import {
  BadGatewayException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const BASE = 'https://api.harvardartmuseums.org';
const CAMPOS =
  'id,title,primaryimageurl,imagepermissionlevel,dated,classification,medium,dimensions,culture,objectnumber,creditline,people';

type Obra = {
  id: number;
  title: string;
  primaryimageurl: string | null;
  imagepermissionlevel: number;
  dated: string | null;
  classification: string | null;
  medium: string | null;
  dimensions: string | null;
  culture: string | null;
  objectnumber: string | null;
  creditline: string | null;
  people?: { role: string; displayname: string }[];
};

async function chamar<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const apikey = process.env.HARVARD_API_KEY;
  if (!apikey) throw new InternalServerErrorException('HARVARD_API_KEY não configurada');

  const query = new URLSearchParams({ apikey, fields: CAMPOS, ...params });
  const resposta = await fetch(`${BASE}${caminho}?${query}`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (resposta?.status === 404) throw new NotFoundException('Obra não encontrada');
  if (!resposta?.ok) throw new BadGatewayException('Harvard Art Museums indisponível');
  return resposta.json() as Promise<T>;
}

const artistaDe = (o: Obra) =>
  o.people?.find((p) => p.role === 'Artist')?.displayname ?? 'Artista desconhecido';

export async function buscarObras(termo: string) {
  const { records } = await chamar<{ records: Obra[] }>('/object', {
    keyword: termo,
    hasimage: '1',
    q: 'imagepermissionlevel:0',
    size: '12',
  });
  return records
    .filter((o) => o.primaryimageurl)
    .map((o) => ({
      obraId: o.id,
      titulo: o.title,
      artista: artistaDe(o),
      datacao: o.dated,
      imagemUrl: o.primaryimageurl,
    }));
}

export async function buscarObra(id: number) {
  const o = await chamar<Obra>(`/object/${id}`);
  if (!o.primaryimageurl || o.imagepermissionlevel !== 0) {
    throw new UnprocessableEntityException('Obra sem imagem de uso liberado');
  }
  return {
    titulo: o.title,
    imagemUrl: o.primaryimageurl,
    origemId: String(o.id),
    atributos: {
      artista: artistaDe(o),
      datacao: o.dated,
      classificacao: o.classification,
      tecnica: o.medium,
      dimensoes: o.dimensions,
      cultura: o.culture,
      numeroObjeto: o.objectnumber,
      credito: o.creditline,
    },
  };
}