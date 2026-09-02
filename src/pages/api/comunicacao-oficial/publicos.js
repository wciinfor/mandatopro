import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { contarContatosMandatoPro } from '@/lib/disparos/mandatopro-contatos';

export const runtime = 'nodejs';

/**
 * API REST para gerenciamento de Públicos / Audiências (communication_audiences).
 * Suporta GET (listar com contagem real), POST (criar audiência) e DELETE (excluir).
 */
export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const tenantId = usuario.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant não associado ao usuário.' });
    }

    // ─── GET: Listar públicos do tenant ──────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: audiencias, error } = await supabase
        .from('communication_audiences')
        .select('id, nome, regras, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Calcula a quantidade real de contatos qualificados para cada público
      const publicosComContagem = await Promise.all(
        (audiencias || []).map(async (aud) => {
          const regras = aud.regras || {};
          const filtros = regras.filtros || regras || {};

          let contatosCount = 0;
          try {
            const resumo = await contarContatosMandatoPro(supabase, {
              origem: filtros.origem || regras.origem || 'eleitores',
              cidade: filtros.cidade,
              bairro: filtros.bairro,
              status: filtros.status || filtros.situacao,
              search: filtros.search,
              campanhaId: filtros.campanhaId || regras.crm_campaign_id,
              presencaCampanha: filtros.presencaCampanha
            });
            contatosCount = Number(resumo?.total || 0);
          } catch (e) {
            console.warn(`[PublicosAPI] Aviso ao contar contatos da audiência ${aud.id}:`, e.message);
          }

          return {
            id: aud.id,
            nome: aud.nome,
            descricao: regras.descricao || `Audiência baseada em ${regras.origem || 'Filtro Dinâmico'}`,
            canal: regras.canal || 'whatsapp',
            quantidade_contatos: contatosCount,
            origem: regras.origem || 'Filtro Dinâmico',
            ultima_atualizacao: aud.updated_at || aud.created_at,
            filtros_ativos: filtros,
            regras: aud.regras
          };
        })
      );

      return res.status(200).json(publicosComContagem);
    }

    // ─── POST: Criar nova audiência ──────────────────────────────────────────────
    if (req.method === 'POST') {
      const { nome, regras, descricao, canal } = req.body || {};

      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        return res.status(400).json({ success: false, message: 'O campo nome é obrigatório.' });
      }

      const regrasPayload = typeof regras === 'object' && regras !== null ? regras : {};
      if (descricao) regrasPayload.descricao = descricao;
      if (canal) regrasPayload.canal = canal;

      const { data: novoPublico, error } = await supabase
        .from('communication_audiences')
        .insert({
          tenant_id: tenantId,
          nome: nome.trim(),
          regras: regrasPayload
        })
        .select('id, nome, regras, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        data: {
          id: novoPublico.id,
          nome: novoPublico.nome,
          descricao: novoPublico.regras?.descricao || '',
          canal: novoPublico.regras?.canal || 'whatsapp',
          quantidade_contatos: 0,
          origem: novoPublico.regras?.origem || 'Filtro Dinâmico',
          ultima_atualizacao: novoPublico.updated_at || novoPublico.created_at,
          filtros_ativos: novoPublico.regras?.filtros || novoPublico.regras || {},
          regras: novoPublico.regras
        }
      });
    }

    // ─── DELETE: Excluir audiência ──────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;

      if (!id) {
        return res.status(400).json({ success: false, message: 'O ID do público é obrigatório.' });
      }

      // Validação explícita de isolamento por tenant_id
      const { data: audExistente, error: errBusca } = await supabase
        .from('communication_audiences')
        .select('id, tenant_id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (errBusca || !audExistente) {
        return res.status(404).json({ success: false, message: 'Público não encontrado ou não pertence a este tenant.' });
      }

      const { error: errDel } = await supabase
        .from('communication_audiences')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (errDel) {
        throw errDel;
      }

      return res.status(200).json({ success: true, message: 'Público excluído com sucesso.' });
    }

    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  } catch (error) {
    console.error('[PublicosAPI] Erro ao processar requisição:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro interno no servidor ao gerenciar públicos.'
    });
  }
}
