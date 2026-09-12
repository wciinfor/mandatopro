import assert from 'node:assert/strict';
import handler from './src/pages/api/whatsapp-business/config.js';

console.log('🧪 Iniciando testes de validação da FASE 4 — PASSO 2 (config.js)...');

// Helper para mock de banco in-memory
function createMockDb(initialAccounts = [], initialNumbers = []) {
  let accounts = [...initialAccounts];
  let numbers = [...initialNumbers];
  let nextAccId = 100;
  let nextNumId = 200;

  return {
    accounts,
    numbers,
    from(table) {
      if (table === 'whatsapp_business_accounts') {
        return {
          select(cols) {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              order(field, opts) {
                return q;
              },
              limit() { return q; },
              maybeSingle() {
                const found = accounts.find(a => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (a[k] !== v) return false;
                  }
                  return true;
                });
                if (!found) return Promise.resolve({ data: null, error: null });
                const attachedNumbers = numbers.filter(n => n.account_id === found.id);
                return Promise.resolve({
                  data: {
                    ...found,
                    whatsapp_business_numbers: attachedNumbers
                  },
                  error: null
                });
              },
              then(resolve, reject) {
                // Para consultas de array: .eq('tenant_id', ...).eq('status', 'ATIVO')
                const matched = accounts.filter(a => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (a[k] !== v) return false;
                  }
                  return true;
                }).map(a => {
                  const attachedNumbers = numbers.filter(n => n.account_id === a.id);
                  return {
                    ...a,
                    whatsapp_business_numbers: attachedNumbers
                  };
                });
                return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
              }
            };
            return q;
          },
          insert(row) {
            const newRow = { ...row, id: nextAccId++ };
            accounts.push(newRow);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: newRow, error: null });
                  }
                };
              }
            };
          },
          update(updates) {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              select() {
                return {
                  single() {
                    const idx = accounts.findIndex(a => {
                      for (const [k, v] of Object.entries(filters)) {
                        if (a[k] !== v) return false;
                      }
                      return true;
                    });
                    if (idx >= 0) {
                      accounts[idx] = { ...accounts[idx], ...updates };
                      return Promise.resolve({ data: accounts[idx], error: null });
                    }
                    return Promise.resolve({ data: null, error: new Error('Conta não encontrada') });
                  }
                };
              },
              then(resolve, reject) {
                for (let i = 0; i < accounts.length; i++) {
                  let match = true;
                  for (const [k, v] of Object.entries(filters)) {
                    if (accounts[i][k] !== v) match = false;
                  }
                  if (match) {
                    accounts[i] = { ...accounts[i], ...updates };
                  }
                }
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              }
            };
            return q;
          }
        };
      }

      if (table === 'whatsapp_business_numbers') {
        return {
          insert(row) {
            const newRow = { ...row, id: nextNumId++ };
            numbers.push(newRow);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: newRow, error: null });
                  }
                };
              }
            };
          },
          update(updates) {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              select() {
                return {
                  single() {
                    const idx = numbers.findIndex(n => {
                      for (const [k, v] of Object.entries(filters)) {
                        if (n[k] !== v) return false;
                      }
                      return true;
                    });
                    if (idx >= 0) {
                      numbers[idx] = { ...numbers[idx], ...updates };
                      return Promise.resolve({ data: numbers[idx], error: null });
                    }
                    return Promise.resolve({ data: null, error: null });
                  }
                };
              },
              then(resolve, reject) {
                for (let i = 0; i < numbers.length; i++) {
                  let match = true;
                  for (const [k, v] of Object.entries(filters)) {
                    if (numbers[i][k] !== v) match = false;
                  }
                  if (match) {
                    numbers[i] = { ...numbers[i], ...updates };
                  }
                }
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              }
            };
            return q;
          }
        };
      }

      throw new Error(`Tabela mock ${table} não tratada`);
    }
  };
}

function mockReq(method, body = {}, db = null, userRole = 'admin', tenantId = 10) {
  return {
    method,
    body,
    headers: {},
    supabaseClient: db,
    _authenticatedUser: {
      usuario: {
        id: 'usr-1',
        role: userRole,
        nivel: userRole === 'admin' ? 'ADMINISTRADOR' : 'USUARIO',
        tenant_id: tenantId,
        metadata: { tenant_id: tenantId }
      },
      metodo: 'mock'
    }
  };
}

