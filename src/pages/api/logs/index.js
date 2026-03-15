import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const obterIP = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0] ||
  req.headers['x-real-ip'] ||
  req.socket?.remoteAddress ||
  'desconhecido';

const validarAdmin = (req) => {
  try {
    const raw = req.headers['usuario'];
    if (!raw) return null;
    const usuario = JSON.parse(raw);
    return usuario?.nivel === 'ADMINISTRADOR' ? usuario : null;
  } catch {
    return null;
  }
};

// Mapeia os campos do banco para o formato esperado pelo frontend
const mapearLog = (log) => ({
  id: String(log.id),
  tipoEvento: log.acao,
  modulo: log.modulo || '',
  descricao: log.descricao || '',
  status: log.status || 'SUCESSO',
  enderecoIP: log.ip_address || '',
  agenteBrowser: log.user_agent || '',
  usuarioNome: log.usuarios?.nome || '',
  usuarioEmail: log.usuarios?.email || '',
  dados: log.dados_novos || {},
  dadosAnteriores: log.dados_anteriores || {},
  timestamp: log.data_acao,
  dataLocal: log.data_acao
    ? new Date(log.data_acao).toLocaleString('pt-BR')
    : ''
});

export default async function handler(req, res) {
  const supabase = createServerClient();

  // GET â€” listar logs (admin only)
  if (req.method === 'GET') {
    const admin = validarAdmin(req);
    if (!admin) {
      return res.status(403).json({ erro: 'Acesso negado. Apenas administradores podem acessar logs.' });
    }

    try {
      // PaginaÃ§Ã£o
      const pagina = parseInt(req.query.pagina) || 1;
      const limite = parseInt(req.query.limite) || 50;
      const offset = (pagina - 1) * limite;

      let query = supabase
        .from('logs_auditoria')
        .select('*, usuarios:usuario_id(nome, email)', { count: 'exact' });

      if (req.query.tipoEvento) query = query.eq('acao', req.query.tipoEvento);
      if (req.query.modulo) query = query.eq('modulo', req.query.modulo);
      if (req.query.status) query = query.eq('status', req.query.status);
      if (req.query.dataInicio) query = query.gte('data_acao', req.query.dataInicio);
      if (req.query.dataFim) query = query.lte('data_acao', req.query.dataFim + 'T23:59:59');
      if (req.query.usuarioId) {
        // Busca por nome ou email (frontend envia string de busca neste campo)
        query = query.or(
          `usuarios.nome.ilike.%${req.query.usuarioId}%,usuarios.email.ilike.%${req.query.usuarioId}%`
        );
      }
      if (req.query.busca) {
        query = query.or(
          `descricao.ilike.%${req.query.busca}%`
        );
      }

      const { data, error, count } = await query
        .order('data_acao', { ascending: false })
        .range(offset, offset + limite - 1);

      if (error) throw error;

      const totalPaginas = Math.ceil((count || 0) / limite);

      return res.status(200).json({
        sucesso: true,
        logs: (data || []).map(mapearLog),
        paginacao: { pagina, limite, total: count || 0, totalPaginas }
      });
    } catch (error) {
      return res.status(500).json({ erro: 'Erro ao recuperar logs', detalhes: error.message });
    }
  }

  // POST â€” registrar novo log
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const statusValido = ['SUCESSO', 'ERRO', 'AVISO'].includes(body.status)
        ? body.status
        : 'SUCESSO';

      const payload = {
        usuario_id: body.usuarioId ? parseInt(body.usuarioId, 10) : null,
        acao: body.tipoEvento || body.acao || 'ACESSO',
        modulo: body.modulo || null,
        descricao: body.descricao || null,
        ip_address: obterIP(req),
        user_agent: body.agenteBrowser || req.headers['user-agent'] || null,
        dados_novos: body.dados || null,
        status: statusValido,
        data_acao: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('logs_auditoria')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;

      return res.status(201).json({ sucesso: true, id: String(data?.id) });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
      return res.status(500).json({ erro: 'Erro ao registrar log', detalhes: error.message });
    }
  }

  // DELETE â€” limpar logs antigos (admin only)
  if (req.method === 'DELETE') {
    const admin = validarAdmin(req);
    if (!admin) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    const diasRetencao = parseInt(req.query.diasRetencao);
    if (!diasRetencao || isNaN(diasRetencao)) {
      return res.status(400).json({ erro: 'ParÃ¢metro diasRetencao obrigatÃ³rio' });
    }

    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasRetencao);

      // Conta quantos serÃ£o removidos
      const { count } = await supabase
        .from('logs_auditoria')
        .select('*', { count: 'exact', head: true })
        .lt('data_acao', dataLimite.toISOString());

      const { error } = await supabase
        .from('logs_auditoria')
        .delete()
        .lt('data_acao', dataLimite.toISOString());

      if (error) throw error;

      return res.status(200).json({
        sucesso: true,
        removidos: count || 0,
        mensagem: `${count || 0} logs removidos (mais antigos que ${diasRetencao} dias)`
      });
    } catch (error) {
      return res.status(500).json({ erro: 'Erro ao deletar logs', detalhes: error.message });
    }
  }

  return res.status(405).json({ erro: 'M\u00e9todo n\u00e3o permitido' });
}
