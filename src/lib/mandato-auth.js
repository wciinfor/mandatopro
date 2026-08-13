import { createServerClient } from '@/lib/supabase-server';

/**
 * Resolve e valida o contexto do Mandato Ativo para a requisição atual.
 *
 * @param {object} req - Next.js HTTP Request
 * @param {object} usuario - Objeto do Usuário Autenticado
 * @param {object} supabase - Instância do cliente Supabase Server
 * @returns {Promise<{ mandatoId: number, tipo: string, pertencimentosPermitidos: string[] }>}
 */
export async function obterContextoMandato(req, usuario, supabase) {
  if (!usuario) {
    throw { statusCode: 401, message: 'Usuário não autenticado' };
  }

  const clientSupabase = supabase || createServerClient();

  // 1. Obter mandatos aos quais o usuário tem acesso
  let userMandates = usuario.mandatos || [];
  if (usuario.nivel === 'ADMINISTRADOR') {
    userMandates = [1, 2];
  } else if (!userMandates.length) {
    const { data: vinculos } = await clientSupabase
      .from('usuarios_mandatos')
      .select('mandato_id')
      .eq('usuario_id', usuario.id);
    userMandates = (vinculos || []).map(v => v.mandato_id);
  }

  if (!userMandates.length) {
    userMandates = [1]; // Fallback seguro para Mandato Estadual caso usuário não tenha registros
  }

  // 2. Resolver o mandato solicitado na requisição (Header, Query ou Body)
  const headerMandato = req.headers['x-mandato-ativo'] || req.headers['x-mandato-id'];
  const queryMandato = req.query?.mandato_id || req.query?.mandatoId;
  const bodyMandato = req.body?.mandato_id || req.body?.mandatoId;

  let mandatoSolicitado = headerMandato || queryMandato || bodyMandato;

  if (!mandatoSolicitado) {
    mandatoSolicitado = usuario.mandatoAtivoId || userMandates[0];
  }

  const mandatoIdFinal = parseInt(mandatoSolicitado);

  // 3. Validar se o usuário tem autorização no mandato solicitado
  if (!userMandates.includes(mandatoIdFinal)) {
    throw {
      statusCode: 403,
      message: `Acesso negado: Você não possui autorização para operar o mandato ${mandatoIdFinal === 1 ? 'Estadual' : 'Federal'}`
    };
  }

  // 4. Mapear os pertencimentos elegíveis para este mandato
  const pertencimentosPermitidos = mandatoIdFinal === 2
    ? ['FEDERAL', 'AMBOS']
    : ['ESTADUAL', 'AMBOS'];

  const tipo = mandatoIdFinal === 2 ? 'FEDERAL' : 'ESTADUAL';

  return {
    mandatoId: mandatoIdFinal,
    tipo,
    pertencimentosPermitidos
  };
}

/**
 * Valida o acesso a um registro específico (Eleitor, Liderança, Campanha ou Atendimento) por ID.
 */
export async function validarAcessoRegistroPorId(tipoEntidade, registroId, contextoMandato, supabase) {
  const clientSupabase = supabase || createServerClient();
  const { mandatoId, pertencimentosPermitidos } = contextoMandato;

  if (tipoEntidade === 'ELEITOR') {
    const { data: eleitor, error } = await clientSupabase
      .from('eleitores')
      .select('id, pertencimento')
      .eq('id', parseInt(registroId))
      .maybeSingle();

    if (error || !eleitor) return { autorizado: false, status: 404, message: 'Eleitor não encontrado' };

    const pert = eleitor.pertencimento || 'NAO_CLASSIFICADO';
    if (!pertencimentosPermitidos.includes(pert)) {
      return { autorizado: false, status: 403, message: 'Acesso negado: Eleitor pertence a outro mandato' };
    }
    return { autorizado: true, registro: eleitor };
  }

  if (tipoEntidade === 'LIDERANCA') {
    const { data: lm, error } = await clientSupabase
      .from('liderancas_mandatos')
      .select('lideranca_id')
      .eq('lideranca_id', parseInt(registroId))
      .eq('mandato_id', mandatoId)
      .maybeSingle();

    if (error || !lm) {
      return { autorizado: false, status: 403, message: 'Acesso negado: Liderança não vinculada ao seu mandato ativo' };
    }
    return { autorizado: true };
  }

  if (tipoEntidade === 'CAMPANHA') {
    const { data: cm, error } = await clientSupabase
      .from('campanhas_mandatos')
      .select('campanha_id')
      .eq('campanha_id', registroId)
      .eq('mandato_id', mandatoId)
      .maybeSingle();

    if (error || !cm) {
      return { autorizado: false, status: 403, message: 'Acesso negado: Campanha não pertence ao seu mandato ativo' };
    }
    return { autorizado: true };
  }

  if (tipoEntidade === 'ATENDIMENTO') {
    const { data: atd, error } = await clientSupabase
      .from('atendimentos')
      .select('id, mandato_id')
      .eq('id', parseInt(registroId))
      .maybeSingle();

    if (error || !atd) return { autorizado: false, status: 404, message: 'Atendimento não encontrado' };

    if (atd.mandato_id && atd.mandato_id !== mandatoId) {
      return { autorizado: false, status: 403, message: 'Acesso negado: Atendimento pertence a outro mandato' };
    }
    return { autorizado: true, registro: atd };
  }

  return { autorizado: true };
}
