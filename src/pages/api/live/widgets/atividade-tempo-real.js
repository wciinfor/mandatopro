import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

/**
 * Retorna tempo relativo amigável (ex: "há 2 min", "há 1h")
 */
function calcularTempoRelativo(isoString) {
  if (!isoString) return 'agora';
  const diffMs = new Date().getTime() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  return `há ${diffDias}d`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    // Buscar em paralelo nas entidades do MandatoPRO os últimos eventos ocorridos
    const [
      { data: eleitores },
      { data: liderancas },
      { data: atendimentos },
      { data: solicitacoes },
      { data: campanhas }
    ] = await Promise.all([
      // 1. Eleitores recém cadastrados
      supabase.from('eleitores')
        .select('id, nome, cidade, municipio, bairro, lideranca, created_at')
        .order('created_at', { ascending: false })
        .limit(40),

      // 2. Lideranças recém cadastradas
      supabase.from('liderancas')
        .select('id, nome, cidade, municipio, bairro, created_at')
        .order('created_at', { ascending: false })
        .limit(30),

      // 3. Atendimentos (iniciados/concluídos)
      supabase.from('atendimentos')
        .select('id, assunto, status, data_atendimento, created_at, eleitores(nome, cidade, municipio, bairro)')
        .order('created_at', { ascending: false })
        .limit(40),

      // 4. Solicitações (criadas/concluídas)
      supabase.from('solicitacoes')
        .select('id, titulo, status, created_at, updated_at, municipio')
        .order('created_at', { ascending: false })
        .limit(30),

      // 5. Campanhas (criadas/finalizadas)
      supabase.from('campanhas')
        .select('id, nome, status, local, data_campanha, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    // Mapear eventos padronizados
    const eventosBrutos = [];

    // Eleitores
    (eleitores || []).forEach((e) => {
      eventosBrutos.push({
        id: `eleitor-${e.id}`,
        tipo: 'NOVO_ELEITOR',
        categoria: 'Cadastros',
        icone: 'faUserPlus',
        cor: 'teal',
        descricao: `Novo eleitor ${e.nome} cadastrado`,
        municipio: e.cidade || e.municipio || e.bairro || 'Local não informado',
        lideranca: e.lideranca || null,
        usuario: 'Gabinete',
        dataHora: e.created_at || new Date().toISOString()
      });
    });

    // Lideranças
    (liderancas || []).forEach((l) => {
      eventosBrutos.push({
        id: `lideranca-${l.id}`,
        tipo: 'NOVA_LIDERANCA',
        categoria: 'Lideranças',
        icone: 'faUserTie',
        cor: 'amber',
        descricao: `Nova liderança ${l.nome} vinculada`,
        municipio: l.cidade || l.municipio || l.bairro || 'Local não informado',
        lideranca: l.nome,
        usuario: 'Gabinete',
        dataHora: l.created_at || new Date().toISOString()
      });
    });

    // Atendimentos
    (atendimentos || []).forEach((a) => {
      const nomeEleitor = a.eleitores?.nome ? ` para ${a.eleitores.nome}` : '';
      const mun = a.eleitores?.cidade || a.eleitores?.municipio || a.eleitores?.bairro || 'Local não informado';
      const isConcluido = a.status === 'REALIZADO';

      eventosBrutos.push({
        id: `atendimento-${a.id}`,
        tipo: isConcluido ? 'ATENDIMENTO_CONCLUIDO' : 'ATENDIMENTO_INICIADO',
        categoria: 'Atendimentos',
        icone: isConcluido ? 'faCheckCircle' : 'faHandsHelping',
        cor: isConcluido ? 'emerald' : 'blue',
        descricao: `Atendimento "${a.assunto || 'Geral'}" ${isConcluido ? 'concluído' : 'iniciado'}${nomeEleitor}`,
        municipio: mun,
        lideranca: null,
        usuario: 'Equipe de Atendimento',
        dataHora: a.created_at || a.data_atendimento || new Date().toISOString()
      });
    });

    // Solicitações
    (solicitacoes || []).forEach((s) => {
      const isConcluido = s.status === 'ATENDIDO';
      eventosBrutos.push({
        id: `solicitacao-${s.id}`,
        tipo: isConcluido ? 'SOLICITACAO_CONCLUIDA' : 'SOLICITACAO_CRIADA',
        categoria: 'Atendimentos',
        icone: isConcluido ? 'faCheckDouble' : 'faClipboardList',
        cor: isConcluido ? 'emerald' : 'sky',
        descricao: `Solicitação "${s.titulo || 'Gabinete'}" ${isConcluido ? 'concluída' : 'registrada'}`,
        municipio: s.municipio || 'Gabinete',
        lideranca: null,
        usuario: 'Gabinete',
        dataHora: s.updated_at || s.created_at || new Date().toISOString()
      });
    });

    // Campanhas
    (campanhas || []).forEach((c) => {
      const isFinalizada = c.status === 'CONCLUIDA' || c.status === 'FINALIZADA';
      eventosBrutos.push({
        id: `campanha-${c.id}`,
        tipo: isFinalizada ? 'CAMPANHA_FINALIZADA' : 'CAMPANHA_CRIADA',
        categoria: 'Campanhas',
        icone: 'faBullhorn',
        cor: 'purple',
        descricao: `Campanha "${c.nome}" ${isFinalizada ? 'finalizada' : 'criada'}`,
        municipio: c.local || 'Gabinete',
        lideranca: null,
        usuario: 'Coordenação de Campanha',
        dataHora: c.created_at || new Date().toISOString()
      });
    });

    // 2. Ordenar todos os eventos cronologicamente (do mais recente para o mais antigo)
    eventosBrutos.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    // 3. Agrupamento Automático Inteligente de Eventos Repetitivos
    // Janela de agrupamento: 5 minutos (300.000 ms)
    const JANELA_AGRUPAMENTO_MS = 5 * 60 * 1000;
    const eventosProcessados = [];

    for (let i = 0; i < eventosBrutos.length; i++) {
      const atual = eventosBrutos[i];
      let grupoContador = 1;
      let j = i + 1;

      // Agrupar eventos do mesmo tipo e mesmo município na mesma janela de tempo
      while (j < eventosBrutos.length) {
        const proximo = eventosBrutos[j];
        const diffTempo = Math.abs(new Date(atual.dataHora).getTime() - new Date(proximo.dataHora).getTime());

        if (
          proximo.tipo === atual.tipo &&
          proximo.municipio === atual.municipio &&
          diffTempo <= JANELA_AGRUPAMENTO_MS
        ) {
          grupoContador++;
          j++;
        } else {
          break;
        }
      }

      // Se encontrou agrupamento (ex: >1 evento do mesmo tipo)
      if (grupoContador > 1) {
        let descricaoAgrupada = '';
        if (atual.tipo === 'NOVO_ELEITOR') {
          descricaoAgrupada = `${grupoContador} novos eleitores cadastrados em ${atual.municipio} nos últimos minutos`;
        } else if (atual.tipo === 'NOVA_LIDERANCA') {
          descricaoAgrupada = `${grupoContador} novas lideranças cadastradas em ${atual.municipio}`;
        } else if (atual.tipo === 'ATENDIMENTO_INICIADO') {
          descricaoAgrupada = `${grupoContador} novos atendimentos iniciados em ${atual.municipio}`;
        } else {
          descricaoAgrupada = `${grupoContador} atividades de ${atual.categoria.toLowerCase()} registradas em ${atual.municipio}`;
        }

        eventosProcessados.push({
          ...atual,
          id: `grupo-${atual.id}-${grupoContador}`,
          descricao: descricaoAgrupada,
          isAgrupado: true,
          quantidadeAgrupada: grupoContador
        });

        // Pula os itens que foram agrupados
        i = j - 1;
      } else {
        eventosProcessados.push(atual);
      }
    }

    // Limitar rigorosamente aos últimos 100 eventos
    const lista100Eventos = eventosProcessados.slice(0, 100).map((ev) => {
      const diffMs = new Date().getTime() - new Date(ev.dataHora).getTime();
      const recente5Min = diffMs <= (5 * 60 * 1000);

      return {
        ...ev,
        tempoRelativo: calcularTempoRelativo(ev.dataHora),
        recente5Min
      };
    });

    return res.status(200).json({
      totalEventos: lista100Eventos.length,
      eventos: lista100Eventos,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no endpoint Live Atividade Tempo Real:', error);
    return res.status(500).json({
      error: 'Erro ao consolidar atividades em tempo real',
      details: error.message
    });
  }
}
