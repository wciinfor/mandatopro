import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';
import { buscarContaWhatsappPrincipal, normalizarWhatsappAccount } from '@/lib/whatsapp-business-accounts';
import { createWhatsAppProvider } from '@/services/whatsapp-provider-factory';

export const runtime = 'nodejs';

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    const conta = await buscarContaWhatsappPrincipal(supabase, usuario);
    if (!conta) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma conta de WhatsApp Business/YCloud configurada para este mandato'
      });
    }

    const contaNormalizada = normalizarWhatsappAccount(conta);
    const providerAccount = {
      ...conta,
      ...contaNormalizada,
      accessToken: conta.access_token || conta.ycloud_api_key,
      ycloudApiKey: conta.ycloud_api_key
    };

    const isConnectionCheck = String(req.body?.action || '') === 'verificar_conexao';
    const isSendMessage = String(req.body?.action || '') === 'enviar_mensagem';

    const provider = createWhatsAppProvider(providerAccount);

    if (isConnectionCheck) {
      return res.status(200).json({
        success: true,
        provider: providerAccount.provider || 'YCLOUD',
        result: 'open',
        status: 'open',
        displayPhoneNumber: providerAccount.displayPhoneNumber,
        wabaId: providerAccount.wabaId
      });
    }

    if (isSendMessage) {
      const number = normalizePhone(req.body.contact?.phone || req.body.phone || req.body.number);
      const text = String(req.body.message || '').trim();
      const templateName = req.body.templateName ? String(req.body.templateName).trim() : null;
      const contactName = String(req.body.contact?.name || '').trim() || 'Eleitor';

      if (!number) {
        return res.status(400).json({ success: false, message: 'Telefone do contato nao informado' });
      }

      let response;

      if (templateName) {
        // 1. Resolve o nome do parlamentar/mandato (parâmetro {{2}})
        // Prioridade 1: Parlamentar explicitamente enviado no payload da campanha
        let mandateName = '';
        const explicitParlamentar = req.body.parlamentar?.nome || req.body.parlamentar || req.body.nomeParlamentar;
        if (explicitParlamentar && typeof explicitParlamentar === 'string' && explicitParlamentar.trim()) {
          mandateName = explicitParlamentar.trim();
        }

        // Se não enviado explicitamente, busca nas configurações do sistema
        if (!mandateName) {
          try {
            const { data: configRows } = await supabase
              .from('configuracoes_sistema')
              .select('chave, valor')
              .in('chave', ['parlamentares', 'nome_parlamentar', 'aniversariantes_nomeParlamentar', 'nome_orgao', 'sigla']);

            if (configRows && configRows.length > 0) {
              const map = {};
              configRows.forEach(r => { map[r.chave] = r.valor; });

              // Prioridade 2: Parlamentar padrão da lista de parlamentares
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
                  // Prossegue para legado
                }
              }

              // Prioridade 3: Compatibilidade legada com nome_parlamentar
              if (!mandateName) {
                const nomeConfig = map.nome_parlamentar || map.aniversariantes_nomeParlamentar || map.nome_orgao || map.sigla;
                if (nomeConfig && String(nomeConfig).trim()) {
                  mandateName = String(nomeConfig).trim();
                }
              }
            }
          } catch {
            // Mantém fallback seguro
          }
        }

        // Prioridade 4 (Fallback seguro da conta WABA)
        if (!mandateName) {
          mandateName = contaNormalizada.displayName || contaNormalizada.verifiedName || conta.nome || 'Mandato';
        }

        // 2. Resolve o benefício/serviço informado na campanha (parâmetro {{3}})
        const serviceName = String(
          req.body.beneficio ||
          req.body.servico ||
          req.body.serviceName ||
          req.body.campaignService ||
          req.body.campanhaServico ||
          'Óculos'
        ).trim() || 'Óculos';

        // Envio oficial via Template HSM (Utility/Marketing) com 3 parâmetros
        response = await provider.sendTemplate({
          to: number,
          recipient: number,
          templateName: templateName,
          language: 'pt_BR',
          idiomaCode: 'pt_BR',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: contactName },
                { type: 'text', text: mandateName },
                { type: 'text', text: serviceName }
              ]
            }
          ]
        });
      } else {
        // Envio padrão de texto livre
        if (!text) {
          return res.status(400).json({ success: false, message: 'Mensagem obrigatoria' });
        }

        response = await provider.sendMessage({
          to: number,
          recipient: number,
          message: text,
          text: text
        });
      }

      const messageId = response?.id || response?.messages?.[0]?.id || response?.messageId || null;

      return res.status(200).json({
        success: true,
        provider: providerAccount.provider || 'YCLOUD',
        direct: true,
        number,
        templateName: templateName || null,
        messageId,
        data: response
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Acao nao suportada'
    });
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    console.error('Erro no envio via YCloud (Mandato Connect):', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar envio pelo YCloud'
    });
  }
}
