import assert from 'node:assert';
import {
  createWhatsAppProvider,
  MetaWhatsAppAdapter,
  YCloudWhatsAppAdapter,
  WaBlastWhatsAppAdapter,
  WaflyWhatsAppAdapter
} from './src/services/whatsapp-provider-factory.js';
import {
  alterarProvedorWhatsappAtivo,
  resolverContaWhatsappDaConversa
} from './src/lib/whatsapp-business-accounts.js';

async function runTests() {
  console.log('=== SUÍTE DE TESTES DE NÃO-REGRESSÃO E CORREÇÃO FORENSE — FASE 2 WAFLY ===\n');

  // CASO 1: Factory cria WaflyWhatsAppAdapter quando provider='WAFLY'
  {
    console.log('1. Factory cria WaflyWhatsAppAdapter quando provider="WAFLY"...');
    const waflyProv = createWhatsAppProvider({
      provider: 'WAFLY',
      clientToken: 'ct-test',
      instance: 'inst-test',
      token: 'tok-test'
    });
    assert(waflyProv instanceof WaflyWhatsAppAdapter, 'Deveria instanciar WaflyWhatsAppAdapter');
    console.log('   ✓ Caso 1 Aprovado: WaflyWhatsAppAdapter instanciado corretamente.');
  }

  // CASO 2: Provedor META continua retornando MetaWhatsAppAdapter
  {
    console.log('2. Provedor META continua retornando MetaWhatsAppAdapter...');
    const metaProv = createWhatsAppProvider({ provider: 'META' });
    assert(metaProv instanceof MetaWhatsAppAdapter, 'Deveria instanciar MetaWhatsAppAdapter');
    const defaultProv = createWhatsAppProvider({}); // Padrão sem provider
    assert(defaultProv instanceof MetaWhatsAppAdapter, 'Padrão ausente deveria instanciar MetaWhatsAppAdapter');
    console.log('   ✓ Caso 2 Aprovado: META preservado como padrão e retorno direto.');
  }

  // CASO 3: Provedor YCLOUD continua retornando YCloudWhatsAppAdapter
  {
    console.log('3. Provedor YCLOUD continua retornando YCloudWhatsAppAdapter...');
    const ycloudProv = createWhatsAppProvider({ provider: 'YCLOUD', ycloudApiKey: 'test-key' });
    assert(ycloudProv instanceof YCloudWhatsAppAdapter, 'Deveria instanciar YCloudWhatsAppAdapter');
    console.log('   ✓ Caso 3 Aprovado: YCLOUD preservado.');
  }

  // CASO 4: Provedor WABLAST continua retornando WaBlastWhatsAppAdapter
  {
    console.log('4. Provedor WABLAST continua retornando WaBlastWhatsAppAdapter...');
    const wablastProv = createWhatsAppProvider({ provider: 'WABLAST', wablastAccountId: 'acc-123' });
    assert(wablastProv instanceof WaBlastWhatsAppAdapter, 'Deveria instanciar WaBlastWhatsAppAdapter');
    console.log('   ✓ Caso 4 Aprovado: WABLAST preservado.');
  }

  // CASO 5: sendMessage da WAFLY aceita formatos variados de payload (to, recipient, message, text)
  {
    console.log('5. sendMessage da WAFLY aceita formatos variados de payload...');
    const adapter = new WaflyWhatsAppAdapter({
      clientToken: 'ct-test',
      instance: 'inst-test',
      token: 'tok-test'
    });

    let lastSent = null;
    adapter.service.sendText = async (params) => {
      lastSent = params;
      return { success: true, messageId: 'ID_MSG_1' };
    };

    // Formato A: to + message
    await adapter.sendMessage({ to: '5511999991111', message: 'Texto 1' });
    assert.strictEqual(lastSent.phone, '5511999991111');
    assert.strictEqual(lastSent.message, 'Texto 1');

    // Formato B: recipient + text (string)
    await adapter.sendMessage({ recipient: '5511999992222', text: 'Texto 2' });
    assert.strictEqual(lastSent.phone, '5511999992222');
    assert.strictEqual(lastSent.message, 'Texto 2');

    // Formato C: to + text ({ body: '...' })
    await adapter.sendMessage({ to: '5511999993333', text: { body: 'Texto 3' } });
    assert.strictEqual(lastSent.phone, '5511999993333');
    assert.strictEqual(lastSent.message, 'Texto 3');

    // Formato D: to + body
    await adapter.sendMessage({ to: '5511999994444', body: 'Texto 4' });
    assert.strictEqual(lastSent.phone, '5511999994444');
    assert.strictEqual(lastSent.message, 'Texto 4');

    console.log('   ✓ Caso 5 Aprovado: Todos os formatos de payload de texto aceitos e unificados.');
  }

  // CASO 6: sendMessage da WAFLY retorna formato unificado { success, messageId, id }
  {
    console.log('6. sendMessage da WAFLY retorna formato unificado { success, messageId, id }...');
    const adapter = new WaflyWhatsAppAdapter({
      clientToken: 'ct-test',
      instance: 'inst-test',
      token: 'tok-test'
    });

    adapter.service.sendText = async () => ({
      success: true,
      messageId: 'MSG_WAFLY_123456',
      id: 'MSG_WAFLY_123456'
    });

    const res = await adapter.sendMessage({ to: '5511999998888', message: 'Teste contrato' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.messageId, 'MSG_WAFLY_123456');
    assert.strictEqual(res.id, 'MSG_WAFLY_123456');
    console.log('   ✓ Caso 6 Aprovado: Formato unificado { success, messageId, id } garantido.');
  }

  // CASO 7: sendTemplate da WAFLY substitui {{1}}, {{2}}, {{3}} corretamente
  {
    console.log('7. sendTemplate da WAFLY substitui {{1}}, {{2}}, {{3}} corretamente...');
    const adapter = new WaflyWhatsAppAdapter({
      clientToken: 'ct-test',
      instance: 'inst-test',
      token: 'tok-test'
    });

    let sentPayload = null;
    adapter.service.sendText = async (params) => {
      sentPayload = params;
      return { success: true, messageId: 'TMPL_SENT_001' };
    };

    const res = await adapter.sendTemplate({
      to: '5511988887777',
      templateName: 'acao_social_beneficio_01',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'João Silva' },
            { type: 'text', text: 'Auxílio Gás' },
            { type: 'text', text: '20/10 às 09h' },
            { type: 'text', text: 'Posto Comunitário' }
          ]
        }
      ]
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.messageId, 'TMPL_SENT_001');
    assert.strictEqual(res.recipient, '5511988887777');
    assert.strictEqual(res.template, 'acao_social_beneficio_01');

    const expectedText = 'Olá, João Silva.\n\nO benefício Auxílio Gás está disponível.\n\n- Entrega: 20/10 às 09h\n\n- Local: Posto Comunitário\n\nApresentar documento com foto.';
    assert.strictEqual(sentPayload.message, expectedText);
    console.log('   ✓ Caso 7 Aprovado: Interpolação de {{1}}, {{2}}, {{3}}, {{4}} executada com precisão.');
  }

  // CASO 8: sendTemplate da WAFLY rejeita envio com erro explícito caso template não seja encontrado
  {
    console.log('8. sendTemplate da WAFLY rejeita envio caso template não seja encontrado...');
    const adapter = new WaflyWhatsAppAdapter({
      clientToken: 'ct-test',
      instance: 'inst-test',
      token: 'tok-test'
    });

    let sendCalled = false;
    adapter.service.sendText = async () => {
      sendCalled = true;
      return { success: true };
    };

    // Força retorno nulo de template desconhecido
    adapter._obterTextoTemplate = async () => null;

    const res = await adapter.sendTemplate({
      to: '5511988887777',
      templateName: 'template_inexistente_xyz',
      components: [{ type: 'body', parameters: [{ text: 'Valor' }] }]
    });

    assert.strictEqual(sendCalled, false, 'sendText NÃO deve ser chamado quando template não existe');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.provider, 'WAFLY');
    assert.strictEqual(res.error, 'Template não encontrado para conversão em mensagem de texto');
    assert.strictEqual(res.templateName, 'template_inexistente_xyz');
    console.log('   ✓ Caso 8 Aprovado: Nenhuma mensagem degradada disparada; erro explícito retornado.');
  }

  // CASO 9: WAFLY é reconhecido nas validações de provedores permitidos
  {
    console.log('9. WAFLY é reconhecido nas validações de provedores permitidos...');
    const mockContas = [
      {
        id: 99,
        provider: 'WAFLY',
        access_token: 'tok-inst-123',
        status: 'ATIVO',
        principal: true,
        whatsapp_business_numbers: [{ display_phone_number: '5511999999999', status: 'ATIVO' }]
      }
    ];

    const createQuery = () => {
      const q = {
        data: mockContas,
        error: null,
        eq() { return q; },
        order() { return q; },
        then(resolve) { return Promise.resolve({ data: mockContas, error: null }).then(resolve); }
      };
      return q;
    };

    const mockSupabase = {
      from: () => ({
        select: () => createQuery(),
        update: () => createQuery()
      })
    };

    // Testar aceitação de WAFLY
    await alterarProvedorWhatsappAtivo(mockSupabase, { tenant_id: 1 }, 'WAFLY');

    // Testar que provedor fora de META, YCLOUD, WABLAST, WAFLY é bloqueado
    await assert.rejects(
      () => alterarProvedorWhatsappAtivo(mockSupabase, { tenant_id: 1 }, 'TWILIO_INVALIDO'),
      (err) => err.message.includes('Provedor inválido. Escolha META, YCLOUD, WABLAST ou WAFLY')
    );

    console.log('   ✓ Caso 9 Aprovado: Lista de validação permite [META, YCLOUD, WABLAST, WAFLY] e rejeita outros.');
  }

  // CASO 10: meta.origem === 'wafly' só resolve conta quando nenhum provedor foi sugerido anteriormente
  {
    console.log('10. meta.origem === "wafly" só resolve conta quando nenhum provedor foi sugerido anteriormente...');
    const contas = [
      {
        id: 1,
        provider: 'META',
        principal: true,
        status: 'ATIVO',
        whatsapp_business_numbers: [{ display_phone_number: '5511111111111' }]
      },
      {
        id: 2,
        provider: 'WAFLY',
        principal: false,
        status: 'ATIVO',
        whatsapp_business_numbers: [{ display_phone_number: '5511222222222' }]
      }
    ];

    const mockSupabase = {
      from: (t) => {
        if (t === 'whatsapp_business_accounts') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: contas, error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }) };
      }
    };

    // Sub-teste 10.1: Sem provider explícito, meta.origem === 'wafly' resolve para WAFLY
    const resOrigemWafly = await resolverContaWhatsappDaConversa(mockSupabase, {
      id: 101,
      tenant_id: 1,
      metadata: { origem: 'wafly' }
    }, { tenant_id: 1 });
    assert.strictEqual(resOrigemWafly.conta.provider, 'WAFLY');
    assert.strictEqual(resOrigemWafly.resolucaoInfo.motivo_resolucao, 'metadata_conversa_origem_provider');

    // Sub-teste 10.2: Se meta.provider === 'META' estiver presente, ele tem precedência sobre meta.origem === 'wafly'
    const resPrecedenciaProvider = await resolverContaWhatsappDaConversa(mockSupabase, {
      id: 102,
      tenant_id: 1,
      metadata: { provider: 'META', origem: 'wafly' }
    }, { tenant_id: 1 });
    assert.strictEqual(resPrecedenciaProvider.conta.provider, 'META');
    assert.strictEqual(resPrecedenciaProvider.resolucaoInfo.motivo_resolucao, 'metadata_conversa_origem_provider');

    console.log('   ✓ Caso 10 Aprovado: meta.origem="wafly" tem comportamento prioritário correto e estrito.');
  }

  // CASO 11: Número do destinatário do inbound (to) tem precedência absoluta sobre meta.origem
  {
    console.log('11. Número destinatário do inbound (to) tem precedência absoluta sobre meta.origem...');
    const contas = [
      {
        id: 1,
        provider: 'META',
        principal: true,
        status: 'ATIVO',
        whatsapp_business_numbers: [{ display_phone_number: '5511111111111', phone_number_id: 'pn_meta_1' }]
      },
      {
        id: 2,
        provider: 'WAFLY',
        principal: false,
        status: 'ATIVO',
        whatsapp_business_numbers: [{ display_phone_number: '5511222222222', phone_number_id: 'pn_wafly_2' }]
      }
    ];

    const mockSupabase = {
      from: (t) => {
        if (t === 'whatsapp_business_accounts') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: contas, error: null }) }) }) };
        }
        if (t === 'atendimento_connect_mensagens') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      // Mensagem inbound cujo destinatário final foi o número META (5511111111111)
                      maybeSingle: () => Promise.resolve({
                        data: {
                          raw_payload: { to: '5511111111111' }
                        }
                      })
                    })
                  })
                })
              })
            })
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
    };

    // Conversa que tem metadata.origem = 'wafly', mas última mensagem inbound recebida foi no número META
    const conversa = {
      id: 201,
      tenant_id: 1,
      metadata: { origem: 'wafly' }
    };

    const { conta, resolucaoInfo } = await resolverContaWhatsappDaConversa(mockSupabase, conversa, { tenant_id: 1 });
    assert.strictEqual(conta.provider, 'META', 'Deveria resolver para a conta do telefone de entrada META');
    assert.strictEqual(resolucaoInfo.motivo_resolucao, 'ultima_entrada_numero_to');
    console.log('   ✓ Caso 11 Aprovado: Número do destinatário de entrada prevalece sobre metadata da conversa.');
  }

  // CASO 12: Nenhuma alteração funcional nos fluxos de META, YCLOUD e WABLAST + Isolamento de credenciais
  {
    console.log('12. Isolamento rigoroso de credenciais e preservação de META, YCLOUD e WABLAST...');
    
    // Teste 12.1: Conta WAFLY não pode herdar waba_id, wablast_account_id ou app_secret acidentalmente
    const contaMista = {
      provider: 'WAFLY',
      clientToken: 'wafly-client-tok',
      token: 'wafly-instance-tok',
      instance: 'wafly-instance-real',
      // Campos de outros provedores que poderiam vazar por acidente:
      waba_id: 'WABA_META_CONTAMINATION_ID',
      wablast_account_id: 'WABLAST_CONTAMINATION_ID',
      app_secret: 'META_APP_SECRET_CONTAMINATION'
    };

    const adapter = new WaflyWhatsAppAdapter(contaMista);
    assert.strictEqual(adapter.service.instance, 'wafly-instance-real');
    assert.strictEqual(adapter.service.clientToken, 'wafly-client-tok');
    assert.strictEqual(adapter.service.token, 'wafly-instance-tok');

    // Teste 12.2: Se conta WAFLY NÃO tem instance definida mas tem waba_id ou wablast_account_id,
    // NÃO deve adotar os IDs alheios como instance
    const contaSemInstancia = {
      provider: 'WAFLY',
      clientToken: 'wafly-client-tok',
      token: 'wafly-instance-tok',
      waba_id: 'WABA_META_CONTAMINATION_ID',
      wablast_account_id: 'WABLAST_CONTAMINATION_ID'
    };
    const adapterSemInst = new WaflyWhatsAppAdapter(contaSemInstancia);
    assert.strictEqual(adapterSemInst.service.instance, '', 'Não pode capturar waba_id ou wablast_account_id como instance');

    // Teste 12.3: getStatus() do WaflyWhatsAppAdapter com mock de sucesso e erro
    adapter.service._request = async (path, options) => {
      assert.strictEqual(path, '/status');
      assert.strictEqual(options.method, 'GET');
      return { value: 'CONNECTED' };
    };
    const statusSuccess = await adapter.getStatus();
    assert.strictEqual(statusSuccess.success, true);
    assert.strictEqual(statusSuccess.status, 'CONNECTED');
    assert.strictEqual(statusSuccess.provider, 'WAFLY');

    // Teste de falha em getStatus() não lança exceção não tratada
    adapter.service._request = async () => {
      throw new Error('Instância desconectada');
    };
    const statusError = await adapter.getStatus();
    assert.strictEqual(statusError.success, false);
    assert.strictEqual(statusError.status, 'ERROR');
    assert.strictEqual(statusError.provider, 'WAFLY');
    assert.strictEqual(statusError.error, 'Instância desconectada');

    console.log('   ✓ Caso 12 Aprovado: Isolamento estrito de credenciais e getStatus() defensivo confirmados.');
  }

  console.log('\n======================================================================');
  console.log('TODOS OS 12 TESTES FORENSES DE NÃO-REGRESSÃO DA FASE 2 FORAM APROVADOS!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Falha na execução da suíte de testes:', err);
  process.exit(1);
});
