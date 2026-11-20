/**
 * Bateria de Testes Automatizados para a Integração VibeWhats API
 * 
 * 1. Criptografia e Proteção de Segredos (AES-256-GCM)
 * 2. Isolamento Multi-Tenant e Autenticação
 * 3. Cliente VibeWhatsApiService (getStatus, getQrCodeImage, sendText com mocks)
 * 4. Provider Factory (META, YCLOUD, WABLAST, WAFLY, VIBEWHATS)
 * 5. Sanitização de logs (_redact)
 */

import assert from 'assert';

// Configura a chave de criptografia de teste no ambiente para a suíte de testes
process.env.CREDENTIALS_ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'chave-de-teste-unitario-segura-32-chars-ok';

import { encryptCredential, decryptCredential } from './src/lib/credential-crypto.js';
import { VibeWhatsApiService, createVibeWhatsApiService } from './src/services/vibewhats-api.js';
import { createWhatsAppProvider, VibeWhatsWhatsAppAdapter } from './src/services/whatsapp-provider-factory.js';
import { VibeWhatsWebhookNormalizer } from './src/services/vibewhatsWebhookNormalizer.js';
import webhookHandler from './src/pages/api/whatsapp-business/vibewhats-webhook.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

console.log('--- INICIANDO TESTES VIBEWHATS MANDATOPRO ---');

// 1. Criptografia AES-256-GCM
test('Criptografia AES-256-GCM cifra e decifra corretamente', () => {
  const secret = 'vibe_token_producao_123456_!@#$';
  const encrypted = encryptCredential(secret);
  assert(encrypted.startsWith('enc:v1:'), 'Ciphertext deve ter prefixo enc:v1:');
  assert.notStrictEqual(encrypted, secret, 'Texto cifrado deve ser diferente do original');

  const decrypted = decryptCredential(encrypted);
  assert.strictEqual(decrypted, secret, 'Descriptografia deve reconstituir o segredo');
});

test('Criptografia é idempotente e aceita texto legado', () => {
  const plain = 'token_antigo_sem_cifra';
  const decrypted = decryptCredential(plain);
  assert.strictEqual(decrypted, plain, 'Texto legado não cifrado é retornado intacto');

  const encrypted1 = encryptCredential('segredo');
  const encrypted2 = encryptCredential(encrypted1);
  assert.strictEqual(encrypted1, encrypted2, 'Não deve cifrar duplamente');
});

// 2. Mascaramento e Redaction de Segredos em Logs
test('Sanitização _redact remove segredos de mensagens e URLs', () => {
  const service = new VibeWhatsApiService({
    instance: 'INST_GABINETE_01',
    token: 'TOKEN_SUPER_SECRETO_987',
    clientToken: 'CLIENT_TOKEN_CONFIDENCIAL'
  });

  const urlComToken = 'https://api.vibewhats.site/instances/INST_GABINETE_01/token/TOKEN_SUPER_SECRETO_987/send-text';
  const sanitizada = service._redact(urlComToken);
  assert(!sanitizada.includes('TOKEN_SUPER_SECRETO_987'), 'Token da URL não deve estar presente');
  assert(sanitizada.includes('[REDACTED_VIBEWHATS_TOKEN]'), 'Deve substituir pelo placeholder');

  const logComClientToken = 'Falha com CLIENT_TOKEN_CONFIDENCIAL no header';
  const sanitizadaClient = service._redact(logComClientToken);
  assert(!sanitizadaClient.includes('CLIENT_TOKEN_CONFIDENCIAL'), 'Client token não deve vazar');
});

// 3. Normalização de Telefones
test('Normalização de telefones extrai dígitos e respeita grupos/newsletters', () => {
  const service = new VibeWhatsApiService({ instance: 'I', token: 'T' });
  assert.strictEqual(service._normalizePhone('+55 (11) 98765-4321'), '5511987654321');
  assert.strictEqual(service._normalizePhone('5561999999999'), '5561999999999');
  assert.strictEqual(service._normalizePhone('120363@newsletter'), '120363@newsletter');
  assert.strictEqual(service._normalizePhone('120363XXXX-group'), '120363XXXX-group');
});

