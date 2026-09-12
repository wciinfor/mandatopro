import assert from 'node:assert';
import { salvarContaWhatsappWafly } from './src/lib/whatsapp-business-accounts.js';

// Mock DB in-memory para validar contratos e isolamento de ponta a ponta
function createMockDatabase() {
  let accounts = [];
  let numbers = [];
  let nextAccId = 1;
  let nextNumId = 1;

  return {
    accounts,
    numbers,
    from: (table) => {
      if (table === 'whatsapp_business_accounts') {
        return {
          select: (cols) => {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
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

                // Anexa números se solicitado
                const attachedNumbers = numbers.filter(n => n.account_id === found.id);
                return Promise.resolve({
                  data: {
                    ...found,
                    whatsapp_business_numbers: attachedNumbers
                  },
                  error: null
                });
              }
            };
            return q;
          },
          insert: (row) => {
            const newRow = { ...row, id: nextAccId++ };
            accounts.push(newRow);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: newRow, error: null })
              })
            };
          },
          update: (updates) => {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              select: () => ({
                single: () => {
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
                  return Promise.resolve({ data: null, error: new Error('Not found') });
                }
              })
            };
            return q;
          }
        };
      }

      if (table === 'whatsapp_business_numbers') {
        return {
          insert: (row) => {
            const newRow = { ...row, id: nextNumId++ };
            numbers.push(newRow);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: newRow, error: null })
              })
            };
          },
          update: (updates) => {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              select: () => ({
                single: () => {
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
                  return Promise.resolve({ data: null, error: new Error('Not found') });
                }
              })
            };
            return q;
          }
        };
      }

      return {};
    }
  };
}

