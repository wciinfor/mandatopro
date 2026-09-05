import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { exigirAcessoAtendimentoConnect } from '@/lib/atendimento-connect';
import { AtendimentoRelatoriosService } from '@/services/atendimentoRelatoriosService';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: `Metodo ${req.method} nao permitido` });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    exigirAcessoAtendimentoConnect(usuario);

    // Resolução segura do tenant_id autenticado no servidor
    const tenantId = usuario.tenant_id;
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Usuario sem tenant associado. Acesso negado aos relatorios.'
      });
    }

    // Extrai os filtros permitidos da query string
    const {
      dataInicio,
      dataFim,
      campanhaId,
      status,
      operadorId,
      metodoAtribuicao,
      provider
    } = req.query;

    const filtros = {
      dataInicio: dataInicio ? String(dataInicio).trim() : null,
      dataFim: dataFim ? String(dataFim).trim() : null,
      campanhaId: campanhaId ? String(campanhaId).trim() : null,
      status: status ? String(status).trim() : null,
      operadorId: operadorId ? String(operadorId).trim() : null,
      metodoAtribuicao: metodoAtribuicao ? String(metodoAtribuicao).trim() : null,
      provider: provider ? String(provider).trim() : null
    };

    const relatorio = await AtendimentoRelatoriosService.obterRelatorioConsolidado({
      supabase,
      tenantId,
      filtros
    });

    return res.status(200).json({
      success: true,
      data: relatorio
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('[API RELATORIOS ATENDIMENTO] Erro:', error);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro interno ao processar relatorio de atendimento'
    });
  }
}