// 4. Provider Factory e Regressão de Provedores
test('Provider Factory instancia corretamente todos os provedores suportados', () => {
  const pMeta = createWhatsAppProvider({ provider: 'META' });
  assert.strictEqual(pMeta.constructor.name, 'MetaWhatsAppAdapter');

  const pWablast = createWhatsAppProvider({ provider: 'WABLAST' });
  assert.strictEqual(pWablast.constructor.name, 'WaBlastWhatsAppAdapter');

  const pYcloud = createWhatsAppProvider({ provider: 'YCLOUD', ycloudApiKey: 'dummy' });
  assert.strictEqual(pYcloud.constructor.name, 'YCloudWhatsAppAdapter');

  const pWafly = createWhatsAppProvider({ provider: 'WAFLY' });
  assert.strictEqual(pWafly.constructor.name, 'WaflyWhatsAppAdapter');

  const pVibe = createWhatsAppProvider({ provider: 'VIBEWHATS' });
  assert.strictEqual(pVibe.constructor.name, 'VibeWhatsWhatsAppAdapter');
});

// 5. Testes com Mock de Resposta da API VibeWhats
await testAsync('Mock: VibeWhatsApiService.getStatus com resposta de sucesso', async () => {
  const service = new VibeWhatsApiService({ instance: 'TEST_ID', token: 'TEST_TOK' });

  // Mock do método _request
  service._request = async (path, opts) => {
    assert.strictEqual(path, '/status');
    return {
      connected: true,
      smartphoneConnected: true,
      phone: '5561988887777',
      state: 'open'
    };
  };

  const status = await service.getStatus();
  assert.strictEqual(status.connected, true);
  assert.strictEqual(status.phone, '5561988887777');
  assert.strictEqual(status.status, 'CONNECTED');
});

await testAsync('Mock: VibeWhatsApiService.getQrCodeImage com resposta direta', async () => {
  const service = new VibeWhatsApiService({ instance: 'TEST_ID', token: 'TEST_TOK' });

  service._request = async (path, opts) => {
    assert.strictEqual(path, '/qr-code/image');
    return {
      isBinary: true,
      mime: 'image/png',
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    };
  };

  const qr = await service.getQrCodeImage();
  assert.strictEqual(qr.success, true);
  assert(qr.qrCode.startsWith('data:image/png;base64,'));
});

await testAsync('Mock: VibeWhatsApiService.sendText formata payload e retorna IDs', async () => {
  const service = new VibeWhatsApiService({ instance: 'TEST_ID', token: 'TEST_TOK' });

  let sentPayload = null;
  service._request = async (path, opts) => {
    assert.strictEqual(path, '/send-text');
    assert.strictEqual(opts.method, 'POST');
    sentPayload = opts.body;
    return {
      zaapId: 'ZAAP_999888',
      messageId: 'MSG_12345678',
      id: 'MSG_12345678'
    };
  };

  const res = await service.sendText({
    phone: '+55 (61) 99999-0000',
    message: 'Mensagem de teste unitário'
  });

  assert.strictEqual(sentPayload.phone, '5561999990000');
  assert.strictEqual(sentPayload.message, 'Mensagem de teste unitário');
  assert.strictEqual(res.messageId, 'MSG_12345678');
  assert.strictEqual(res.zaapId, 'ZAAP_999888');
});