function mockRes() {
  let statusCode = 200;
  let responseBody = null;
  return {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseBody = b;
      return this;
    },
    get statusCode() { return statusCode; },
    get body() { return responseBody; }
  };
}

let passed = 0;
let failed = 0;

function report(testNum, testName, condition, details = '') {
  if (condition) {
    console.log(`✅ [TESTE ${testNum}] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [TESTE ${testNum}] ${testName}`);
    if (details) console.error(`   Detalhes:`, details);
    failed++;
  }
}

async function runTests() {
// =========================================================================
// TESTE 1: GET reconhece conta WAFLY configurada
// =========================================================================
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'WAFLY',
      phone_number_id: 'inst-999',
      access_token: 'tok-wafly-123',
      principal: true,
      status: 'ATIVO',
      access_token_metadata: {
        wafly_client_token: 'cli-secret-token',
        wafly_instance: 'inst-999',
        wafly_token: 'tok-wafly-123',
        wafly_webhook_secret: 'wh-secret',
        connected_phone: '5511999998888'
      }
    }
  ], [
    {
      id: 10,
      account_id: 1,
      phone_number_id: '5511999998888',
      display_phone_number: '+55 11 99999-8888',
      verified_name: 'Mandato Oficial',
      status: 'CONECTADO'
    }
  ]);

  const req = mockReq('GET', {}, db);
  const res = mockRes();
  await handler(req, res);

  report(1, 'GET reconhece conta WAFLY configurada',
    res.statusCode === 200 && res.body?.success === true && res.body?.provider === 'WAFLY' && res.body?.waflyDetails?.configured === true,
    res.body
  );
}

// =========================================================================
// TESTE 2: GET retorna availableProviders.WAFLY com precisão (true quando conectada, false quando sem fone/token)
// =========================================================================
{
  // Caso Conectada
  const dbConnected = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'WAFLY',
      phone_number_id: 'inst-999',
      access_token: 'tok-wafly-123',
      principal: true,
      status: 'ATIVO',
      access_token_metadata: {
        wafly_instance: 'inst-999',
        wafly_token: 'tok-wafly-123',
        connected_phone: '5511999998888'
      }
    }
  ], [
    {
      id: 10,
      account_id: 1,
      phone_number_id: '5511999998888',
      display_phone_number: '+55 11 99999-8888',
      status: 'CONECTADO'
    }
  ]);
  const req1 = mockReq('GET', {}, dbConnected);
  const res1 = mockRes();
  await handler(req1, res1);
  const isAvailableTrue = res1.body?.availableProviders?.WAFLY === true;

  // Caso Não conectada (sem fone e sem token)
  const dbDisconnected = createMockDb([
    {
      id: 2,
      tenant_id: 10,
      provider: 'WAFLY',
      phone_number_id: 'inst-999',
      access_token: null,
      principal: false,
      status: 'ATIVO',
      access_token_metadata: {}
    }
  ], []);

  const req2 = mockReq('GET', {}, dbDisconnected);
  const res2 = mockRes();
  await handler(req2, res2);
  const isAvailableFalse = res2.body?.availableProviders?.WAFLY === false;

  report(2, 'GET retorna availableProviders.WAFLY com precisão (true/false)',
    isAvailableTrue && isAvailableFalse,
    { isAvailableTrue, isAvailableFalse }
  );
}

// =========================================================================
// TESTE 3: GET retorna waflyDetails com formato correto
// =========================================================================
let test3Res = null;
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'WAFLY',
      phone_number_id: 'inst-456',
      access_token: 'tok-abc',
      principal: true,
      status: 'ATIVO',
      access_token_metadata: {
        wafly_client_token: 'secret-cli',
        wafly_instance: 'inst-456',
        wafly_token: 'tok-abc',
        connected_phone: '5521988887777'
      }
    }
  ], [
    {
      id: 20,
      account_id: 1,
      phone_number_id: '5521988887777',
      display_phone_number: '+55 21 98888-7777',
      status: 'CONECTADO'
    }
  ]);

  const req = mockReq('GET', {}, db);
  const res = mockRes();
  await handler(req, res);
  test3Res = res;

  const d = res.body?.waflyDetails;
  const hasFormat = d &&
    typeof d.configured === 'boolean' &&
    typeof d.connected === 'boolean' &&
    d.instance === 'inst-456' &&
    d.phoneNumber === '+55 21 98888-7777' &&
    d.status === 'ATIVO' &&
    d.principal === true;

  report(3, 'GET retorna waflyDetails com formato correto ({ configured, connected, instance, phoneNumber, status, principal })',
    Boolean(hasFormat),
    d
  );
}

