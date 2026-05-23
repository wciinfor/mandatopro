import supabase from '@/lib/supabaseClient';

// ============================================================
// USUÁRIOS
// ============================================================

export async function criarUsuario(dados) {
  const { data, error } = await supabase
    .from('usuarios')
    .insert([dados])
    .select();

  if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
  return data;
}

export async function obterUsuarios(filtros = {}) {
  let query = supabase.from('usuarios').select('*');

  if (filtros.nivel) {
    query = query.eq('nivel', filtros.nivel);
  }
  if (filtros.status) {
    query = query.eq('status', filtros.status);
  }
  if (filtros.busca) {
    query = query.ilike('nome', `%${filtros.busca}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao obter usuários: ${error.message}`);
  return data;
}

export async function obterUsuarioPorId(id) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Erro ao obter usuário: ${error.message}`);
  return data;
}

export async function atualizarUsuario(id, dados) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(dados)
    .eq('id', id)
    .select();

  if (error) throw new Error(`Erro ao atualizar usuário: ${error.message}`);
  return data;
}

export async function deletarUsuario(id) {
  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Erro ao deletar usuário: ${error.message}`);
}

// ============================================================
// ELEITORES
// ============================================================

export async function criarEleitor(dados) {
  const { data, error } = await supabase
    .from('eleitores')
    .insert([dados])
    .select();

  if (error) throw new Error(`Erro ao criar eleitor: ${error.message}`);
  return data;
}

export async function obterEleitores(filtros = {}) {
  let query = supabase.from('eleitores').select('*');

  if (filtros.busca) {
    query = query.ilike('nome', `%${filtros.busca}%`);
  }
  if (filtros.cpf) {
    query = query.eq('cpf', filtros.cpf);
  }
  if (filtros.status) {
    query = query.eq('status', filtros.status);
  }
  if (filtros.lideranca_id) {
    query = query.eq('lideranca_id', filtros.lideranca_id);
  }
  if (filtros.cidade) {
    query = query.eq('cidade', filtros.cidade);
  }

  const { data, error } = await query.order('nome');
  if (error) throw new Error(`Erro ao obter eleitores: ${error.message}`);
  return data;
}

export async function obterEleitoresPorBairro(cidade, bairro) {
  const { data, error } = await supabase
    .from('eleitores')
    .select('*')
    .eq('cidade', cidade)
    .eq('bairro', bairro);

  if (error) throw new Error(`Erro ao obter eleitores: ${error.message}`);
  return data;
}

export async function atualizarEleitor(id, dados) {
  const { data, error } = await supabase
    .from('eleitores')
    .update(dados)
    .eq('id', id)
    .select();

  if (error) throw new Error(`Erro ao atualizar eleitor: ${error.message}`);
  return data;
}

// ============================================================
// SOLICITAÇÕES
// ============================================================

export async function criarSolicitacao(dados) {
  // Gera protocolo automático
  const protocolo = `SOL-${new Date().getFullYear()}-${Date.now()}`;
  
  const { data, error } = await supabase
    .from('solicitacoes')
    .insert([{ ...dados, protocolo }])
    .select();

  if (error) throw new Error(`Erro ao criar solicitação: ${error.message}`);
  return data;
}

export async function obterSolicitacoes(filtros = {}) {
  let query = supabase.from('solicitacoes').select('*');

  if (filtros.status) {
    query = query.eq('status', filtros.status);
  }
  if (filtros.prioridade) {
    query = query.eq('prioridade', filtros.prioridade);
  }
  if (filtros.busca) {
    query = query.ilike('titulo', `%${filtros.busca}%`);
  }

  const { data, error } = await query.order('data_abertura', { ascending: false });
  if (error) throw new Error(`Erro ao obter solicitações: ${error.message}`);
  return data;
}

export async function obterSolicitacaoPorProtocolo(protocolo) {
  const { data, error } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('protocolo', protocolo)
    .single();

  if (error) throw new Error(`Erro ao obter solicitação: ${error.message}`);
  return data;
}

export async function atualizarSolicitacao(id, dados) {
  const { data, error } = await supabase
    .from('solicitacoes')
    .update(dados)
    .eq('id', id)
    .select();

  if (error) throw new Error(`Erro ao atualizar solicitação: ${error.message}`);
  return data;
}

// ============================================================
// AGENDA
// ============================================================

export async function criarEvento(dados) {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .insert([dados])
    .select();

  if (error) throw new Error(`Erro ao criar evento: ${error.message}`);
  return data;
}

export async function obterEventos(filtros = {}) {
  let query = supabase.from('agenda_eventos').select('*');

  if (filtros.data) {
    query = query.eq('data', filtros.data);
  }
  if (filtros.tipo) {
    query = query.eq('tipo', filtros.tipo);
  }
  if (filtros.mes && filtros.ano) {
    const dataInicio = new Date(filtros.ano, filtros.mes - 1, 1).toISOString().split('T')[0];
    const dataFim = new Date(filtros.ano, filtros.mes, 0).toISOString().split('T')[0];
    query = query.gte('data', dataInicio).lte('data', dataFim);
  }

  const { data, error } = await query.order('data');
  if (error) throw new Error(`Erro ao obter eventos: ${error.message}`);
  return data;
}