await testAsync('Mock: VibeWhatsWhatsAppAdapter integração unificada', async () => {
  const adapter = new VibeWhatsWhatsAppAdapter({
    provider: 'VIBEWHATS',
    vibewhatsInstance: 'INST_TENANT_A',
    vibewhatsToken: encryptCredential('TOKEN_SECRETO_A')
  });

  // Mock interno do service
  adapter.service._request = async (path, opts) => {
    return {
      messageId: 'ADAPTER_MSG_ID_1',
      id: 'ADAPTER_MSG_ID_1'
    };
  };

  const res = await adapter.sendMessage({
    to: '5561911112222',
    message: 'Teste de adapter'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.provider, 'VIBEWHATS');
  assert.strictEqual(res.messageId, 'ADAPTER_MSG_ID_1');
});

// ─── 6. TESTES DO WEBHOOK & NORMALIZADOR VIBEWHATS ──────────────────────────

test('Normalizador: Inbound de texto simples (Padrão Z-API)', () => {
  const payloadZApi = {
    event: 'ReceivedCallback',
    instanceId: 'INST_ABC_123',
    messageId: 'WPA_MSG_998877',
    phone: '556199887766',
    fromMe: false,
    momment: 1732035600000,
    status: 'RECEIVED',
    text: {
      message: 'Olá, gostaria de saber mais sobre o projeto!'
    },
    senderName: 'João da Silva'
  };

  const evento = VibeWhatsWebhookNormalizer.normalizarEvento(payloadZApi);

  assert.strictEqual(evento.tipo, 'mensagem');
  assert.strictEqual(evento.direcao, 'inbound');
  assert.strictEqual(evento.provider, 'VIBEWHATS');
  assert.strictEqual(evento.provider_message_id, 'WPA_MSG_998877');
  assert.strictEqual(evento.contact_id, '556199887766');
  assert.strictEqual(evento.contato_nome, 'João da Silva');
  assert.strictEqual(evento.conteudo, 'Olá, gostaria de saber mais sobre o projeto!');
  assert.strictEqual(evento.metadata.instanceId, 'INST_ABC_123');
  assert.strictEqual(evento.metadata.fromMe, false);
});

test('Normalizador: Outbound é identificado com direcao=outbound', () => {
  const payloadOutbound = {
    event: 'ReceivedCallback',
    messageId: 'WPA_OUT_001',
    phone: '556199887766',
    fromMe: true,
    text: { message: 'Resposta enviada pelo operador' }
  };

  const evento = VibeWhatsWebhookNormalizer.normalizarEvento(payloadOutbound);
  assert.strictEqual(evento.tipo, 'mensagem');
  assert.strictEqual(evento.direcao, 'outbound');
  assert.strictEqual(evento.metadata.fromMe, true);
});

test('Normalizador: Status e Confirmação de Entrega (DeliveryCallback)', () => {
  const payloadDelivery = {
    event: 'DeliveryCallback',
    instanceId: 'INST_ABC_123',
    messageId: 'WPA_MSG_DELIV_01',
    phone: '5561988880000',
    status: 'DELIVERED'
  };

  const evento = VibeWhatsWebhookNormalizer.normalizarEvento(payloadDelivery);
  assert.strictEqual(evento.tipo, 'status');
  assert.strictEqual(evento.provider, 'VIBEWHATS');
  assert.strictEqual(evento.status, 'delivered');
  assert.strictEqual(evento.provider_message_id, 'WPA_MSG_DELIV_01');
  assert.strictEqual(evento.contact_id, '5561988880000');
});

test('Normalizador: Sanitização de segredos em metadados', () => {
  const payloadComSegredo = {
    token: 'segredo_ultra_confidencial',
    clientToken: 'client_token_privado',
    data: {
      messageId: 'MSG_SEC_01',
      phone: '5561999991111',
      text: 'Texto seguro'
    }
  };

  const evento = VibeWhatsWebhookNormalizer.normalizarEvento(payloadComSegredo);
  assert.strictEqual(evento.metadata.rawPayload.token, '[REDACTED]');
  assert.strictEqual(evento.metadata.rawPayload.clientToken, '[REDACTED]');
});

await testAsync('Webhook Handler: Rejeita requisição sem token com HTTP 401', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const req = {
    method: 'POST',
    query: {},
    body: { text: 'oi' }
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 401);
  assert.strictEqual(jsonResponse.success, false);
});

await testAsync('Webhook Handler: Rejeita método GET com HTTP 405', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const req = {
    method: 'GET',
    query: { token: 'teste' },
    body: {}
  };

  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 405);
});

await testAsync('Webhook Handler: Rejeita token inexistente com HTTP 401', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const mockSupabase = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        })
      })
    })
  };

  const req = {
    method: 'POST',
    query: { token: 'token_falso_inexistente' },
    body: { messageId: '123' },
    supabaseClient: mockSupabase
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 401);
});

