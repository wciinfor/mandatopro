import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

const TOTAL_MUNICIPIOS_PA = 144; // Total de municípios do Estado do Pará

function normalizarTexto(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999).toISOString();
    const limite30Dias = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();

    // 1. Executar buscas em paralelo para performance agregada
    const [
      { data: eleitores, error: errEleitores },
      { data: liderancas, error: errLiderancas }
    ] = await Promise.all([
      supabase.from('eleitores').select('id, cidade, municipio, bairro, id_municipio, created_at'),
      supabase.from('liderancas').select('id, cidade, municipio, bairro')
    ]);

    if (errEleitores || errLiderancas) {
      throw errEleitores || errLiderancas;
    }

    // Mapa para agregar métricas por Município
    const municipiosMap = new Map();

    const getOuCriarMunicipio = (nomeRaw, idIbgeRaw) => {
      const nomeLimpo = String(nomeRaw || 'Não Especificado').trim();
      const key = normalizarTexto(nomeLimpo);

      if (!key) return null;

      if (!municipiosMap.has(key)) {
        municipiosMap.set(key, {
          nome: nomeLimpo,
          key,
          id_ibge: idIbgeRaw || null,
          totalEleitores: 0,
          cadastrosHoje: 0,
          cadastrosMes: 0,
          cadastrosMesAnterior: 0,
          liderancasCount: 0,
          ultimoCadastro: null
        });
      }
      return municipiosMap.get(key);
    };

    // Agrupar eleitores
    (eleitores || []).forEach((e) => {
      const nomeMun = e.cidade || e.municipio || e.bairro;
      const item = getOuCriarMunicipio(nomeMun, e.id_municipio);
      if (!item) return;

      item.totalEleitores += 1;

      if (e.created_at >= inicioHoje) {
        item.cadastrosHoje += 1;
      }
      if (e.created_at >= inicioMes) {
        item.cadastrosMes += 1;
      }
      if (e.created_at >= inicioMesAnterior && e.created_at <= fimMesAnterior) {
        item.cadastrosMesAnterior += 1;
      }

      if (!item.ultimoCadastro || new Date(e.created_at) > new Date(item.ultimoCadastro)) {
        item.ultimoCadastro = e.created_at;
      }
    });

    // Agrupar lideranças
    (liderancas || []).forEach((l) => {
      const nomeMun = l.cidade || l.municipio || l.bairro;
      const item = getOuCriarMunicipio(nomeMun, null);
      if (item) {
        item.liderancasCount += 1;
      }
    });

    // Converter para array e calcular percentual e classificação
    const listaMunicipios = Array.from(municipiosMap.values()).map((m) => {
      let percentualCrescimento = 0;
      if (m.cadastrosMesAnterior > 0) {
        percentualCrescimento = Math.round(((m.cadastrosMes - m.cadastrosMesAnterior) / m.cadastrosMesAnterior) * 100);
      } else if (m.cadastrosMes > 0) {
        percentualCrescimento = 100;
      }

      // Classificação automática:
      // 🟢 Crescimento: cadastrou hoje ou >0 no mês
      // 🟡 Estável: teve cadastros anteriores, mas 0 no mês
      // 🔴 Sem movimentação: sem cadastros nos últimos 30 dias ou nunca
      let classificacao = 'SEM_MOVIMENTACAO'; // 🔴 Sem movimentação
      if (m.cadastrosMes > 0 || m.cadastrosHoje > 0) {
        classificacao = 'CRESCIMENTO'; // 🟢 Crescimento
      } else if (m.ultimoCadastro && m.ultimoCadastro >= limite30Dias) {
        classificacao = 'ESTAVEL'; // 🟡 Estável
      }

      return {
        ...m,
        percentualCrescimento,
        classificacao
      };
    });

    // Métricas Territoriais Consolidadas
    const municipiosComPresenca = listaMunicipios.filter((m) => m.totalEleitores > 0).length;
    const coberturaTerritorialPercent = Math.min(100, Math.round((municipiosComPresenca / TOTAL_MUNICIPIOS_PA) * 100));
    
    const municipiosSemLideranca = listaMunicipios.filter((m) => m.totalEleitores > 0 && m.liderancasCount === 0).length;
    const municipiosSemMovimentacao30Dias = listaMunicipios.filter((m) => !m.ultimoCadastro || m.ultimoCadastro < limite30Dias).length;

    // Rankings (Top 10):
    // 1. Top 10 por total de eleitores
    const top10Eleitores = [...listaMunicipios]
      .sort((a, b) => b.totalEleitores - a.totalEleitores)
      .slice(0, 10);

    // 2. Top 10 que mais cresceram no mês
    const top10Crescimento = [...listaMunicipios]
      .sort((a, b) => b.cadastrosMes - a.cadastrosMes || b.percentualCrescimento - a.percentualCrescimento)
      .slice(0, 10);

    // 3. Top 10 sem novos cadastros há mais tempo
    const top10Estagnados = [...listaMunicipios]
      .sort((a, b) => {
        if (!a.ultimoCadastro && !b.ultimoCadastro) return 0;
        if (!a.ultimoCadastro) return -1;
        if (!b.ultimoCadastro) return 1;
        return new Date(a.ultimoCadastro) - new Date(b.ultimoCadastro);
      })
      .slice(0, 10);

    return res.status(200).json({
      metricasTerritoriais: {
        totalMunicipiosPA: TOTAL_MUNICIPIOS_PA,
        municipiosComPresenca,
        coberturaTerritorialPercent,
        municipiosSemLideranca,
        municipiosSemMovimentacao30Dias
      },
      municipios: listaMunicipios,
      top10Eleitores,
      top10Crescimento,
      top10Estagnados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API Live Mapa de Calor:', error);
    return res.status(500).json({
      error: 'Erro ao processar dados do mapa de calor da base eleitoral',
      details: error.message
    });
  }
}