export async function atualizarEvento(id, dados) {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .update(dados)
    .eq('id', id)
    .select();

  if (error) throw new Error(`Erro ao atualizar evento: ${error.message}`);
  return data;
}

// ============================================================
// LIDERANÇAS
// ============================================================

export async function criarLideranca(dados) {
  const { data, error } = await supabase
    .from('liderancas')
    .insert([dados])
    .select();

  if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
  return data;
}

export async function obterLiderancas(filtros = {}) {
  let query = supabase.from('liderancas').select('*');

  if (filtros.busca) {
    query = query.ilike('nome', `%${filtros.busca}%`);
  }
  if (filtros.status) {
    query = query.eq('status', filtros.status);
  }
  if (filtros.influencia) {
    query = query.eq('influencia', filtros.influencia);
  }

  const { data, error } = await query.order('nome');
  if (error) throw new Error(`Erro ao obter lideranças: ${error.message}`);
  return data;
}

// ============================================================
// MENSAGENS (COMUNICAÇÃO)
// ============================================================

export async function criarMensagem(dados) {
  const { data, error } = await supabase
    .from('comunicacao_mensagens')
    .insert([dados])
    .select();

  if (error) throw new Error(`Erro ao criar mensagem: ${error.message}`);
  return data;
}

export async function obterMensagensConversa(usuarioId1, usuarioId2) {
  const { data, error } = await supabase
    .from('comunicacao_mensagens')
    .select('*')
    .or(
      `and(remetente_id.eq.${usuarioId1},destinatario_id.eq.${usuarioId2}),and(remetente_id.eq.${usuarioId2},destinatario_id.eq.${usuarioId1})`
    )
    .order('data_hora', { ascending: true });

  if (error) throw new Error(`Erro ao obter mensagens: ${error.message}`);
  return data;
}

export async function marcarMensagenComoLida(remetenteId, destinatarioId) {
  const { error } = await supabase
    .from('comunicacao_mensagens')
    .update({ lida: true, data_leitura: new Date() })
    .eq('remetente_id', remetenteId)
    .eq('destinatario_id', destinatarioId)
    .eq('lida', false);

  if (error) throw new Error(`Erro ao atualizar mensagens: ${error.message}`);
}

// ============================================================
// LOGS DE AUDITORIA
// ============================================================

export async function registrarLogAuditoria(dados) {
  const { error } = await supabase
    .from('logs_auditoria')
    .insert([dados]);

  if (error) {
    console.error('Erro ao registrar log:', error.message);
    // Não lança erro para não afetar o fluxo principal
  }
}

export async function obterLogsAuditoria(filtros = {}) {
  let query = supabase.from('logs_auditoria').select('*');

  if (filtros.usuario_id) {
    query = query.eq('usuario_id', filtros.usuario_id);
  }
  if (filtros.modulo) {
    query = query.eq('modulo', filtros.modulo);
  }

  const { data, error } = await query
    .order('data_acao', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Erro ao obter logs: ${error.message}`);
  return data;
}

// ============================================================
// ESTATÍSTICAS DO DASHBOARD
// ============================================================

export async function obterEstatisticasDashboard() {
  try {
    const [usuarios, eleitores, solicitacoes, eventos] = await Promise.all([
      supabase.from('usuarios').select('id', { count: 'exact', head: true }),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('solicitacoes').select('id', { count: 'exact', head: true }),
      supabase.from('agenda_eventos').select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalUsuarios: usuarios.count || 0,
      totalEleitores: eleitores.count || 0,
      totalSolicitacoes: solicitacoes.count || 0,
      totalEventos: eventos.count || 0,
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error.message);
    return {
      totalUsuarios: 0,
      totalEleitores: 0,
      totalSolicitacoes: 0,
      totalEventos: 0,
    };
  }
}

export default {
  // Usuários
  criarUsuario,
  obterUsuarios,
  obterUsuarioPorId,
  atualizarUsuario,
  deletarUsuario,
  // Eleitores
  criarEleitor,
  obterEleitores,
  obterEleitoresPorBairro,
  atualizarEleitor,
  // Solicitações
  criarSolicitacao,
  obterSolicitacoes,
  obterSolicitacaoPorProtocolo,
  atualizarSolicitacao,
  // Agenda
  criarEvento,
  obterEventos,
  atualizarEvento,
  // Lideranças
  criarLideranca,
  obterLiderancas,
  // Mensagens
  criarMensagem,
  obterMensagensConversa,
  marcarMensagenComoLida,
  // Logs
  registrarLogAuditoria,
  obterLogsAuditoria,
  // Estatísticas
  obterEstatisticasDashboard,
};
