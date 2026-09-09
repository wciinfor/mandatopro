import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { resolverDetalhesFalhaMeta } from '@/lib/meta-errors';

/**
 * API Handler para obter os detalhes operacionais e estatísticas de execução de uma Comunicação Oficial.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { id } = req.query; // campaign_id de disparos oficiais

  if (!id) {
    return res.status(400).json({ success: false, error: 'ID da comunicação é obrigatório' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'Tenant não associado ao usuário autenticado.' });
    }

    // 1. Busca os metadados da comunicação garantindo isolamento de tenant
    const { data: campanha, error: errCamp } = await supabase
      .from('communication_campaigns')
      .select('*, communication_templates(nome), communication_audiences(nome, regras)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (errCamp || !campanha) {
      return res.status(404).json({ success: false, error: 'Comunicação oficial não localizada ou não pertence a este tenant.' });
    }

    // 2. Resolve a conta oficial de WhatsApp ativa e configurada (Defensivo)
    let contaOficial = null;
    try {
      const rowConta = await buscarContaWhatsappPrincipal(supabase, { tenant_id: tenantId });
      if (rowConta) {
        contaOficial = normalizarWhatsappAccount(rowConta);
      }
    } catch (errAccount) {
      console.warn('[DetalhesComunicacaoAPI] Aviso ao resolver conta WhatsApp oficial:', errAccount);
    }

    // 3. Resolve o nome da campanha do CRM se houver vínculo (Defensivo)
    const regrasAudience = campanha.communication_audiences?.regras || {};
    let nomeCampanhaCRM = null;
    if (regrasAudience.crm_campaign_id) {
      try {
        const { data: crmCamp } = await supabase
          .from('campanhas')
          .select('nome')
          .eq('id', regrasAudience.crm_campaign_id)
          .maybeSingle();
        if (crmCamp?.nome) {
          nomeCampanhaCRM = crmCamp.nome;
        }
      } catch (errCrm) {
        console.warn('[DetalhesComunicacaoAPI] Aviso ao resolver nome da campanha CRM:', errCrm);
      }
    }

    // Determina a string descritiva da Origem do Público
    let origemFormatada = 'Base de Dados';
    const origemTipo = regrasAudience.origem;
    if (origemTipo === 'campanha_politica') {
      origemFormatada = nomeCampanhaCRM ? `Campanha CRM: ${nomeCampanhaCRM}` : 'Campanha CRM (Ação Mandato)';
    } else if (origemTipo === 'base_geral') {
      const escopo = regrasAudience.filtros?.origem;
      if (escopo === 'liderancas') origemFormatada = 'Base Geral: Lideranças';
      else if (escopo === 'funcionarios') origemFormatada = 'Base Geral: Equipe / Gabinete';
      else origemFormatada = 'Base Geral: Eleitores';
    } else if (campanha.communication_audiences?.nome) {
      origemFormatada = campanha.communication_audiences.nome;
    }

    // Determina o nome amigável do Provider Oficial
    const providerRaw = String(contaOficial?.provider || 'META').toUpperCase();
    let providerFormatado = 'Meta Cloud API Oficial';
    if (providerRaw === 'WABLAST') providerFormatado = 'WaBlast Oficial';
    else if (providerRaw === 'YCLOUD') providerFormatado = 'YCloud Oficial';
    else if (providerRaw === 'META') providerFormatado = 'Meta Cloud API Oficial';

    // 4. Busca todos os itens da fila de execução associados (destinatários)
    const { data: itens, error: errItens } = await supabase
      .from('communication_campaign_items')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true });

    if (errItens) {
      console.error('[DetalhesComunicacaoAPI] Erro ao consultar itens da campanha:', errItens);
      throw errItens;
    }

    // 5. Consolida as estatísticas operacionais em tempo real utilizando exclusivamente os status atuais de communication_campaign_items
    let pendentes = 0;
    let processando = 0;
    let enviadas = 0;
    let entregues = 0;
    let lidas = 0;
    let falhas = 0;

    (itens || []).forEach(item => {
      const st = String(item?.status || '').toLowerCase();
      if (st === 'pendente') {
        pendentes++;
      } else if (st === 'processando') {
        processando++;
      } else if (st === 'falha' || st === 'falhou') {
        falhas++;
      } else if (st === 'lido' || st === 'lida') {
        lidas++;
      } else if (st === 'entregue') {
        entregues++;
      } else if (st === 'enviado' || st === 'enviada') {
        enviadas++;
      } else {
        pendentes++;
      }
    });

    const total = (itens || []).length;
    const processados = enviadas + entregues + lidas + falhas;
    const sucessos = enviadas + entregues + lidas;

    const taxaProgresso = total > 0 ? Number(((processados / total) * 100).toFixed(1)) : 0;
    const taxaSucesso = total > 0 ? Number(((sucessos / total) * 100).toFixed(1)) : 0;
    const taxaConclusao = taxaProgresso.toFixed(1);

    // Mapeamento defensivo dos destinatários sem deixar falha em helper individual derrubar o resultado
    const destinatariosMapeados = (itens || []).map(item => {
      let erroNormalizado = null;
      try {
        const st = String(item?.status || '').toLowerCase();
        const ehFalha = st === 'falha' || st === 'falhou';
        if (ehFalha) {
          erroNormalizado = resolverDetalhesFalhaMeta(item);
        }
      } catch (errHelper) {
        console.warn(`[DetalhesComunicacaoAPI] Aviso ao resolver erro do item ${item?.id}:`, errHelper);
      }

      return {
        id: item?.id,
        nome: item?.variaveis_mapeadas?.nome || 'Contato',
        telefone: item?.contact_id || '',
        status: item?.status || 'pendente',
        processado_em: item?.finished_at || item?.updated_at || null,
        error_code: item?.error_code || erroNormalizado?.errorCode || null,
        error_message: item?.error_message || erroNormalizado?.errorMessage || null,
        last_error: item?.last_error || null,
        erro_detalhes: erroNormalizado
      };
    });

    return res.status(200).json({
      success: true,
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        canal: campanha.canal,
        origem: origemFormatada,
        origemTipo: origemTipo || 'base_geral',
        nomeCampanhaCRM,
        template: campanha.communication_templates?.nome || 'Personalizado',
        publico: campanha.communication_audiences?.nome || 'Destinatários',
        status: campanha.status,
        agendamento: campanha.agendado_para,
        created_at: campanha.created_at,
        operador: 'Operador Geral',
        provider: providerFormatado,
        providerRaw: providerRaw,
        numeroOrigem: contaOficial?.displayPhoneNumber || contaOficial?.wablastDetails?.phoneNumber || '+55 91 8088-6129',
        wabaId: contaOficial?.wabaId || '1052344067413300'
      },
      metricas: {
        total,
        pendentes: pendentes + processando,
        pendentesPuros: pendentes,
        processando,
        enviadas,
        entregues,
        lidas,
        falhas,
        processados,
        sucessos,
        taxaProgresso,
        taxaSucesso,
        taxaConclusao
      },
      destinatarios: destinatariosMapeados,
      timeline: campanha.communication_audiences?.regras?.timeline || []
    });
  } catch (error) {
    console.error('[DetalhesComunicacaoAPI] Erro ao carregar informações da comunicação:', error);
    const statusCode = error?.statusCode || error?.status || 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.message || 'Não foi possível carregar os detalhes da comunicação oficial.'
    });
  }
}
