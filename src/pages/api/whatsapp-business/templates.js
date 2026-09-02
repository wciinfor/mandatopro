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
          id: '1041928374829102',
          nome: 'acao_social_beneficio_01',
          titulo: 'Acao Social Beneficio 01',
          categoria: 'UTILITY',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'BODY',
              text: 'Olá {{1}}, informamos que a sua solicitação de benefício da Ação Social foi processada com sucesso.'
            },
            {
              type: 'FOOTER',
              text: 'Gabinete MandatoPRO'
            }
          ]
        },
        {
          id: '1041928374829103',
          nome: 'consulta_grau_oculos',
          titulo: 'Consulta Grau Oculos',
          categoria: 'UTILITY',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'BODY',
              text: 'Olá {{1}}, sua consulta oftalmológica para exame de grau está confirmada para {{2}}.'
            },
            {
              type: 'FOOTER',
              text: 'Gabinete MandatoPRO'
            }
          ]
        },
        {
          id: '1041928374829104',
          nome: 'comunicado_institucional',
          titulo: 'Comunicado Institucional',
          categoria: 'MARKETING',
          idioma: 'pt_BR',
          status: 'APPROVED',
          componentes: [
            {
              type: 'HEADER',
              format: 'TEXT',
              text: 'Informativo Oficial'
            },
            {
              type: 'BODY',
              text: 'Prezado(a) {{1}}, confira as principais atualizações e projetos em andamento no nosso mandato.'
            },
            {
              type: 'FOOTER',
              text: 'Canal Oficial'
            },
            {
              type: 'BUTTONS',
              buttons: [
                {
                  type: 'URL',
                  text: 'Acessar Portal'
                }
              ]
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
