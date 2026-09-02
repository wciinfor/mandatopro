import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal } from '@/lib/whatsapp-business-accounts';
import { createYCloudApiService } from '@/services/ycloud-api';
import { MetaGraphClient } from '@/lib/meta-graph-client';
import { createWaBlastApiService } from '@/services/wablast-api';

/**
 * Endpoint para listar templates WhatsApp aprovados do provedor ativo (Meta, YCloud ou WaBlast)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);

    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    if (!conta) {
      return res.status(200).json({
        success: true,
        provider: null,
        templates: []
      });
    }

    const provider = String(conta.provider || 'META').toUpperCase();

    // 1. Provedor WABLAST: catálogo oficial de templates aprovados da conta WaBlast / WABA
    if (provider === 'WABLAST') {
      const templatesWablastAprovados = [
        {
          id: 'acao_social_beneficio_01',
          nome: 'acao_social_beneficio_01',
          titulo: 'Acao Social Beneficio 01',
          categoria: 'UTILITY',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'BODY',
              text: 'Olá, {{1}}.\n\nO benefício {{2}} está disponível.\n\n- Entrega: {{3}}\n\n- Local: {{4}}\n\nApresentar documento com foto.'
            }
          ]
        },
        {
          id: 'consulta_grau_oculos',
          nome: 'consulta_grau_oculos',
          titulo: 'Consulta Grau Oculos',
          categoria: 'UTILITY',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'BODY',
              text: 'Olá, {{1}}.\n\nSua consulta gratuita de grau, escolha da armação e lentes está disponível.\n\nData e horário: {{2}}\nLocal: {{3}}\n\nApresente documento com foto.\nAtendimento por ordem de chegada.'
            }
          ]
        },
        {
          id: 'comunicado_institucional',
          nome: 'comunicado_institucional',
          titulo: 'Comunicado Institucional',
          categoria: 'MARKETING',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'HEADER',
              format: 'IMAGE'
            },
            {
              type: 'BODY',
              text: 'Olá, {{1}}.\n\nGostaríamos de compartilhar uma mensagem de agradecimento.\n\nAgradecemos pela confiança, pela parceria e pela presença ao longo desta caminhada.\n\nSeguimos trabalhando com compromisso, respeito e gratidão por todos que fazem parte dessa trajetória.\n\nDesejamos a você e à sua família muita paz, saúde e esperança.\n\nMuito obrigado!'
            }
          ]
        }
      ];

      return res.status(200).json({
        success: true,
        provider: 'WABLAST',
        templates: templatesWablastAprovados
      });
    }

    // 2. Provedor YCLOUD: consulta diretamente a API oficial da YCloud
    if (provider === 'YCLOUD') {
      const apiKey = conta.ycloud_api_key || conta.access_token;
      if (!apiKey) {
        return res.status(200).json({
          success: true,
          provider: 'YCLOUD',
          templates: []
        });
      }

      const ycloudService = createYCloudApiService({ apiKey });
      const response = await ycloudService.getTemplates({ status: 'APPROVED' });
      const items = response?.items || response?.data || [];

      const templatesFormatados = items.map((tmpl) => ({
        id: tmpl.officialTemplateId || tmpl.id || tmpl.name,
        nome: tmpl.name,
        titulo: tmpl.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        categoria: tmpl.category || 'MARKETING',
        idioma: tmpl.language || 'pt_BR',
        status: tmpl.status || 'APPROVED',
        componentes: tmpl.components || []
      }));

      return res.status(200).json({
        success: true,
        provider: 'YCLOUD',
        templates: templatesFormatados
      });
    }

    // 3. Provedor META: consulta a WABA via Meta Graph API
    if (provider === 'META') {
      const accessToken = conta.access_token;
      const wabaId = conta.waba_id;

      if (!accessToken || !wabaId) {
        return res.status(200).json({
          success: true,
          provider: 'META',
          templates: []
        });
      }

      const metaClient = new MetaGraphClient({
        accessToken,
        wabaId,
        phoneNumberId: conta.whatsapp_business_numbers?.[0]?.phone_number_id || null
      });

      const response = await metaClient.request({
        method: 'GET',
        endpoint: `${wabaId}/message_templates?status=APPROVED`,
        tenantId: conta.tenant_id
      });

      const items = response?.data || [];
      const templatesFormatados = items.map((tmpl) => ({
        id: tmpl.id || tmpl.name,
        nome: tmpl.name,
        titulo: tmpl.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        categoria: tmpl.category || 'MARKETING',
        idioma: tmpl.language || 'pt_BR',
        status: tmpl.status || 'APPROVED',
        componentes: tmpl.components || []
      }));

      return res.status(200).json({
        success: true,
        provider: 'META',
        templates: templatesFormatados
      });
    }

    return res.status(200).json({
      success: true,
      provider,
      templates: []
    });
  } catch (error) {
    console.error('[API TEMPLATES ERROR]', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro ao carregar templates oficiais'
    });
  }
}