await testAsync('Webhook Handler: Descarta outbound (fromMe: true) sem erro', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'whatsapp_business_accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 11, tenant_id: 1, provider: 'VIBEWHATS' },
                  error: null
                })
              })
            })
          })
        };
      }
      return {
        insert: async () => ({ error: null })
      };
    }
  };

  const req = {
    method: 'POST',
    query: { token: 'token_valido' },
    body: {
      messageId: 'MSG_OUT_001',
      phone: '5561999990000',
      fromMe: true,
      text: { message: 'Msg saindo' }
    },
    supabaseClient: mockSupabase
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.ignored, true);
});

await testAsync('Webhook Handler: Idempotência - detecta mensagem duplicada', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'whatsapp_business_accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 11, tenant_id: 1, provider: 'VIBEWHATS' },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { id: 'msg_uuid_ja_existente' }
                })
              })
            })
          })
        };
      }
      return {
        insert: async () => ({ error: null })
      };
    }
  };

  const req = {
    method: 'POST',
    query: { token: 'token_valido' },
    body: {
      messageId: 'MSG_REPETIDA_001',
      phone: '5561999990000',
      fromMe: false,
      text: { message: 'Mensagem já recebida' }
    },
    supabaseClient: mockSupabase
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(jsonResponse.duplicate, true);
});

// ─── 7. TESTES DE ISOLAMENTO MULTI-TENANT, CONCORRÊNCIA E ROTEAMENTO ─────────

import { processarEventoMensagem, processarEventoStatus } from './src/services/processarEventoComunicacao.js';
import { resolverContaWhatsappDaConversa } from './src/lib/whatsapp-business-accounts.js';

await testAsync('Isolamento Multi-tenant: Rejeita processamento se tenant_id não for resolvido', async () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null })
        })
      })
    })
  };

  const eventoSemTenant = {
    provider: 'VIBEWHATS',
    provider_message_id: 'WPA_NO_TENANT_01',
    contact_id: '5561999990000',
    conteudo: 'Teste sem tenant'
  };

  const res = await processarEventoMensagem(mockSupabase, eventoSemTenant);
  assert.strictEqual(res.success, false);
  assert(res.error.includes('tenant_id não resolvido'));
});

await testAsync('Isolamento Multi-tenant: Filtra eleitor e conversa pelo tenant_id correto', async () => {
  let eleitorTenantFilter = null;
  let conversaTenantFilter = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'communication_messages' || table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 101, tenant_id: 42 } })
            })
          })
        };
      }
      if (table === 'eleitores') {
        return {
          select: () => ({
            eq: (col, val) => {
              if (col === 'tenant_id') eleitorTenantFilter = val;
              return {
                or: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: 999, nome: 'Eleitor Gabinete 42' } })
                  })
                })
              };
            }
          })
        };
      }
      if (table === 'communication_conversations') {
        return {
          select: () => ({
            eq: (col, val) => {
              if (col === 'tenant_id') conversaTenantFilter = val;
              return {
                eq: () => ({
                  neq: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { id: 505, tenant_id: 42 } })
                    })
                  })
                })
              };
            }
          }),
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
      if (table === 'atendimento_connect_conversas') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  { id: 1, metadata: { tenant_id: 99 } }, // Outro tenant
                  { id: 2, metadata: { tenant_id: 42 } }  // Tenant correto
                ]
              })
            })
          }),
          update: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) })
      };
    }
  };

  const eventoTenant42 = {
    tenant_id: 42,
    account_id: 11,
    provider: 'VIBEWHATS',
    provider_message_id: 'WPA_MSG_TENANT_42',
    contact_id: '5561999998888',
    conteudo: 'Mensagem do gabinete 42'
  };

  const res = await processarEventoMensagem(mockSupabase, eventoTenant42);
  assert.strictEqual(res.success, true);
  assert.strictEqual(eleitorTenantFilter, 42, 'Eleitor deve ser filtrado exclusivamente pelo tenant 42');
  assert.strictEqual(conversaTenantFilter, 42, 'Conversa communication deve ser filtrada pelo tenant 42');
});

