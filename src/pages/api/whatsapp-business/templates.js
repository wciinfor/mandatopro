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

    // 1. Provedor WABLAST: consulta templates via WaBlast Partner API
    if (provider === 'WABLAST') {
      const accountId = conta.wablast_account_id;
      if (!accountId) {
        return res.status(200).json({
          success: true,
          provider: 'WABLAST',
          templates: []
        });
      }

      const wablastService = createWaBlastApiService();
      const response = await wablastService.getTemplates(accountId, { status: 'APPROVED' });
      const items = response?.items || response?.data || (Array.isArray(response) ? response : []);

      const templatesAprovados = items.filter(tmpl => {
        const status = String(tmpl.status || 'APPROVED').toUpperCase();
        return status === 'APPROVED';
      });

      const templatesFormatados = templatesAprovados.map((tmpl) => ({
        id: tmpl.id || tmpl.name,
        nome: tmpl.name,
        titulo: tmpl.name ? tmpl.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (tmpl.title || ''),
        categoria: tmpl.category || 'MARKETING',
        idioma: tmpl.language || 'pt_BR',
        status: tmpl.status || 'APPROVED',
        componentes: tmpl.components || []
      }));

      return res.status(200).json({
        success: true,
        provider: 'WABLAST',
        templates: templatesFormatados
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
