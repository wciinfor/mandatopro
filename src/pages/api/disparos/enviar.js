import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';

export const runtime = 'nodejs';

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    // 1. Resolução dinâmica do Provedor Oficial Ativo do Mandato (META ou YCLOUD)
    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    if (!conta) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma conta oficial de WhatsApp Business/YCloud configurada e ativa para este mandato'
      });
    }

    const contaNormalizada = normalizarWhatsappAccount(conta);
    const providerAccount = {
      ...conta,
      ...contaNormalizada,
      accessToken: conta.access_token || conta.ycloud_api_key,
      ycloudApiKey: conta.ycloud_api_key
    };

    const action = String(req.body?.action || '').trim();
    const isConnectionCheck = action === 'verificar_conexao';
    const isSendMessage = !action || action === 'enviar_mensagem';

    // 2. Instanciação do Provider via Factory Oficial
    const provider = createWhatsAppProvider(providerAccount);
    const providerName = String(providerAccount.provider || 'YCLOUD').toUpperCase();

    if (isConnectionCheck) {
      return res.status(200).json({
        success: true,
        provider: providerName,
        result: 'open',
        status: 'open',
        displayPhoneNumber: providerAccount.displayPhoneNumber,
        wabaId: providerAccount.wabaId
      });
    }

    if (!isSendMessage) {
      return res.status(400).json({
        success: false,
        message: 'Ação não suportada pelo gateway de disparos'
      });
    }

    const number = normalizePhone(req.body.contact?.phone || req.body.phone || req.body.number || req.body.telefone);
    const text = String(req.body.message || req.body.mensagem || '').trim();
    const templateName = req.body.templateName || req.body.template_name || (req.body.templateParams?.name || req.body.templateParams?.templateNome) || null;
    const contactName = String(req.body.contact?.name || req.body.contactName || req.body.nome || '').trim() || 'Eleitor';
    const envioId = req.body.envio_id || req.body.envioId || null;

    if (!number) {
      return res.status(400).json({ success: false, message: 'Telefone do destinatário não informado' });
    }

    let response;

    // 3. Envio via Template HSM ou Texto Livre
    if (templateName) {
      if (req.body.templateParams && typeof req.body.templateParams === 'object') {
        response = await provider.sendTemplate({
          to: number,
          recipient: number,
          ...req.body.templateParams
        });
      } else {
        // Resolução de parâmetros dinâmicos para campanhas estruturadas
        let mandateName = '';
        const explicitParlamentar = req.body.parlamentar?.nome || req.body.parlamentar || req.body.nomeParlamentar;
        if (explicitParlamentar && typeof explicitParlamentar === 'string' && explicitParlamentar.trim()) {
          mandateName = explicitParlamentar.trim();
        }

        if (!mandateName) {
          try {
            const { data: configRows } = await supabase
              .from('configuracoes_sistema')
              .select('chave, valor')
              .in('chave', ['parlamentares', 'nome_parlamentar', 'aniversariantes_nomeParlamentar', 'nome_orgao', 'sigla']);

            if (configRows && configRows.length > 0) {
              const map = {};
              configRows.forEach(r => { map[r.chave] = r.valor; });

              if (map.parlamentares) {
                try {
                  const list = typeof map.parlamentares === 'string' ? JSON.parse(map.parlamentares) : map.parlamentares;
                  if (Array.isArray(list) && list.length > 0) {
                    const padrao = list.find(p => p.padrao && p.ativo) || list.find(p => p.ativo) || list[0];
                    if (padrao?.nome && padrao.nome.trim()) {
                      mandateName = padrao.nome.trim();
                    }
                  }
                } catch {
                  // Fallback para campos legados
                }
              }

              if (!mandateName) {
                const nomeConfig = map.nome_parlamentar || map.aniversariantes_nomeParlamentar || map.nome_orgao || map.sigla;
                if (nomeConfig && String(nomeConfig).trim()) {
                  mandateName = String(nomeConfig).trim();
                }
              }
            }
          } catch {
            // Fallback para WABA
          }
        }

        if (!mandateName) {
          mandateName = contaNormalizada.displayName || contaNormalizada.verifiedName || conta.nome || 'Mandato';
        }

        const serviceName = String(
          req.body.beneficio ||
          req.body.servico ||
          req.body.serviceName ||
          req.body.campaignService ||
          req.body.campanhaServico ||
          'Atendimento'
        ).trim() || 'Atendimento';

        const customComponents = req.body.components || req.body.componentes || [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: contactName },
              { type: 'text', text: mandateName },
              { type: 'text', text: serviceName }
            ]
          }
        ];

        response = await provider.sendTemplate({
          to: number,
          recipient: number,
          templateName: templateName,
          name: templateName,
          language: req.body.language || req.body.idiomaCode || 'pt_BR',
          idiomaCode: req.body.idiomaCode || req.body.language || 'pt_BR',
          components: customComponents
        });
      }
    } else {
      if (!text) {
        return res.status(400).json({ success: false, message: 'Mensagem de texto obrigatória quando não informado template' });
      }

      response = await provider.sendMessage({
        to: number,
        recipient: number,
        message: text,
        text: text
      });
    }

    const messageId = response?.id || response?.messages?.[0]?.id || response?.messageId || null;

    // 4. Localização e persistência precisa na fila disparo_envios
    const campanhaId = req.body.campanha_id || req.body.campanhaId || null;
    const contatoId = req.body.contato_id || req.body.contatoId || null;

    let targetEnvioRow = null;

    if (envioId && Number.isFinite(Number(envioId))) {
      const { data: eRow } = await supabase
        .from('disparo_envios')
        .select('id, tentativas, status, campanha_id')
        .eq('id', Number(envioId))
        .maybeSingle();
      if (eRow) targetEnvioRow = eRow;
    }

    if (!targetEnvioRow && campanhaId && contatoId) {
      const { data: eRow } = await supabase
        .from('disparo_envios')
        .select('id, tentativas, status, campanha_id')
        .eq('campanha_id', Number(campanhaId))
        .eq('contato_id', Number(contatoId))
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eRow) targetEnvioRow = eRow;
    }

    if (!targetEnvioRow && campanhaId && number) {
      const { data: eRow } = await supabase
        .from('disparo_envios')
        .select('id, tentativas, status, campanha_id')
        .eq('campanha_id', Number(campanhaId))
        .eq('telefone', number)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eRow) targetEnvioRow = eRow;
    }

    if (targetEnvioRow && messageId) {
      try {
        const proximaTentativa = (targetEnvioRow.tentativas || 0) + 1;
        await supabase
          .from('disparo_envios')
          .update({
            provider_message_id: messageId,
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            tentativas: proximaTentativa,
            erro: null
          })
          .eq('id', targetEnvioRow.id);
      } catch (persistError) {
        console.warn('Aviso: Falha ao atualizar sucesso em disparo_envios:', persistError);
      }
    }

    return res.status(200).json({
      success: true,
      provider: providerName,
      number,
      templateName: templateName || null,
      messageId,
      envio_id: targetEnvioRow?.id || null,
      data: response
    });

  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    const errorMessage = error?.message || 'Erro ao processar envio pelo gateway de disparos';
    console.error('Erro no gateway oficial de disparos:', error);

    const envioId = req.body?.envio_id || req.body?.envioId || null;
    const campanhaId = req.body?.campanha_id || req.body?.campanhaId || null;
    const contatoId = req.body?.contato_id || req.body?.contatoId || null;
    const rawNumber = normalizePhone(req.body?.contact?.phone || req.body?.phone || req.body?.number || req.body?.telefone);

    try {
      let targetEnvioRow = null;
      if (envioId && Number.isFinite(Number(envioId))) {
        const { data: eRow } = await supabase
          .from('disparo_envios')
          .select('id, tentativas')
          .eq('id', Number(envioId))
          .maybeSingle();
        if (eRow) targetEnvioRow = eRow;
      }

      if (!targetEnvioRow && campanhaId && contatoId) {
        const { data: eRow } = await supabase
          .from('disparo_envios')
          .select('id, tentativas')
          .eq('campanha_id', Number(campanhaId))
          .eq('contato_id', Number(contatoId))
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (eRow) targetEnvioRow = eRow;
      }

      if (!targetEnvioRow && campanhaId && rawNumber) {
        const { data: eRow } = await supabase
          .from('disparo_envios')
          .select('id, tentativas')
          .eq('campanha_id', Number(campanhaId))
          .eq('telefone', rawNumber)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (eRow) targetEnvioRow = eRow;
      }

      if (targetEnvioRow) {
        const proximaTentativa = (targetEnvioRow.tentativas || 0) + 1;
        await supabase
          .from('disparo_envios')
          .update({
            status: proximaTentativa >= 3 ? 'falhou' : 'pendente',
            tentativas: proximaTentativa,
            erro: errorMessage
          })
          .eq('id', targetEnvioRow.id);
      }
    } catch (errPersist) {
      console.warn('Aviso: Erro ao registrar falha em disparo_envios:', errPersist);
    }

    return res.status(status).json({
      success: false,
      message: errorMessage
    });
  }
}