await testAsync('Concorrência: Idempotência com código 23505 (Unique Violation) tratada sem erro', async () => {
  const mockSupabase = {
    from: (table) => {
      if (table === 'communication_messages' || table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }) // SELECT simulando race condition (ambos nulos)
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => {
                // Erro simulado de banco na tentativa concorrente de inserção
                const err = new Error('duplicate key value violates unique constraint');
                err.code = '23505';
                return { data: null, error: err };
              }
            })
          })
        };
      }
      if (table === 'eleitores') {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) })
            })
          })
        };
      }
      if (table === 'communication_conversations') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ neq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 1 } }) }) }) }) })
          }),
          update: () => ({ eq: async () => ({ error: null }) })
        };
      }
      if (table === 'atendimento_connect_conversas') {
        return {
          select: () => ({
            eq: () => ({ eq: async () => ({ data: [{ id: 1, metadata: { tenant_id: 1 } }] }) })
          }),
          update: () => ({ eq: async () => ({ error: null }) })
        };
      }
      return {};
    }
  };

  const eventoConcorrente = {
    tenant_id: 1,
    provider: 'VIBEWHATS',
    provider_message_id: 'WPA_RACE_CONDITION_01',
    contact_id: '5561999990000',
    conteudo: 'Mensagem com colisão de chave'
  };

  const res = await processarEventoMensagem(mockSupabase, eventoConcorrente);
  assert.strictEqual(res.success, true, 'Deve absorver 23505 sem quebrar');
});

await testAsync('Roteamento de Resposta: resolverContaWhatsappDaConversa seleciona VibeWhats pela última mensagem', async () => {
  const contasTenant = [
    {
      id: 8,
      tenant_id: 1,
      provider: 'WAFLY',
      principal: true,
      status: 'ATIVO',
      whatsapp_business_numbers: [{ id: 7, phone_number_id: 'inst_wafly', display_phone_number: '559180896907' }]
    },
    {
      id: 11,
      tenant_id: 1,
      provider: 'VIBEWHATS',
      principal: false,
      status: 'ATIVO',
      whatsapp_business_numbers: [{ id: 9, phone_number_id: 'inst_vibe', display_phone_number: '5591981755021' }]
    }
  ];

  const mockSupabase = {
    from: (table) => {
      if (table === 'whatsapp_business_accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: contasTenant, error: null })
            })
          })
        };
      }
      if (table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: 50,
                        direcao: 'entrada',
                        raw_payload: {
                          provider: 'VIBEWHATS',
                          account_id: 11,
                          to: '5591981755021'
                        }
                      }
                    })
                  })
                })
              })
            })
          })
        };
      }
      return {};
    }
  };

  const conversa = {
    id: 123,
    tenant_id: 1,
    metadata: {
      origem: 'vibewhats',
      provider: 'VIBEWHATS',
      account_id: 11
    }
  };

  const { conta, resolucaoInfo } = await resolverContaWhatsappDaConversa(mockSupabase, conversa, { tenant_id: 1 });

  assert.strictEqual(conta.id, 11, 'Deve resolver a conta VIBEWHATS ID 11');
  assert.strictEqual(conta.provider, 'VIBEWHATS', 'Provedor deve ser VIBEWHATS');
  assert.strictEqual(resolucaoInfo.provider, 'VIBEWHATS');
});

// ─── 8. TESTES DA TABELA DE IDEMPOTÊNCIA ATÔMICA (MIGRATION 265) ─────────────

import { WhatsAppInboundIdempotencyService } from './src/services/whatsapp-inbound-idempotency.js';

await testAsync('Idempotência Atômica: Adquire reserva inédita com status PROCESSING', async () => {
  let insertPayload = null;
  const mockSupabase = {
    rpc: async () => ({ data: null, error: new Error('RPC offline') }),
    from: (table) => ({
      insert: (payload) => {
        insertPayload = payload;
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { id: 777 }, error: null })
          })
        };
      }
    })
  };

  const res = await WhatsAppInboundIdempotencyService.adquirirReserva(mockSupabase, {
    tenantId: 1,
    provider: 'VIBEWHATS',
    accountId: 11,
    instanceId: 'INST_01',
    providerMessageId: 'WPA_IDEM_TEST_01'
  });

  assert.strictEqual(res.adquirido, true);
  assert.strictEqual(res.duplicada, false);
  assert.strictEqual(res.reservaId, 777);
  assert.strictEqual(insertPayload.status, 'PROCESSING');
  assert.strictEqual(insertPayload.provider_message_id, 'WPA_IDEM_TEST_01');
});

