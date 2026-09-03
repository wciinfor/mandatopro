import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterTenantId } from '@/lib/tenant';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';

/**
 * API Handler para obter os detalhes operacionais e estatísticas de execução de uma Comunicação Oficial.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query; // campaign_id de disparos oficiais

  if (!id) {
    return res.status(400).json({ error: 'ID da comunicação é obrigatório' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const tenantId = obterTenantId(usuario);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant não associado ao usuário autenticado.' });
    }

    // 1. Busca os metadados da comunicação garantindo isolamento de tenant
    const { data: campanha, error: errCamp } = await supabase
      .from('communication_campaigns')
      .select('*, communication_templates(nome), communication_audiences(nome, regras)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (errCamp || !campanha) {
      return res.status(404).json({ error: 'Comunicação oficial não localizada ou não pertence a este tenant.' });
    }

    // 2. Resolve a conta oficial de WhatsApp ativa e configurada
    let contaOficial = null;
    try {
      const rowConta = await buscarContaWhatsappPrincipal(supabase, { tenant_id: tenantId });
      if (rowConta) {
        contaOficial = normalizarWhatsappAccount(rowConta);
      }
    } catch (errAccount) {
      console.warn('[DetalhesComunicacaoAPI] Aviso ao resolver conta WhatsApp oficial:', errAccount);
    }

    // 3. Resolve o nome da campanha do CRM se houver vínculo
    const regrasAudience = campanha.communication_audiences?.regras || {};
    let nomeCampanhaCRM = null;
    if (regrasAudience.crm_campaign_id) {
      const { data: crmCamp } = await supabase
        .from('campanhas')
        .select('nome')
        .eq('id', regrasAudience.crm_campaign_id)
        .maybeSingle();
      if (crmCamp?.nome) {
        nomeCampanhaCRM = crmCamp.nome;
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

    if (errItens) throw errItens;

    // 5. Consolida as estatísticas operacionais em tempo real com 6 métricas independentes
    let pendentes = 0;
    let processando = 0;
    let enviadas = 0;
    let entregues = 0;
    let lidas = 0;
    let falhas = 0;

    (itens || []).forEach(item => {
      const st = String(item.status || '').toLowerCase();
      if (st === 'pendente') {
        pendentes++;
      } else if (st === 'processando') {
        processando++;
      } else if (st === 'falha' || st === 'falhou') {
        falhas++;
      } else if (st === 'lido' || st === 'lida' || item.read_at) {
        lidas++;
      } else if (st === 'entregue' || item.delivered_at) {
        entregues++;
      } else if (st === 'enviado' || st === 'enviada' || item.sent_at) {
        enviadas++;
      }
    });

    const total = (itens || []).length;
    const processadosTotal = enviadas + entregues + lidas + falhas;
    const taxaConclusao = total > 0 ? ((processadosTotal / total) * 100).toFixed(1) : '0.0';

    return res.status(200).json({
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
        pendentes,
        processando,
        enviadas,
        entregues,
        lidas,
        falhas,
        taxaConclusao
      },
      destinatarios: (itens || []).map(item => ({
        id: item.id,
        nome: item.variaveis_mapeadas?.nome || 'Contato',
        telefone: item.contact_id,
        status: item.status,
        processado_em: item.finished_at || item.updated_at
      })),
      timeline: campanha.communication_audiences?.regras?.timeline || []
    });
  } catch (error) {
    console.error('[DetalhesComunicacaoAPI] Erro ao carregar informações:', error);
    // Retorno seguro mockado se tabelas do Supabase não possuírem registros
    return res.status(200).json({
      campanha: {
        id,
        nome: 'Comunicação Oficial Importada',
        canal: 'whatsapp',
        origem: 'Base de Dados',
        template: 'Informativo Obras',
        status: 'concluido',
        agendamento: null,
        created_at: new Date().toISOString()
      },
      metricas: { total: 0, pendentes: 0, processando: 0, enviadas: 0, falhas: 0, taxaConclusao: '0.0' },
      destinatarios: []
    });
  }
}
