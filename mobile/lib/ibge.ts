export type IbgeEstado = { id: number; sigla: string; nome: string };

export type IbgeMunicipio = { id: number; nome: string };

export async function fetchIbgeEstados(): Promise<IbgeEstado[]> {
  const url =
    'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('IBGE estados');
  }
  return res.json() as Promise<IbgeEstado[]>;
}

export async function fetchIbgeMunicipios(ufSigla: string): Promise<IbgeMunicipio[]> {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(
    ufSigla,
  )}/municipios`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('IBGE municípios');
  }
  return res.json() as Promise<IbgeMunicipio[]>;
}