await testAsync('Idempotência Atômica: Detecta colisão (23505) e identifica duplicata COMPLETED', async () => {
  const mockSupabase = {
    rpc: async () => ({ data: null, error: new Error('RPC offline') }),
    from: (table) => ({
      insert: () => ({
        select: () => ({
          maybeSingle: async () => {
            const err = new Error('duplicate key');
            err.code = '23505';
            return { data: null, error: err };
          }
        })
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 888, status: 'COMPLETED', locked_at: new Date().toISOString() }
                })
              })
            })
          })
        })
      })
    })
  };

  const res = await WhatsAppInboundIdempotencyService.adquirirReserva(mockSupabase, {
    tenantId: 1,
    provider: 'VIBEWHATS',
    accountId: 11,
    providerMessageId: 'WPA_IDEM_TEST_DUPLICATE'
  });

  assert.strictEqual(res.adquirido, false);
  assert.strictEqual(res.duplicada, true);
  assert.strictEqual(res.reservaId, 888);
});

await testAsync('Idempotência Atômica: Falha transitória libera reserva para FAILED e permite retentativa', async () => {
  let updatedStatus = null;
  let updatedError = null;

  const mockSupabase = {
    rpc: async (name, params) => {
      if (name === 'liberar_reserva_inbound') {
        updatedStatus = 'FAILED';
        updatedError = params.p_erro;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: (table) => ({
      update: (payload) => {
        updatedStatus = payload.status;
        updatedError = payload.last_error;
        return {
          eq: () => ({
            eq: async () => ({ error: null })
          })
        };
      }
    })
  };

  await WhatsAppInboundIdempotencyService.liberarReserva(mockSupabase, 999, 1, 'Erro de timeout de conexão com Supabase');

  assert.strictEqual(updatedStatus, 'FAILED');
  assert(updatedError.includes('Erro de timeout de conexão'));
});

await testAsync('Idempotência Atômica: Reativa lock expirado (> 60s) para permitir nova tentativa', async () => {
  let lockAtualizado = false;

  const dataPassada = new Date(Date.now() - 120000).toISOString(); // 2 minutos atrás (expirado)
  const mockSupabase = {
    rpc: async () => ({ data: null, error: new Error('RPC offline') }),
    from: (table) => ({
      insert: () => ({
        select: () => ({
          maybeSingle: async () => {
            const err = new Error('duplicate key');
            err.code = '23505';
            return { data: null, error: err };
          }
        })
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 1010, status: 'PROCESSING', locked_at: dataPassada }
                })
              })
            })
          })
        })
      }),
      update: () => {
        lockAtualizado = true;
        return { eq: async () => ({ error: null }) };
      }
    })
  };

  const res = await WhatsAppInboundIdempotencyService.adquirirReserva(mockSupabase, {
    tenantId: 1,
    provider: 'VIBEWHATS',
    accountId: 11,
    providerMessageId: 'WPA_IDEM_EXPIRED_LOCK'
  });

  assert.strictEqual(res.adquirido, true);
  assert.strictEqual(lockAtualizado, true, 'Deve ter atualizado o lock expirado');
});

// ─── 9. TESTES DE CONCORRÊNCIA, FENCING TOKEN E RETENTATIVA SEGURA ───────────

await testAsync('Fencing Token: Impede que tentativa antiga conclua reserva após nova tentativa ter assumido', async () => {
  let attemptChecked = null;
  const mockSupabase = {
    rpc: async (name, params) => {
      if (name === 'concluir_reserva_inbound') {
        attemptChecked = params.p_fencing_token;
        // Simula falha se o token for antigo (ex: token 1 tentando concluir quando o banco já está no attempt 2)
        if (params.p_fencing_token < 2) return { data: false, error: null };
        return { data: true, error: null };
      }
      return { data: null, error: null };
    }
  };

  const resultadoAntigo = await WhatsAppInboundIdempotencyService.concluirReserva(mockSupabase, 555, 1);
  assert.strictEqual(resultadoAntigo, false, 'Execução antiga com fencing token 1 deve ser rejeitada');

  const resultadoNovo = await WhatsAppInboundIdempotencyService.concluirReserva(mockSupabase, 555, 2);
  assert.strictEqual(resultadoNovo, true, 'Execução com fencing token 2 atualizado deve ser aceita');
});

