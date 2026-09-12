import assert from 'node:assert/strict';
import { gerarDiagnosticoWhatsappBusiness } from './src/services/whatsapp-business-health.js';

console.log('🧪 Iniciando testes de validação da FASE 4 — PASSO 5 (Health Check WAFLY)...');

async function main() {
  const { WaflyWhatsAppAdapter } = await import('./src/services/whatsapp-provider-factory.js');
  const originalGetStatus = WaflyWhatsAppAdapter.prototype.getStatus;

  try {
    const contaConnected = {
      provider: 'WAFLY',
      tenant_id: 'tenant-100',
      access_token_metadata: {
        wafly_client_token: 'SECRET_CLIENT_123',
        wafly_instance: 'INST_CONNECTED',
        wafly_token: 'SECRET_TOKEN_123'
      },
      whatsapp_business_numbers: [{ principal: true, status: 'ATIVO', display_phone_number: '5511999998888' }]
    };

    // 1. CONNECTED => ready=true
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return { success: true, status: 'CONNECTED', provider: 'WAFLY', data: { status: 'CONNECTED' } };
    };

    const res1 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    assert.equal(res1.ready, true, 'Deveria estar ready=true para CONNECTED');
    assert.equal(res1.provider, 'WAFLY');
    assert.equal(res1.summary, 'Integração WAFLY ativa e pronta para envio');
    assert.equal(res1.pending.length, 0);
    const connInd = res1.indicators.find(i => i.id === 'connection');
    assert.equal(connInd.status, 'OK');
    console.log('✅ [TESTE 1] CONNECTED => ready=true');

    // 2. DISCONNECTED => ready=false
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return { success: true, status: 'DISCONNECTED', provider: 'WAFLY', data: { status: 'DISCONNECTED' } };
    };
    const res2 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    assert.equal(res2.ready, false, 'Deveria estar ready=false para DISCONNECTED');
    assert.equal(res2.summary, 'Instância WAFLY desconectada do WhatsApp');
    assert(res2.pending.some(p => p.includes('DISCONNECTED')));
    const connInd2 = res2.indicators.find(i => i.id === 'connection');
    assert.equal(connInd2.status, 'Atenção');
    console.log('✅ [TESTE 2] DISCONNECTED => ready=false');

    // 3. Credenciais inválidas / 401 => ready=false
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return {
        success: false,
        status: 'ERROR',
        statusCode: 401,
        error: 'Credenciais inválidas ou ausentes na API Wafly (verifique clientToken, instance e token)',
        provider: 'WAFLY'
      };
    };
    const res3 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    assert.equal(res3.ready, false, 'Deveria estar ready=false para 401');
    assert.equal(res3.summary, 'Credenciais inválidas na API WAFLY');
    assert(res3.pending.some(p => p.includes('Credenciais inválidas')));
    const connInd3 = res3.indicators.find(i => i.id === 'connection');
    assert.equal(connInd3.status, 'Erro');
    console.log('✅ [TESTE 3] Credenciais inválidas (401) => ready=false');

    // 4. Timeout => ready=false
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return {
        success: false,
        status: 'ERROR',
        statusCode: 504,
        error: 'Tempo limite de conexão com a Wafly excedido (15000ms)',
        provider: 'WAFLY'
      };
    };
    const res4 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    assert.equal(res4.ready, false, 'Deveria estar ready=false para timeout');
    assert.equal(res4.summary, 'Falha de comunicação com o servidor WAFLY');
    assert(res4.pending.some(p => p.includes('Tempo limite')));
    console.log('✅ [TESTE 4] Timeout (504) => ready=false');

    // 5. Erro remoto => ready=false
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return {
        success: false,
        status: 'ERROR',
        statusCode: 502,
        error: 'Falha de comunicação com o servidor da Wafly',
        provider: 'WAFLY'
      };
    };
    const res5 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    assert.equal(res5.ready, false, 'Deveria estar ready=false para erro 502');
    assert.equal(res5.summary, 'Falha de comunicação com o servidor WAFLY');
    console.log('✅ [TESTE 5] Erro remoto => ready=false');

    // 6. Número vinculado corretamente
    WaflyWhatsAppAdapter.prototype.getStatus = async function() {
      return { success: true, status: 'CONNECTED', provider: 'WAFLY' };
    };
    const res6 = await gerarDiagnosticoWhatsappBusiness(contaConnected);
    const phoneInd = res6.indicators.find(i => i.id === 'phone_number');
    assert.equal(phoneInd.status, 'OK');
    assert.equal(phoneInd.details?.display_phone_number, '5511999998888');
    console.log('✅ [TESTE 6] Número vinculado mapeado com sucesso');

    // 7. Webhook status retornado
    const mockSupabase = {
      from: (t) => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { event_type: 'ReceivedCallback', created_at: '2026-09-12T10:00:00Z' },
                  error: null
                })
              })
            })
          })
        })
      })
    };
    const res7 = await gerarDiagnosticoWhatsappBusiness(contaConnected, { supabase: mockSupabase });
    const webhookInd = res7.indicators.find(i => i.id === 'webhook_status');
    assert.equal(webhookInd.status, 'OK');
    assert(webhookInd.description.includes('ReceivedCallback'));
    console.log('✅ [TESTE 7] Webhook status extraído do logger de eventos');

    // 8. Zero vazamento de secrets
    const resStr = JSON.stringify(res1) + JSON.stringify(res3);
    assert(!resStr.includes('SECRET_CLIENT_123'), 'Secret client token vazou!');
    assert(!resStr.includes('SECRET_TOKEN_123'), 'Secret instance token vazou!');
    assert(!resStr.includes('wafly_token'), 'wafly_token vazou!');
    assert(!resStr.includes('wafly_client_token'), 'wafly_client_token vazou!');
    console.log('✅ [TESTE 8] ZERO vazamento de segredos confirmado');

    // 9. Regressão META intacta
    const contaMeta = {
      provider: 'META',
      tenant_id: 'tenant-meta',
      access_token: '',
      whatsapp_business_numbers: [{ principal: true, phone_number_id: '123' }]
    };
    const resMeta = await gerarDiagnosticoWhatsappBusiness(contaMeta);
    assert.equal(resMeta.ready, false);
    assert(resMeta.indicators.some(i => i.id === 'embedded_signup'));
    assert(resMeta.indicators.some(i => i.id === 'token'));
    console.log('✅ [TESTE 9] Regressão META intacta');

    // 10. Regressão YCLOUD intacta
    const contaYcloud = {
      provider: 'YCLOUD',
      tenant_id: 'tenant-ycloud',
      ycloud_api_key: 'key_123',
      whatsapp_business_numbers: [{ principal: true, phone_number_id: '5511999998888', display_phone_number: '5511999998888' }]
    };
    const resYcloud = await gerarDiagnosticoWhatsappBusiness(contaYcloud);
    assert.equal(resYcloud.provider, 'YCLOUD');
    assert.equal(resYcloud.ready, true);
    assert.equal(resYcloud.summary, 'Integração YCloud ativa e pronta para envio');
    console.log('✅ [TESTE 10] Regressão YCLOUD intacta');

    // 11. Regressão WABLAST intacta
    const contaWablast = {
      provider: 'WABLAST',
      tenant_id: 'tenant-wablast',
      wablast_account_id: 'acc_123',
      wablast_waba_id: 'waba_123',
      whatsapp_business_numbers: [{ principal: true, phone_number_id: '5511999998888', display_phone_number: '5511999998888' }]
    };
    const resWablast = await gerarDiagnosticoWhatsappBusiness(contaWablast);
    assert.equal(resWablast.provider, 'WABLAST');
    assert.equal(resWablast.ready, true);
    assert.equal(resWablast.summary, 'Integração WaBlast ativa e pronta para uso');
    console.log('✅ [TESTE 11] Regressão WABLAST intacta');

  } finally {
    WaflyWhatsAppAdapter.prototype.getStatus = originalGetStatus;
  }

  console.log('\n==============================================');
  console.log('TOTAL DE TESTES: 11');
  console.log('SUCESSOS: 11');
  console.log('FALHAS: 0');
  console.log('==============================================\n');
  console.log('🎉 Todos os 11 testes da FASE 4 — PASSO 5 foram aprovados com sucesso!');
}

main().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
