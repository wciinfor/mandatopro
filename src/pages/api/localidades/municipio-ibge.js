import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cachePorUf = new Map();
let cacheTodos = null;

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isCacheValido(entry) {
  return entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

function extrairUfMunicipio(municipio) {
  return (
    municipio?.microrregiao?.mesorregiao?.UF?.sigla ||
    municipio?.regiaoImediata?.regiaoIntermediaria?.UF?.sigla ||
    null
  );
}

async function carregarMunicipiosPorUf(uf) {
  const ufUpper = normalizeText(uf);
  const cacheHit = cachePorUf.get(ufUpper);

  if (isCacheValido(cacheHit)) {
    return cacheHit.data;
  }

  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufUpper}/municipios`);

  if (!response.ok) {
    throw new Error(`Falha ao consultar municipios do IBGE para UF ${ufUpper}`);
  }

  const data = await response.json();
  const municipios = Array.isArray(data)
    ? data.map((item) => ({
        id: Number(item.id),
        nome: item.nome,
        uf: ufUpper
      }))
    : [];

  cachePorUf.set(ufUpper, {
    ts: Date.now(),
    data: municipios
  });

  return municipios;
}

async function carregarTodosMunicipios() {
  if (isCacheValido(cacheTodos)) {
    return cacheTodos.data;
  }

  const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');

  if (!response.ok) {
    throw new Error('Falha ao consultar municipios do IBGE');
  }

  const data = await response.json();
  const municipios = Array.isArray(data)
    ? data.map((item) => ({
        id: Number(item.id),
        nome: item.nome,
        uf: extrairUfMunicipio(item)
      }))
    : [];

  cacheTodos = {
    ts: Date.now(),
    data: municipios
  };

  return municipios;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const municipio = String(req.query?.municipio || '').trim();
    const uf = String(req.query?.uf || '').trim();

    if (!municipio || municipio.length < 2) {
      return res.status(400).json({ error: 'Parametro municipio obrigatorio' });
    }

    const municipioNormalizado = normalizeText(municipio);

    let candidatos;

    if (uf) {
      candidatos = await carregarMunicipiosPorUf(uf);
    } else {
      candidatos = await carregarTodosMunicipios();
    }

    const exato = candidatos.find(
      (item) => normalizeText(item.nome) === municipioNormalizado
    );

    if (exato) {
      return res.status(200).json({
        id_municipio: exato.id,
        municipio: exato.nome,
        uf: exato.uf,
        source: 'ibge'
      });
    }

    const aproximado = candidatos.find((item) => {
      const nomeItem = normalizeText(item.nome);
      return nomeItem.startsWith(municipioNormalizado) || municipioNormalizado.startsWith(nomeItem);
    });

    if (aproximado) {
      return res.status(200).json({
        id_municipio: aproximado.id,
        municipio: aproximado.nome,
        uf: aproximado.uf,
        source: 'ibge-approx'
      });
    }

    return res.status(404).json({ error: 'Municipio nao encontrado no IBGE' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno ao consultar IBGE' });
  }
}