await testAsync('Concorrência Webhook: Retorna HTTP 429 se o evento já estiver PROCESSING em outro nó', async () => {
  let statusCode = null;
  let jsonResponse = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'whatsapp_business_accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 11, tenant_id: 1, provider: 'VIBEWHATS' },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'atendimento_connect_mensagens' || table === 'communication_messages') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
              limit: () => ({ maybeSingle: async () => ({ data: null }) })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) })
        }),
        insert: async () => ({ error: null })
      };
    },
    rpc: async (name) => {
      if (name === 'adquirir_reserva_inbound') {
        // Simula que outro nó já está com lock ativo (bloqueada: true, sucesso: false, duplicada: false)
        return {
          data: [{ sucesso: false, duplicada: false, bloqueada: true, reserva_id: 999, fencing_token: 1 }],
          error: null
        };
      }
      return { data: null, error: null };
    }
  };

  const req = {
    method: 'POST',
    query: { token: 'token_valido' },
    body: {
      messageId: 'WPA_MSG_CONCORRENTE_EM_PROCESSAMENTO',
      phone: '5561999990000',
      fromMe: false,
      text: { message: 'Mensagem concorrente' }
    },
    supabaseClient: mockSupabase
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { jsonResponse = data; }
      };
    }
  };

  await webhookHandler(req, res);
  assert.strictEqual(statusCode, 429, 'Deve responder HTTP 429 para que o provedor retente');
  assert.strictEqual(jsonResponse.locked, true);
  assert.strictEqual(jsonResponse.success, false);
});

