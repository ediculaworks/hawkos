const BASE_URL = 'https://brasilapi.com.br/api';

export interface CepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

export interface CnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    pais: string;
  };
  telefone: string | null;
  email: string | null;
  capital_social: number;
  porte: string;
  natureza_juridica: string;
}

export interface Bank {
  ispb: string;
  name: string;
  code: number | null;
  fullName: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: string;
}

export interface Uf {
  id: number;
  sigla: string;
  nome: string;
  regiao: {
    id: number;
    sigla: string;
    nome: string;
  };
}

export interface Municipio {
  id: number;
  nome: string;
  municipio: {
    id: number;
    nome: string;
    microrregiao: {
      id: number;
      nome: string;
      mesorregiao: {
        id: number;
        nome: string;
        UF: Uf;
      };
    };
  };
}

export async function fetchCep(cep: string): Promise<CepResponse> {
  const clean = cep.replace(/\D/g, '');
  const res = await fetch(`${BASE_URL}/cep/v2/${clean}`);
  if (!res.ok) throw new Error(`CEP not found: ${cep}`);
  return res.json() as Promise<CepResponse>;
}

export async function fetchCnpj(cnpj: string): Promise<CnpjResponse> {
  const clean = cnpj.replace(/\D/g, '');
  const res = await fetch(`${BASE_URL}/cnpj/v1/${clean}`);
  if (!res.ok) throw new Error(`CNPJ not found: ${cnpj}`);
  return res.json() as Promise<CnpjResponse>;
}

export async function fetchBanks(): Promise<Bank[]> {
  const res = await fetch(`${BASE_URL}/banks/v1`);
  if (!res.ok) throw new Error('Failed to fetch banks');
  return res.json() as Promise<Bank[]>;
}

export async function fetchHolidays(year: number): Promise<Holiday[]> {
  const res = await fetch(`${BASE_URL}/holidays/v1/${year}`);
  if (!res.ok) throw new Error(`Failed to fetch holidays for ${year}`);
  return res.json() as Promise<Holiday[]>;
}

export async function fetchIbgeUfs(): Promise<Uf[]> {
  const res = await fetch(`${BASE_URL}/ibge/uf/v1`);
  if (!res.ok) throw new Error('Failed to fetch UFs');
  return res.json() as Promise<Uf[]>;
}

export async function fetchIbgeMunicipios(uf: string): Promise<Municipio[]> {
  const res = await fetch(`${BASE_URL}/ibge/municipios/v1/${uf}?providers=ibge`);
  if (!res.ok) throw new Error(`Failed to fetch municipios for ${uf}`);
  return res.json() as Promise<Municipio[]>;
}
