import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  console.log('[DEBUG-IBGE] Iniciando análise...');

  const supabase = createServerClient(req, res);

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    // Contar quantos id_municipio únicos existem
    const { data: allRecords, error } = await supabase
      .from('eleitores')
      .select('id_municipio');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Agrupar por id_municipio
    const municipioCount = new Map();
    const municipioExamples = new Map();

    for (const rec of allRecords) {
      const ibge = rec.id_municipio;
      const count = municipioCount.get(ibge) || 0;
      municipioCount.set(ibge, count + 1);

      if (!municipioExamples.has(ibge)) {
        municipioExamples.set(ibge, rec);
      }
    }

    // Top 20 códigos
    const sorted = Array.from(municipioCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    console.log('[DEBUG-IBGE] Distribuição de id_municipio (top 20):');
    sorted.forEach(([ibge, count]) => {
      console.log(`  ${ibge}: ${count} registros`);
    });

    console.log(`\n[DEBUG-IBGE] Total de códigos IBGE únicos: ${municipioCount.size}`);
    console.log(`[DEBUG-IBGE] Total de registros: ${allRecords.length}`);

    res.status(200).json({
      totalIbgeCodes: municipioCount.size,
      totalRecords: allRecords.length,
      topCodes: Object.fromEntries(sorted),
      distribution: Object.fromEntries(municipioCount)
    });

  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('[DEBUG-IBGE] Erro:', error);
    res.status(500).json({ error: error.message });
  }
}