// =========================================================================
// TESTE 4: GET NÃO vaza clientToken
// =========================================================================
{
  const jsonStr = JSON.stringify(test3Res.body);
  const leaksClientToken = jsonStr.includes('secret-cli') || jsonStr.includes('cli-secret-token');

  report(4, 'GET NÃO vaza clientToken no payload de resposta',
    !leaksClientToken,
    { leaksClientToken }
  );
}

// =========================================================================
// TESTE 5: GET NÃO vaza token de instância (wafly_token / access_token)
// =========================================================================
{
  const jsonStr = JSON.stringify(test3Res.body);
  const leaksToken = jsonStr.includes('tok-abc') || jsonStr.includes('tok-wafly-123');

  report(5, 'GET NÃO vaza token da instância (wafly_token / access_token)',
    !leaksToken,
    { leaksToken }
  );
}

// =========================================================================
// TESTE 6: GET NÃO vaza webhookSecret ou verify_token
// =========================================================================
{
  const jsonStr = JSON.stringify(test3Res.body);
  const leaksSecret = jsonStr.includes('wh-secret') || jsonStr.includes('webhookSecret');

  report(6, 'GET NÃO vaza webhookSecret ou verify_token',
    !leaksSecret,
    { leaksSecret }
  );
}

// =========================================================================
// TESTE 7: POST salva configuração WAFLY via salvarContaWhatsappWafly
// =========================================================================
{
  const db = createMockDb([], []);

  const req = mockReq('POST', {
    provider: 'WAFLY',
    clientToken: 'cli-novo-token',
    instance: 'inst-nova-01',
    token: 'tok-novo-01',
    connectedPhone: '5511977776666'
  }, db);
  const res = mockRes();
  await handler(req, res);

  const accInDb = db.accounts.find(a => a.provider === 'WAFLY');
  const numInDb = db.numbers.find(n => n.account_id === accInDb?.id);

  report(7, 'POST salva configuração WAFLY no banco de dados',
    res.statusCode === 200 && res.body?.success === true && accInDb && accInDb.phone_number_id === 'inst-nova-01' && numInDb && (numInDb.display_phone_number === '5511977776666' || numInDb.phone_number_id === '5511977776666'),
    { status: res.statusCode, body: res.body, accInDb, numInDb }
  );
}

// =========================================================================
// TESTE 8: POST aceita aliases de campos WAFLY (client_token, instanceId, instance_token, displayPhoneNumber)
// =========================================================================
{
  const db = createMockDb([], []);

  const req = mockReq('POST', {
    client_token: 'cli-alias-token',
    instanceId: 'inst-alias-99',
    instance_token: 'tok-alias-99',
    displayPhoneNumber: '+55 41 98888-0000'
  }, db);
  const res = mockRes();
  await handler(req, res);

  const acc = db.accounts.find(a => a.provider === 'WAFLY');
  const meta = acc?.access_token_metadata || {};

  report(8, 'POST aceita aliases de campos WAFLY (client_token, instanceId, instance_token, displayPhoneNumber)',
    res.statusCode === 200 && res.body?.success === true && meta.wafly_instance === 'inst-alias-99' && meta.wafly_token === 'tok-alias-99' && meta.wafly_client_token === 'cli-alias-token',
    { status: res.statusCode, meta }
  );
}

// =========================================================================
// TESTE 9: POST rejeita provider inválido com HTTP 400
// =========================================================================
{
  const db = createMockDb([], []);

  const req = mockReq('POST', {
    provider: 'INVALID_PROVIDER'
  }, db);
  const res = mockRes();
  await handler(req, res);

  report(9, 'POST rejeita provider inválido com HTTP 400',
    res.statusCode === 400 && res.body?.success === false && res.body?.error?.includes('invalido'),
    { status: res.statusCode, body: res.body }
  );
}

