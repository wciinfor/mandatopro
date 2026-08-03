import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const { filtro = 'MES' } = req.query; // 'HOJE' | 'SEMANA' | 'MES' | 'ANO'

    const agora = new Date();
    
    // Início de hoje (00:00:00)
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();

    // Início do mês (Dia 1, 00:00:00)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

    // 1. Buscar todas as lideranças cadastradas no sistema
    const { data: liderancas, error: errLiderancas } = await supabase
      .from('liderancas')
      .select('id, nome, foto, cidade, municipio, bairro');

    if (errLiderancas) {
      console.error('Erro ao buscar lideranças para performance:', errLiderancas);
      throw errLiderancas;
    }

    const totalLiderancas = liderancas?.length || 0;

    if (totalLiderancas === 0) {
      return res.status(200).json({
        metricas: {
          totalLiderancas: 0,
          liderancasAtivas: 0,
          liderancasInativas: 0,
          mediaCadastros: 0
        },
        topLiderancas: [],
        liderancasEmRisco: [],
        timestamp: new Date().toISOString()
      });
    }

    // 2. Buscar todos os eleitores que possuem vínculo com liderança (lideranca_id ou lideranca por nome)
    // Trazemos id, lideranca, lideranca_id e created_at em única query agregada em memória para alta performance
    const { data: eleitores, error: errEleitores } = await supabase
      .from('eleitores')
      .select('id, lideranca, lideranca_id, created_at')
      .order('created_at', { ascending: false });

    if (errEleitores) {
      console.error('Erro ao buscar eleitores para performance de lideranças:', errEleitores);
      throw errEleitores;
    }

    // Mapear contagens por liderança
    const statsPorLider = new Map();

    // Inicializar mapa com todas as lideranças
    liderancas.forEach((l) => {
      statsPorLider.set(String(l.id), {
        id: l.id,
        nome: l.nome,
        foto: l.foto || null,
        municipio: l.municipio || l.cidade || l.bairro || 'Não informado',
        totalCadastros: 0,
        cadastrosHoje: 0,
        cadastrosMes: 0,
        ultimoCadastro: null
      });
    });

    // Criar índice secundário por Nome para vincular liderança caso lideranca_id esteja nulo
    const liderPorNomeIndex = new Map();
    liderancas.forEach((l) => {
      if (l.nome) {
        liderPorNomeIndex.set(l.nome.trim().toLowerCase(), String(l.id));
      }
    });

    // Processar os eleitores e agrupar métricas
    (eleitores || []).forEach((e) => {
      let liderId = e.lideranca_id ? String(e.lideranca_id) : null;

      if (!liderId && e.lideranca) {
        liderId = liderPorNomeIndex.get(String(e.lideranca).trim().toLowerCase()) || null;
      }

      if (liderId && statsPorLider.has(liderId)) {
        const item = statsPorLider.get(liderId);
        item.totalCadastros += 1;

        if (e.created_at >= inicioHoje) {
          item.cadastrosHoje += 1;
        }

        if (e.created_at >= inicioMes) {
          item.cadastrosMes += 1;
        }

        if (!item.ultimoCadastro || new Date(e.created_at) > new Date(item.ultimoCadastro)) {
          item.ultimoCadastro = e.created_at;
        }
      }
    });

    // Converter para array
    const listaPerformances = Array.from(statsPorLider.values());

    // Calcular Métricas Consolidadas
    const liderancasAtivas = listaPerformances.filter((l) => l.cadastrosMes > 0).length;
    const liderancasInativas = totalLiderancas - liderancasAtivas;
    const totalCadastrosGeral = listaPerformances.reduce((acc, l) => acc + l.totalCadastros, 0);
    const mediaCadastros = totalLiderancas > 0 ? (totalCadastrosGeral / totalLiderancas).toFixed(1) : 0;

    // Adicionar indicador visual de tendência:
    // 🟢 Crescendo (Cadastrou hoje ou >3 no mês)
    // 🟡 Estável (Cadastrou no mês <=3)
    // 🔴 Sem atividade (0 cadastros no mês)
    const listaComTendencia = listaPerformances.map((l) => {
      let tendencia = 'INATIVA'; // 🔴 Sem atividade
      if (l.cadastrosHoje > 0 || l.cadastrosMes > 3) {
        tendencia = 'CRESCENDO'; // 🟢 Crescendo
      } else if (l.cadastrosMes > 0) {
        tendencia = 'ESTAVEL'; // 🟡 Estável
      }

      return {
        ...l,
        tendencia
      };
    });

    // 🏆 Top 5 Lideranças do mês (ordenadas por cadastros no mês, depois total)
    const topLiderancas = [...listaComTendencia]
      .sort((a, b) => b.cadastrosMes - a.cadastrosMes || b.totalCadastros - a.totalCadastros)
      .slice(0, 5);

    // ⚠️ 5 Lideranças há mais tempo sem cadastrar eleitores
    // Prioriza inativas e ordena pela data do último cadastro mais antiga (ou nula)
    const liderancasEmRisco = [...listaComTendencia]
      .sort((a, b) => {
        if (!a.ultimoCadastro && !b.ultimoCadastro) return 0;
        if (!a.ultimoCadastro) return -1;
        if (!b.ultimoCadastro) return 1;
        return new Date(a.ultimoCadastro) - new Date(b.ultimoCadastro);
      })
      .slice(0, 5);

    return res.status(200).json({
      filtroAplicado: filtro,
      metricas: {
        totalLiderancas,
        liderancasAtivas,
        liderancasInativas,
        mediaCadastros: Number(mediaCadastros)
      },
      topLiderancas,
      liderancasEmRisco,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint Live Lideranças Performance:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar performance das lideranças',
      details: error.message
    });
  }
}
