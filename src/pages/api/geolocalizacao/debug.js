import { createServerClient } from '@/lib/supabase-server';
import { limparCacheGeolocaliza } from './eleitores-mapa-calor';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();

    console.log('[DEBUG GEO] Iniciando debug de geolocalização...');

    // Carrega amostra de eleitores
    const { data: eleitores, error } = await supabase
      .from('eleitores')
      .select('id, municipio, cidade, uf, estado, id_municipio')
      .limit(50);

    if (error) throw error;

    console.log('[DEBUG GEO] Amostra de eleitores:');
    const amostraUnicos = new Map();
    for (const e of eleitores) {
      const chave = `${e.municipio || e.cidade} / ${e.id_municipio}`;
      if (!amostraUnicos.has(chave)) {
        amostraUnicos.set(chave, e);
      }
    }

    const sampleData = Array.from(amostraUnicos.values()).slice(0, 20);

    sampleData.forEach(e => {
      console.log('[DEBUG GEO] Eleitor:', {
        municipio: e.municipio,
        cidade: e.cidade,
        uf: e.uf,
        estado: e.estado,
        id_municipio: e.id_municipio
      });
    });

    // Conta municipios distintos
    const { data: distinctMunicipios, error: errorDist } = await supabase
      .rpc('obter_municipios_distintos_eleitores');

    console.log('[DEBUG GEO] Municipios distintos no banco:', distinctMunicipios?.length || 'N/A');

    return res.status(200).json({
      success: true,
      totalEleitorenesAmostra: eleitores.length,
      amostraUnica: sampleData,
      municipiosDistintos: distinctMunicipios?.length || 0
    });
  } catch (error) {
    console.error('[DEBUG GEO] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro desconhecido'
    });
  }
}