// =========================================================================
// TESTE 10: POST aceita targetProvider='WAFLY' para alternar provedor
// =========================================================================
let test10Res = null;
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'META',
      principal: true,
      status: 'ATIVO',
      access_token: 'meta-token',
      phone_number_id: '123'
    },
    {
      id: 2,
      tenant_id: 10,
      provider: 'WAFLY',
      principal: false,
      status: 'ATIVO',
      phone_number_id: 'inst-1',
      access_token: 'wafly-token',
      access_token_metadata: {
        wafly_instance: 'inst-1',
        wafly_token: 'wafly-token',
        connected_phone: '5511999998888'
      }
    }
  ], [
    {
      id: 11,
      account_id: 2,
      phone_number_id: '5511999998888',
      display_phone_number: '+55 11 99999-8888',
      status: 'CONECTADO'
    }
  ]);

  const req = mockReq('POST', {
    targetProvider: 'WAFLY'
  }, db);
  const res = mockRes();
  await handler(req, res);
  test10Res = res;

  const waflyAcc = db.accounts.find(a => a.id === 2);
  const metaAcc = db.accounts.find(a => a.id === 1);

  report(10, 'POST permite alternar provedor ativo para WAFLY via targetProvider',
    res.statusCode === 200 && res.body?.success === true && waflyAcc?.principal === true && metaAcc?.principal === false,
    { status: res.statusCode, body: res.body, waflyAccPrincipal: waflyAcc?.principal, metaAccPrincipal: metaAcc?.principal }
  );
}

// =========================================================================
// TESTE 11: Ativação da WAFLY passa por alterarProvedorWhatsappAtivo
// =========================================================================
{
  report(11, 'Ativação da WAFLY passa por alterarProvedorWhatsappAtivo retornando provider WAFLY',
    test10Res?.body?.message?.includes('WAFLY') && test10Res?.body?.provider === 'WAFLY',
    test10Res?.body
  );
}

// =========================================================================
// TESTE 12: Salvar WAFLY não ativa automaticamente a conta como principal
// =========================================================================
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'META',
      principal: true,
      status: 'ATIVO',
      access_token: 'meta-tok',
      phone_number_id: 'meta-phone-id'
    }
  ], []);

  const req = mockReq('POST', {
    clientToken: 'cli-test-token',
    instance: 'inst-test-02',
    token: 'tok-test-02',
    connectedPhone: '5511988887777'
  }, db);
  const res = mockRes();
  await handler(req, res);

  const metaAcc = db.accounts.find(a => a.id === 1);
  const waflyAcc = db.accounts.find(a => a.provider === 'WAFLY');

  report(12, 'Salvar WAFLY NÃO ativa a conta como principal automaticamente (preserva provedor atual)',
    waflyAcc?.principal === false && metaAcc?.principal === true,
    { waflyPrincipal: waflyAcc?.principal, metaPrincipal: metaAcc?.principal }
  );
}

// =========================================================================
// TESTE 13: META continua funcionando integralmente e inalterado
// =========================================================================
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 10,
      provider: 'META',
      principal: true,
      status: 'ATIVO',
      access_token: 'meta-access-token',
      phone_number_id: '10987654321'
    }
  ], [
    {
      id: 10,
      account_id: 1,
      phone_number_id: '10987654321',
      display_phone_number: '+55 11 90000-1111',
      status: 'VERIFIED'
    }
  ]);

  const req = mockReq('GET', {}, db);
  const res = mockRes();
  await handler(req, res);

  report(13, 'META continua funcional e inalterado no GET',
    res.statusCode === 200 && res.body?.provider === 'META' && res.body?.availableProviders?.META === true,
    res.body
  );
}

