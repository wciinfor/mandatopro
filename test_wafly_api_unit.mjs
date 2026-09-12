import assert from 'node:assert';
import { WaflyApiService, createWaflyApiService } from './src/services/wafly-api.js';

console.log('--- TESTES UNITÁRIOS DO CLIENTE WAFLY API ---');

// 1. Teste de Validação de Credenciais
{
  console.log('1. Testando validação de credenciais obrigatórias...');
  const clientSemToken = new WaflyApiService({ instance: 'inst1', token: 'tok1' });
  assert.rejects(
    () => clientSemToken.sendText({ phone: '5511999999999', message: 'teste' }),
    (err) => err.statusCode === 400 && err.error.includes('clientToken é obrigatório')
  );

  const clientSemInstance = new WaflyApiService({ clientToken: 'cli1', token: 'tok1' });
  assert.rejects(
    () => clientSemInstance.sendText({ phone: '5511999999999', message: 'teste' }),
    (err) => err.statusCode === 400 && err.error.includes('instance é obrigatório')
  );

  const clientSemTok = new WaflyApiService({ clientToken: 'cli1', instance: 'inst1' });
  assert.rejects(
    () => clientSemTok.sendText({ phone: '5511999999999', message: 'teste' }),
    (err) => err.statusCode === 400 && err.error.includes('token da instância é obrigatório')
  );
  console.log('   ✓ Rejeição correta para credenciais incompletas');
}

// 2. Teste de Validação de Payload
{
  console.log('2. Testando validação de parâmetros do payload...');
  const client = new WaflyApiService({
    clientToken: 'cli-token-123',
    instance: 'inst-456',
    token: 'tok-secret-789'
  });

  assert.rejects(
    () => client.sendText({ phone: '', message: 'teste' }),
    (err) => err.statusCode === 400 && err.error.includes('phone é obrigatório')
  );

  assert.rejects(
    () => client.sendText({ phone: '5511999999999', message: '   ' }),
    (err) => err.statusCode === 400 && err.error.includes('message é obrigatório')
  );
  console.log('   ✓ Validação prévia de phone e message bem-sucedida');
}

// 3. Teste de Normalização de Telefones
{
  console.log('3. Testando normalização de telefones...');
  const client = new WaflyApiService({ clientToken: 'c', instance: 'i', token: 't' });
  
  assert.strictEqual(client._normalizePhone('+55 (91) 98888-7777'), '5591988887777');
  assert.strictEqual(client._normalizePhone('5591988887777'), '5591988887777');
  assert.strictEqual(client._normalizePhone('120363000000000000-group'), '120363000000000000-group');
  assert.strictEqual(client._normalizePhone('120363000000000000@g.us'), '120363000000000000@g.us');
  assert.strictEqual(client._normalizePhone('abcd1234@newsletter'), 'abcd1234@newsletter');
  console.log('   ✓ Normalização de telefones individuais e especiais (grupo/newsletter) correta');
}

// 4. Teste de Redaction de Segredos em Logs/Erros
{
  console.log('4. Testando redaction de segredos...');
  const client = new WaflyApiService({
    clientToken: 'MEU_CLIENT_TOKEN_SECRETO',
    instance: 'INSTANCIA_123',
    token: 'MEU_TOKEN_SECRETO'
  });

  const textoComTokens = 'Erro ao chamar https://wafly.com.br/api-bridge-whats/instances/INSTANCIA_123/token/MEU_TOKEN_SECRETO/send-text com Client-Token MEU_CLIENT_TOKEN_SECRETO';
  const textoSanitizado = client._redact(textoComTokens);

  assert(!textoSanitizado.includes('MEU_CLIENT_TOKEN_SECRETO'), 'Client-Token não foi redigido');
  assert(!textoSanitizado.includes('MEU_TOKEN_SECRETO'), 'Token da instância não foi redigido');
  assert(textoSanitizado.includes('[REDACTED_WAFLY_TOKEN]'));
  assert(textoSanitizado.includes('[REDACTED_WAFLY_CLIENT_TOKEN]'));
  console.log('   ✓ Redaction de credenciais validado com sucesso:', textoSanitizado);
}

// 5. Teste de Mock de Envio com Sucesso
{
  console.log('5. Testando simulação de request HTTP bem-sucedido...');
  const client = new WaflyApiService({
    clientToken: 'ct-test',
    instance: 'inst-test',
    token: 'tok-test'
  });

  // Intercepta _request para simular resposta HTTP 200 da Wafly
  client._request = async (path, options) => {
    assert.strictEqual(path, '/send-text');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.body.phone, '5511999999999');
    assert.strictEqual(options.body.message, 'Mensagem de Teste');
    assert.strictEqual(options.body.delayMessage, 1500);
    return {
      value: true,
      messageId: '3EB0_TEST_ID_12345'
    };
  };

  const resultado = await client.sendText({
    phone: '+55 (11) 99999-9999',
    message: 'Mensagem de Teste',
    delayMessage: 1500
  });

  assert.deepStrictEqual(resultado, {
    success: true,
    messageId: '3EB0_TEST_ID_12345',
    id: '3EB0_TEST_ID_12345'
  });
  console.log('   ✓ Resposta de sucesso padronizada com messageId e id');
}

// 6. Teste de Simulação de Erro 401 (Credenciais Inválidas)
{
  console.log('6. Testando tratamento de erro 401...');
  const client = new WaflyApiService({
    clientToken: 'ct-invalido',
    instance: 'inst-invalida',
    token: 'tok-invalido'
  });

  // Sobrescreve fetch nativo momentaneamente para simular 401
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ message: 'Invalid credentials' })
  });

  try {
    await client.sendText({ phone: '5511999999999', message: 'Oi' });
    assert.fail('Deveria ter lançado erro');
  } catch (err) {
    assert.strictEqual(err.success, false);
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.provider, 'WAFLY');
    assert(err.error.includes('Credenciais inválidas'));
    console.log('   ✓ Erro 401 mapeado com formato normalizado:', err);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 7. Teste de Simulação de Erro 402 (Assinatura Inadimplente)
{
  console.log('7. Testando tratamento de erro 402...');
  const client = new WaflyApiService({
    clientToken: 'ct-expirado',
    instance: 'inst-expirada',
    token: 'tok-expirado'
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 402,
    statusText: 'Payment Required',
    json: async () => ({ message: 'Subscription expired' })
  });

  try {
    await client.sendText({ phone: '5511999999999', message: 'Oi' });
    assert.fail('Deveria ter lançado erro');
  } catch (err) {
    assert.strictEqual(err.success, false);
    assert.strictEqual(err.statusCode, 402);
    assert.strictEqual(err.provider, 'WAFLY');
    assert(err.error.includes('Assinatura inadimplente'));
    console.log('   ✓ Erro 402 mapeado com formato normalizado:', err);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 8. Teste de Simulação de Timeout
{
  console.log('8. Testando tratamento de timeout...');
  const client = new WaflyApiService({
    clientToken: 'ct',
    instance: 'inst',
    token: 'tok',
    timeoutMs: 50
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  try {
    await client.sendText({ phone: '5511999999999', message: 'Oi' });
    assert.fail('Deveria ter lançado erro');
  } catch (err) {
    assert.strictEqual(err.success, false);
    assert.strictEqual(err.statusCode, 504);
    assert.strictEqual(err.provider, 'WAFLY');
    assert(err.error.includes('Tempo limite'));
    console.log('   ✓ Erro de timeout mapeado com formato normalizado:', err);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('\n========================================');
console.log('TODOS OS 8 TESTES FORAM APROVADOS COM SUCESSO!');
console.log('========================================');