async function runTests() {
  console.log('=== TESTES DE VALIDAÇÃO — FASE 4 / PASSO 1: salvarContaWhatsappWafly ===\n');

  const mockDb = createMockDatabase();
  const usuarioTenant1 = { id: 'usr-1', tenant_id: 10 };
  const usuarioTenant2 = { id: 'usr-2', tenant_id: 20 };

  // Popula contas existentes META, YCLOUD e WABLAST para garantir que NUNCA serão sobrescritas
  mockDb.accounts.push(
    {
      id: 101,
      tenant_id: 10,
      provider: 'META',
      nome: 'Meta Oficial',
      access_token: 'META_TOKEN_PROD',
      waba_id: 'WABA_101',
      status: 'ATIVO',
      principal: true
    },
    {
      id: 102,
      tenant_id: 10,
      provider: 'YCLOUD',
      nome: 'YCloud Oficial',
      ycloud_api_key: 'YCLOUD_KEY_PROD',
      status: 'ATIVO',
      principal: false
    },
    {
      id: 103,
      tenant_id: 10,
      provider: 'WABLAST',
      nome: 'WaBlast Oficial',
      wablast_account_id: 'WABLAST_ACC_103',
      status: 'ATIVO',
      principal: false
    }
  );

  // ─── 1. Criação de conta WAFLY ─────────────────────────────────────────────
  console.log('1. Testando criação de conta WAFLY...');
  const resCriacao = await salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
    clientToken: 'CLIENT_TOKEN_SECRET',
    instance: 'INST_WAFLY_01',
    token: 'INSTANCE_TOKEN_SECRET',
    connectedPhone: '+55 (11) 98888-7777',
    nome: 'Gabinete Wafly'
  });

  assert.strictEqual(resCriacao.success, true);
  assert.strictEqual(resCriacao.provider, 'WAFLY');
  assert.strictEqual(resCriacao.account.instance, 'INST_WAFLY_01');
  assert.strictEqual(resCriacao.number.displayPhoneNumber, '5511988887777');
  assert(resCriacao.account.webhookUrl.includes('/api/whatsapp-business/wafly-webhook?token='));
  assert.strictEqual(resCriacao.account.clientToken, undefined, 'Não pode vazar clientToken');
  assert.strictEqual(resCriacao.account.token, undefined, 'Não pode vazar token');

  // Verifica registro no banco
  const contaDb1 = mockDb.accounts.find(a => a.id === resCriacao.account.id);
  assert.strictEqual(contaDb1.provider, 'WAFLY');
  assert.strictEqual(contaDb1.phone_number_id, 'INST_WAFLY_01');
  assert.strictEqual(contaDb1.access_token, 'INSTANCE_TOKEN_SECRET');
  assert.strictEqual(contaDb1.access_token_metadata.wafly_client_token, 'CLIENT_TOKEN_SECRET');
  assert.strictEqual(contaDb1.access_token_metadata.wafly_instance, 'INST_WAFLY_01');
  assert.strictEqual(contaDb1.access_token_metadata.wafly_token, 'INSTANCE_TOKEN_SECRET');
  assert.strictEqual(contaDb1.access_token_metadata.connected_phone, '5511988887777');
  console.log('   ✓ Caso 1 Aprovado: Conta WAFLY criada com metadados e número vinculados.');

  // ─── 2. Atualização da mesma conta sem duplicidade ─────────────────────────
  console.log('2. Testando atualização da mesma conta sem duplicidade...');
  const contagemAntes = mockDb.accounts.filter(a => a.tenant_id === 10 && a.provider === 'WAFLY').length;

  const resAtualizacao = await salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
    clientToken: 'CLIENT_TOKEN_SECRET_V2',
    instance: 'INST_WAFLY_01',
    token: 'INSTANCE_TOKEN_SECRET_V2',
    connectedPhone: '5511988887777',
    nome: 'Gabinete Wafly Atualizado'
  });

  const contagemDepois = mockDb.accounts.filter(a => a.tenant_id === 10 && a.provider === 'WAFLY').length;
  assert.strictEqual(contagemAntes, contagemDepois, 'Não deve criar linha duplicada');
  assert.strictEqual(resAtualizacao.account.id, resCriacao.account.id, 'Deve atualizar o mesmo ID');
  assert.strictEqual(resAtualizacao.account.nome, 'Gabinete Wafly Atualizado');
  console.log('   ✓ Caso 2 Aprovado: Conta existente atualizada sem duplicação.');

  // ─── 3. Preservação de metadata existente ──────────────────────────────────
  console.log('3. Testando preservação de metadata existente...');
  // Insere metadata personalizada previamente na conta atual do banco
  const contaWaflyAtual = mockDb.accounts.find(a => a.id === resCriacao.account.id);
  contaWaflyAtual.access_token_metadata.custom_setting_mandato = 'valor_preservado_123';

  await salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
    clientToken: 'CLIENT_TOKEN_SECRET_V2',
    instance: 'INST_WAFLY_01',
    token: 'INSTANCE_TOKEN_SECRET_V2',
    connectedPhone: '5511988887777'
  });

  const contaDbAtualizada = mockDb.accounts.find(a => a.id === resCriacao.account.id);
  assert.strictEqual(contaDbAtualizada.access_token_metadata.custom_setting_mandato, 'valor_preservado_123');
  console.log('   ✓ Caso 3 Aprovado: Chaves anteriores de metadata foram preservadas.');

  // ─── 4. Isolamento entre tenant A e tenant B ───────────────────────────────
  console.log('4. Testando isolamento entre tenant A (10) e tenant B (20)...');
  const resTenantB = await salvarContaWhatsappWafly(mockDb, usuarioTenant2, {
    clientToken: 'CT_TENANT_B',
    instance: 'INST_TENANT_B',
    token: 'TOK_TENANT_B',
    connectedPhone: '5521977776666',
    nome: 'Tenant B Wafly'
  });

  assert.strictEqual(resTenantB.account.tenantId, 20);
  assert.notStrictEqual(resTenantB.account.id, resCriacao.account.id);
  const contaTenantB = mockDb.accounts.find(a => a.id === resTenantB.account.id);
  assert.strictEqual(contaTenantB.tenant_id, 20);
  assert.strictEqual(contaTenantB.access_token_metadata.wafly_instance, 'INST_TENANT_B');
  console.log('   ✓ Caso 4 Aprovado: Isolamento estrito entre tenants garantido.');

  // ─── 5. Preservação total de contas META, YCLOUD e WABLAST ──────────────────
  console.log('5. Testando preservação total de contas META, YCLOUD e WABLAST...');
  const metaAcc = mockDb.accounts.find(a => a.id === 101);
  const ycloudAcc = mockDb.accounts.find(a => a.id === 102);
  const wablastAcc = mockDb.accounts.find(a => a.id === 103);

  assert.strictEqual(metaAcc.access_token, 'META_TOKEN_PROD');
  assert.strictEqual(metaAcc.provider, 'META');
  assert.strictEqual(metaAcc.principal, true, 'Meta continua principal');

  assert.strictEqual(ycloudAcc.ycloud_api_key, 'YCLOUD_KEY_PROD');
  assert.strictEqual(ycloudAcc.provider, 'YCLOUD');

  assert.strictEqual(wablastAcc.wablast_account_id, 'WABLAST_ACC_103');
  assert.strictEqual(wablastAcc.provider, 'WABLAST');
  console.log('   ✓ Caso 5 Aprovado: Nenhuma conta de outros provedores foi tocada ou corrompida.');

  // ─── 6. Normalização do telefone ───────────────────────────────────────────
  console.log('6. Testando normalização do telefone...');
  const resPhone = await salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
    clientToken: 'CLIENT_TOKEN',
    instance: 'INST_WAFLY_01',
    token: 'INSTANCE_TOKEN',
    connectedPhone: '+55 (11) 9 1234-5678'
  });
  assert.strictEqual(resPhone.number.displayPhoneNumber, '5511912345678');
  console.log('   ✓ Caso 6 Aprovado: Telefone com caracteres especiais higienizado para apenas dígitos.');

  // ─── 7. Rejeição de credenciais obrigatórias ausentes ───────────────────────
  console.log('7. Testando rejeição de credenciais obrigatórias ausentes...');
  
  await assert.rejects(
    () => salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
      instance: 'INST', token: 'TOK', connectedPhone: '5511999999999'
    }),
    (err) => err.message.includes('Client Token da Wafly é obrigatório') && err.statusCode === 400
  );

  await assert.rejects(
    () => salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
      clientToken: 'CT', token: 'TOK', connectedPhone: '5511999999999'
    }),
    (err) => err.message.includes('ID da Instância da Wafly é obrigatório') && err.statusCode === 400
  );

  await assert.rejects(
    () => salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
      clientToken: 'CT', instance: 'INST', connectedPhone: '5511999999999'
    }),
    (err) => err.message.includes('Token da Instância da Wafly é obrigatório') && err.statusCode === 400
  );

  await assert.rejects(
    () => salvarContaWhatsappWafly(mockDb, usuarioTenant1, {
      clientToken: 'CT', instance: 'INST', token: 'TOK'
    }),
    (err) => err.message.includes('Número de WhatsApp conectado é obrigatório') && err.statusCode === 400
  );
  console.log('   ✓ Caso 7 Aprovado: Todas as validações obrigatórias foram rejeitadas com HTTP 400.');

  // ─── 8. Nenhuma ativação automática como principal ─────────────────────────
  console.log('8. Testando que WAFLY NÃO é ativada automaticamente como principal...');
  const contaWaflyFinal = mockDb.accounts.find(a => a.tenant_id === 10 && a.provider === 'WAFLY');
  assert.strictEqual(contaWaflyFinal.principal, false, 'WAFLY não deve ser principal na criação');
  assert.strictEqual(metaAcc.principal, true, 'META continua sendo o provedor principal ativo');
  console.log('   ✓ Caso 8 Aprovado: principal=false mantido, sem ativação automática espúria.');

  console.log('\n======================================================================');
  console.log('TODOS OS 8 TESTES DA FASE 4 — PASSO 1 FORAM APROVADOS COM SUCESSO!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Falha na execução dos testes:', err);
  process.exit(1);
});
