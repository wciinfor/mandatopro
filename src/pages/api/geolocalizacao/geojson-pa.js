import fs from 'fs/promises';
import path from 'path';
import simplify from '@turf/simplify';
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
let baseGeojson = null;

function normalizarTolerancia(value) {
  const parsed = Number.parseFloat(String(value || '0.0018'));
  if (!Number.isFinite(parsed) || parsed < 0) return 0.0018;
  return Math.min(parsed, 0.02);
}

async function carregarBaseGeojson() {
  if (baseGeojson) return baseGeojson;

  const arquivo = path.join(process.cwd(), 'public', 'data', 'geo', 'pa-municipios.geojson');
  const conteudo = await fs.readFile(arquivo, 'utf8');
  const json = JSON.parse(conteudo);

  baseGeojson = json;
  return baseGeojson;
}

function compactarPropriedades(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];

  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      type: 'Feature',
      properties: {
        id: String(feature?.properties?.id || ''),
        name: String(feature?.properties?.name || ''),
      },
      geometry: feature?.geometry || null,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const tolerance = normalizarTolerancia(req.query?.tolerance);
    const key = `tol:${tolerance}`;
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expireAt > now) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      return res.status(200).json(cached.data);
    }

    const base = await carregarBaseGeojson();
    const simplificado = simplify(base, {
      tolerance,
      highQuality: false,
      mutate: false,
    });

    const payload = compactarPropriedades(simplificado);
    cache.set(key, {
      expireAt: now + CACHE_TTL_MS,
      data: payload,
    });

    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: 'Falha ao carregar GeoJSON simplificado',
      detalhes: error?.message || 'Erro desconhecido',
    });
  }
}