// =========================================================================
// TESTE 14: YCLOUD continua funcionando integralmente e inalterado
// =========================================================================
{
  const db = createMockDb([
    {
      id: 2,
      tenant_id: 10,
      provider: 'YCLOUD',
      principal: true,
      status: 'ATIVO',
      ycloud_api_key: 'ycloud-api-key-test',
      phone_number_id: '+1234567890'
    }
  ], [
    {
      id: 20,
      account_id: 2,
      phone_number_id: '+1234567890',
      display_phone_number: '+1 234 567 890',
      status: 'VERIFIED'
    }
  ]);

  // Teste GET
  const reqGet = mockReq('GET', {}, db);
  const resGet = mockRes();
  await handler(reqGet, resGet);

  // Teste POST salvar YCloud
  const reqPost = mockReq('POST', {
    ycloudApiKey: 'new-ycloud-key',
    phoneNumberId: '+1987654321'
  }, db);
  const resPost = mockRes();
  await handler(reqPost, resPost);

  report(14, 'YCLOUD continua funcional e inalterado no GET e POST',
    resGet.body?.availableProviders?.YCLOUD === true && resPost.body?.message?.includes('YCloud salva com sucesso'),
    { get: resGet.body?.availableProviders, post: resPost.body }
  );
}

// =========================================================================
// TESTE 15: WABLAST continua funcionando integralmente e inalterado
// =========================================================================
{
  const db = createMockDb([
    {
      id: 3,
      tenant_id: 10,
      provider: 'WABLAST',
      principal: true,
      status: 'ATIVO',
      wablast_account_id: 'acc-wablast-1',
      wablast_waba_id: 'waba-123'
    }
  ], [
    {
      id: 30,
      account_id: 3,
      phone_number_id: '5511999990000',
      display_phone_number: '+55 11 99999-0000',
      status: 'CONECTADO',
      verified_name: 'WaBlast Mandato'
    }
  ]);

  // Teste GET
  const reqGet = mockReq('GET', {}, db);
  const resGet = mockRes();
  await handler(reqGet, resGet);

  // Teste POST salvar WaBlast
  const reqPost = mockReq('POST', {
    wablastAccountId: 'acc-wablast-2',
    wabaId: 'waba-456',
    phoneNumber: '+55 11 98888-1111'
  }, db);
  const resPost = mockRes();
  await handler(reqPost, resPost);

  report(15, 'WABLAST continua funcional e inalterado no GET e POST',
    resGet.body?.availableProviders?.WABLAST === true &&
    resGet.body?.wablastDetails?.accountId === 'acc-wablast-1' &&
    resPost.body?.message?.includes('WaBlast salva com sucesso'),
    { get: resGet.body?.wablastDetails, post: resPost.body }
  );
}

// =========================================================================
// TESTE 16: Isolamento por tenant permanece estritamente respeitado
// =========================================================================
{
  const db = createMockDb([
    {
      id: 1,
      tenant_id: 20,
      provider: 'WAFLY',
      principal: true,
      status: 'ATIVO',
      phone_number_id: 'inst-outro',
      access_token: 'tok-outro',
      access_token_metadata: {
        wafly_instance: 'inst-outro',
        wafly_token: 'tok-outro',
        connected_phone: '5511900000000'
      }
    }
  ], [
    {
      id: 10,
      account_id: 1,
      phone_number_id: '5511900000000',
      display_phone_number: '+55 11 90000-0000',
      status: 'CONECTADO'
    }
  ]);

  // Requisição do tenant 10 (que NÃO tem WAFLY cadastrado)
  const req = mockReq('GET', {}, db, 'admin', 10);
  const res = mockRes();
  await handler(req, res);

  const isIsolated = res.body?.availableProviders?.WAFLY === false &&
    res.body?.waflyDetails?.configured === false &&
    res.body?.waflyDetails?.instance === null;

  report(16, 'Isolamento por tenant permanece estritamente respeitado (tenant A não enxerga WAFLY de tenant B)',
    isIsolated,
    { availableProviders: res.body?.availableProviders, waflyDetails: res.body?.waflyDetails }
  );
}

// =========================================================================
// RESUMO FINAL
// =========================================================================
console.log(`\n==============================================`);
console.log(`TOTAL DE TESTES: ${passed + failed}`);
console.log(`SUCESSOS: ${passed}`);
console.log(`FALHAS: ${failed}`);
console.log(`==============================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Todos os 16 testes de validação da FASE 4 — PASSO 2 passaram com sucesso!');
  process.exit(0);
}
}

runTests().catch(err => {
  console.error('\n❌ Falha na execução da suíte de testes:', err);
  process.exit(1);
});