// ─── 9. TESTES DE HOMOLOGAÇÃO: CONVERSAS LEGADAS E ISOLAMENTO ──────────────
await testAsync('Conversa Legada: Associa com segurança se campanha_id pertencer comprovadamente ao mesmo tenant', async () => {
  let conversaAtualizadaId = null;
  let mensagemInseridaConnect = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'atendimento_connect_conversas') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  {
                    id: 6,
                    eleitor_id: null,
                    campanha_id: 156,
                    contato_nome: 'Alcântara Sistemas',
                    contato_telefone: '559193121501',
                    canal: 'whatsapp',
                    status: 'nova',
                    metadata: { instanceId: '3BC850512297F92832DDE3A475125689' },
                    communication_campaigns: { id: 156, tenant_id: 1 }
                  }
                ],
                error: null
              })
            })
          }),
          update: () => ({
            eq: async (col, val) => {
              conversaAtualizadaId = val;
              return { error: null };
            }
          })
        };
      }
      if (table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: async (payload) => {
            mensagemInseridaConnect = payload;
            return { error: null };
          }
        };
      }
      if (table === 'communication_campaign_items') {
        return {
          select: () => ({
            in: () => ({
              in: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      eq: () => ({
                        limit: async () => ({ data: [], error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        };
      }
      if (table === 'communication_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 15269 } }) }) })
        };
      }
      if (table === 'communication_conversations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 6 } }) }) }) }) }) }),
          update: () => ({ eq: async () => ({ error: null }) })
        };
      }
      if (table === 'eleitores') {
        return {
          select: () => ({ eq: () => ({ or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        insert: () => ({ error: null })
      };
    },
    rpc: async (fn, params) => {
      if (fn === 'adquirir_reserva_inbound') {
        return { data: [{ sucesso: true, reserva_id: 1, fencing_token: 1 }], error: null };
      }
      if (fn === 'concluir_reserva_inbound') {
        return { data: true, error: null }; // boolean → retorno imediato, sem fallback .from
      }
      if (fn === 'liberar_reserva_inbound') {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    }
  };

  const { processarEventoMensagem } = await import('./src/services/processarEventoComunicacao.js');
  const evento = {
    tipo: 'mensagem',
    provider: 'VIBEWHATS',
    tenant_id: 1,
    account_id: 11,
    provider_message_id: 'WPA_LEGACY_CAMP_MATCH_01',
    contact_id: '559193121501',
    contato_nome: 'Alcântara Sistemas',
    conteudo: 'Mensagem inbound em conversa legada',
    timestamp: new Date().toISOString(),
    phone_number_id: '3BC850512297F92832DDE3A475125689',
    metadata: {
      instanceId: '3BC850512297F92832DDE3A475125689'
    }
  };

  const res = await processarEventoMensagem(mockSupabase, evento);
  assert.strictEqual(res.success, true);
  assert.strictEqual(conversaAtualizadaId, 6, 'Deve atualizar exatamente a conversa legada ID 6 vinculada à campanha do tenant 1');
  assert.strictEqual(mensagemInseridaConnect.conversa_id, 6, 'Deve persistir a mensagem na conversa 6');
  assert.strictEqual(mensagemInseridaConnect.provider_message_id, 'WPA_LEGACY_CAMP_MATCH_01');
  assert.strictEqual(mensagemInseridaConnect.raw_payload.account_id, 11);
  assert.strictEqual(mensagemInseridaConnect.raw_payload.provider, 'VIBEWHATS');
});

await testAsync('Conversa Legada: Rejeita reaproveitamento se a campanha pertencer a outro tenant', async () => {
  let conversaCriada = false;
  let conversaAtualizadaId = null;

  const mockSupabase = {
    from: (table) => {
      if (table === 'atendimento_connect_conversas') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [
                  {
                    id: 99,
                    eleitor_id: null,
                    campanha_id: 999,
                    contato_nome: 'Contato Outro Tenant',
                    contato_telefone: '559193121501',
                    canal: 'whatsapp',
                    status: 'nova',
                    metadata: {},
                    communication_campaigns: { id: 999, tenant_id: 2 } // Outro tenant!
                  }
                ],
                error: null
              })
            })
          }),
          insert: () => {
            conversaCriada = true;
            return {
              select: () => ({ single: async () => ({ data: { id: 500 } }) })
            };
          },
          update: () => ({
            eq: async (col, val) => {
              conversaAtualizadaId = val;
              return { error: null };
            }
          })
        };
      }
      if (table === 'atendimento_connect_mensagens') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: async () => ({ error: null })
        };
      }
      if (table === 'communication_campaign_items') {
        return {
          select: () => ({
            in: () => ({
              in: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      eq: () => ({
                        limit: async () => ({ data: [], error: null })
                      })
                    })
                  })
                })
              })
            })
          })
        };
      }
      if (table === 'communication_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 15270 } }) }) })
        };
      }
      if (table === 'communication_conversations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 500 } }) }) }),
          update: () => ({ eq: async () => ({ error: null }) })
        };
      }
      if (table === 'eleitores') {
        return {
          select: () => ({ eq: () => ({ or: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) })
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        insert: () => ({ error: null })
      };
    },
    rpc: async () => ({ data: [{ sucesso: true, reserva_id: 1, fencing_token: 1 }], error: null })
  };

  const { processarEventoMensagem } = await import('./src/services/processarEventoComunicacao.js');
  const evento = {
    tipo: 'mensagem',
    provider: 'VIBEWHATS',
    tenant_id: 1,
    account_id: 11,
    provider_message_id: 'WPA_OTHER_TENANT_REJECT_01',
    contact_id: '559193121501',
    contato_nome: 'Contato Outro Tenant',
    conteudo: 'Tentativa de associação cruzada',
    timestamp: new Date().toISOString(),
    phone_number_id: '3BC850512297F92832DDE3A475125689',
    metadata: {
      instanceId: '3BC850512297F92832DDE3A475125689'
    }
  };

  const res = await processarEventoMensagem(mockSupabase, evento);
  assert.strictEqual(conversaAtualizadaId, null, 'NÃO deve atualizar conversa com campanha de outro tenant');
  assert.strictEqual(conversaCriada, true, 'Deve tentar criar nova conversa isolada');
});

console.log(`\n--- RESULTADOS FINAIS: ${passed} PASSOU | ${failed} FALHOU ---`);
if (failed > 0) {
  process.exit(1);
}
