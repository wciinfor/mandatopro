import assert from 'node:assert/strict';
import handler from './src/pages/api/atendimento-connect/mensagens/[id]/media.js';

console.log('🧪 Iniciando suíte de testes da ETAPA 2 (media.js)...\n');

import { Writable } from 'stream';

function createMockRes() {
  const chunks = [];
  let statusCode = 200;
  const headers = {};
  let body = null;
  let ended = false;

  const res = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    }
  });

  res.status = function(code) {
    statusCode = code;
    return res;
  };
  res.setHeader = function(k, v) {
    headers[k.toLowerCase()] = v;
  };
  res.json = function(data) {
    body = data;
    ended = true;
    res.end();
    return res;
  };
  res.send = function(data) {
    body = data;
    ended = true;
    res.end();
    return res;
  };

  Object.defineProperty(res, 'statusCode', {
    get() { return statusCode; },
    set(v) { statusCode = v; }
  });
  Object.defineProperty(res, 'headers', {
    get() { return headers; }
  });
  Object.defineProperty(res, 'body', {
    get() {
      if (body !== null) return body;
      if (chunks.length > 0) return Buffer.concat(chunks);
      return null;
    }
  });
  Object.defineProperty(res, 'ended', {
    get() { return ended || res.writableEnded; }
  });

  return res;
}

// Mock de dados e supabase
function createMockSupabase({ mensagens = [], conversas = [], accounts = [] } = {}) {
  return {
    from(table) {
      if (table === 'atendimento_connect_mensagens') {
        return {
          select(cols) {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              order() { return q; },
              limit() { return q; },
              maybeSingle() {
                let msg = null;
                if (filters.id !== undefined) {
                  msg = mensagens.find(m => m.id === filters.id);
                } else if (filters.conversa_id !== undefined) {
                  msg = mensagens.find(m => m.conversa_id === filters.conversa_id && (!filters.direcao || m.direcao === filters.direcao));
                }
                if (!msg) return Promise.resolve({ data: null, error: null });
                const conv = conversas.find(c => c.id === msg.conversa_id) || null;
                return Promise.resolve({
                  data: {
                    ...msg,
                    conversa: conv
                  },
                  error: null
                });
              }
            };
            return q;
          }
        };
      }

      if (table === 'whatsapp_business_accounts') {
        return {
          select() {
            let filters = {};
            const q = {
              eq(field, val) {
                filters[field] = val;
                return q;
              },
              order() { return q; },
              then(resolve) {
                const matched = accounts.filter(a => {
                  for (const [k, v] of Object.entries(filters)) {
                    if (a[k] !== v) return false;
                  }
                  return true;
                });
                return Promise.resolve({ data: matched, error: null }).then(resolve);
              }
            };
            return q;
          }
        };
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) })
      };
    }
  };
}

async function runTests() {
  const usuarioTenant1 = {
    id: 'user-1',
    nivel: 'ATENDENTE_CONNECT',
    tenant_id: 1,
    ativo: true
  };

  const usuarioTenant2 = {
    id: 'user-2',
    nivel: 'ATENDENTE_CONNECT',
    tenant_id: 2,
    ativo: true
  };

  const usuarioSemPermissao = {
    id: 'user-3',
    nivel: 'VISITANTE',
    tenant_id: 1,
    ativo: true
  };

  // ─── TESTE A: Usuário não autenticado ─────────────────────────────────────
  {
    const req = { method: 'GET', query: { id: '10' }, headers: {}, supabaseClient: createMockSupabase() };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 401);
    console.log('✅ [TESTE A] Usuário não autenticado bloqueado com HTTP 401');
  }

  // ─── TESTE B: Usuário sem acesso ao Atendimento Connect ────────────────────
  {
    const req = {
      method: 'GET',
      query: { id: '10' },
      _authenticatedUser: { usuario: usuarioSemPermissao },
      supabaseClient: createMockSupabase()
    };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 403);
    console.log('✅ [TESTE B] Usuário sem permissão bloqueado com HTTP 403');
  }

  // ─── TESTE C: Validação Cross-tenant ───────────────────────────────────────
  {
    const db = createMockSupabase({
      mensagens: [{
        id: 10,
        conversa_id: 100,
        mensagem: '[Áudio ID: 123]',
        raw_payload: { media_id: '123', mensagem_tipo: 'audio' }
      }],
      conversas: [{
        id: 100,
        tenant_id: 2 // Pertence ao tenant 2
      }]
    });

    const req = {
      method: 'GET',
      query: { id: '10' },
      _authenticatedUser: { usuario: usuarioTenant1 }, // Usuário do tenant 1
      supabaseClient: db
    };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'Acesso negado: mensagem pertence a outro gabinete');
    console.log('✅ [TESTE C] Acesso cross-tenant bloqueado com HTTP 403');
  }

  // ─── TESTE D: Ausência de identificador de mídia (404) ─────────────────────
  {
    const db = createMockSupabase({
      mensagens: [{
        id: 20,
        conversa_id: 200,
        mensagem: 'Apenas texto comum',
        media_url: null,
        media_tipo: null,
        raw_payload: { mensagem_tipo: 'text' }
      }],
      conversas: [{
        id: 200,
        tenant_id: 1
      }]
    });

    const req = {
      method: 'GET',
      query: { id: '20' },
      _authenticatedUser: { usuario: usuarioTenant1 },
      supabaseClient: db
    };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 404);
    console.log('✅ [TESTE D] Mensagem sem mídia retorna HTTP 404');
  }

  // ─── TESTE E: WAFLY com media_url direta ──────────────────────────────────
  {
    let fetchedUrl = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      fetchedUrl = url;
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          'Content-Type': 'audio/ogg',
          'Content-Length': '4',
          'Accept-Ranges': 'bytes'
        }
      });
    };

    try {
      const db = createMockSupabase({
        mensagens: [{
          id: 30,
          conversa_id: 300,
          mensagem: '[Áudio Wafly]',
          media_url: 'https://wafly.s3.exemplo.com/audios/audio123.ogg',
          media_tipo: 'audio',
          raw_payload: { provider: 'WAFLY' }
        }],
        conversas: [{ id: 300, tenant_id: 1 }]
      });

      const req = {
        method: 'GET',
        query: { id: '30' },
        headers: { range: 'bytes=0-3' },
        _authenticatedUser: { usuario: usuarioTenant1 },
        supabaseClient: db
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(fetchedUrl, 'https://wafly.s3.exemplo.com/audios/audio123.ogg');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'audio/ogg');
      console.log('✅ [TESTE E] WAFLY com media_url direta streamed com sucesso');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ─── TESTE F: META mensagem nova com media_id ─────────────────────────────
  {
    const originalFetch = globalThis.fetch;
    let graphCalled = false;
    let downloadCalled = false;

    globalThis.fetch = async (url, opts) => {
      if (url.includes('graph.facebook.com')) {
        graphCalled = true;
        assert(opts.headers.Authorization.includes('VALID_META_TOKEN'));
        return new Response(JSON.stringify({
          id: 'media_meta_999',
          url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=999',
          mime_type: 'audio/ogg',
          file_size: 1024
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('lookaside.fbsbx.com')) {
        downloadCalled = true;
        assert(opts.headers.Authorization.includes('VALID_META_TOKEN'));
        return new Response(new Uint8Array([10, 20, 30]), {
          status: 200,
          headers: {
            'Content-Type': 'audio/ogg',
            'Content-Length': '3',
            'Accept-Ranges': 'bytes'
          }
        });
      }

      return new Response('Not found', { status: 404 });
    };

    try {
      const db = createMockSupabase({
        mensagens: [{
          id: 40,
          conversa_id: 400,
          mensagem: '[Áudio ID: media_meta_999]',
          media_tipo: 'audio',
          raw_payload: {
            media_id: 'media_meta_999',
            mensagem_tipo: 'audio',
            provider: 'META'
          }
        }],
        conversas: [{
          id: 400,
          tenant_id: 1,
          metadata: { provider: 'META' }
        }],
        accounts: [{
          id: 1,
          tenant_id: 1,
          provider: 'META',
          status: 'ATIVO',
          principal: true,
          access_token: 'VALID_META_TOKEN',
          whatsapp_business_numbers: [{ phone_number_id: '12345', status: 'ATIVO' }]
        }]
      });

      const req = {
        method: 'GET',
        query: { id: '40' },
        _authenticatedUser: { usuario: usuarioTenant1 },
        supabaseClient: db
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(graphCalled, true);
      assert.strictEqual(downloadCalled, true);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'audio/ogg');
      console.log('✅ [TESTE F] META mensagem nova com media_id consultada e streamed com sucesso');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ─── TESTE G: META mensagem HISTÓRICA (media_tipo null e media_url null) ─
  {
    const originalFetch = globalThis.fetch;
    let graphCalled = false;

    globalThis.fetch = async (url, opts) => {
      if (url.includes('graph.facebook.com')) {
        graphCalled = true;
        return new Response(JSON.stringify({
          id: '2522537268228018',
          url: 'https://lookaside.fbsbx.com/attachments/historical',
          mime_type: 'audio/ogg',
          file_size: 9467
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('lookaside.fbsbx.com')) {
        return new Response(new Uint8Array([5, 6, 7]), {
          status: 200,
          headers: {
            'Content-Type': 'audio/ogg',
            'Content-Length': '3',
            'Accept-Ranges': 'bytes'
          }
        });
      }

      return new Response('Not found', { status: 404 });
    };

    try {
      const db = createMockSupabase({
        mensagens: [{
          id: 4165,
          conversa_id: 500,
          mensagem: '[Áudio ID: 2522537268228018]',
          media_tipo: null, // HISTÓRICO NULL!
          media_url: null,  // HISTÓRICO NULL!
          raw_payload: {
            tipo: 'mensagem',
            conteudo: '[Áudio ID: 2522537268228018]',
            media_id: '2522537268228018',
            mensagem_tipo: 'audio',
            provider: 'META'
          }
        }],
        conversas: [{
          id: 500,
          tenant_id: 1,
          metadata: { provider: 'META' }
        }],
        accounts: [{
          id: 1,
          tenant_id: 1,
          provider: 'META',
          status: 'ATIVO',
          principal: true,
          access_token: 'VALID_META_TOKEN',
          whatsapp_business_numbers: [{ phone_number_id: '12345', status: 'ATIVO' }]
        }]
      });

      const req = {
        method: 'GET',
        query: { id: '4165' },
        _authenticatedUser: { usuario: usuarioTenant1 },
        supabaseClient: db
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(graphCalled, true);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'audio/ogg');
      console.log('✅ [TESTE G] Mensagem HISTÓRICA (media_tipo null, media_url null) recuperada e streamed com sucesso');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ─── TESTE H: Mídia expirada na Meta (HTTP 410) ───────────────────────────
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      return new Response(JSON.stringify({ error: { message: 'Media not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const db = createMockSupabase({
        mensagens: [{
          id: 60,
          conversa_id: 600,
          mensagem: '[Áudio ID: expirado_123]',
          raw_payload: { media_id: 'expirado_123', mensagem_tipo: 'audio' }
        }],
        conversas: [{ id: 600, tenant_id: 1 }],
        accounts: [{
          id: 1,
          tenant_id: 1,
          provider: 'META',
          status: 'ATIVO',
          access_token: 'VALID_TOKEN',
          whatsapp_business_numbers: [{ phone_number_id: '12345', status: 'ATIVO' }]
        }]
      });

      const req = {
        method: 'GET',
        query: { id: '60' },
        _authenticatedUser: { usuario: usuarioTenant1 },
        supabaseClient: db
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 410);
      assert.strictEqual(res.body.error, 'Midia nao esta mais disponivel ou expirou nos servidores do WhatsApp');
      console.log('✅ [TESTE H] Mídia expirada na Meta retorna HTTP 410 sanitizado');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ─── TESTE I: Range Request (HTTP 206 Partial Content) ────────────────────
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      assert.strictEqual(opts.headers.Range, 'bytes=0-1');
      return new Response(new Uint8Array([100, 200]), {
        status: 206,
        headers: {
          'Content-Type': 'audio/ogg',
          'Content-Range': 'bytes 0-1/10',
          'Content-Length': '2',
          'Accept-Ranges': 'bytes'
        }
      });
    };

    try {
      const db = createMockSupabase({
        mensagens: [{
          id: 70,
          conversa_id: 700,
          media_url: 'https://exemplo.com/audio.ogg',
          raw_payload: { provider: 'WAFLY' }
        }],
        conversas: [{ id: 700, tenant_id: 1 }]
      });

      const req = {
        method: 'GET',
        query: { id: '70' },
        headers: { range: 'bytes=0-1' },
        _authenticatedUser: { usuario: usuarioTenant1 },
        supabaseClient: db
      };
      const res = createMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 206);
      assert.strictEqual(res.headers['content-range'], 'bytes 0-1/10');
      assert.strictEqual(res.headers['accept-ranges'], 'bytes');
      console.log('✅ [TESTE I] Range request respondido com HTTP 206 e Content-Range correto');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log('\n========================================================');
  console.log('TODOS OS 9 TESTES DA ETAPA 2 PASSARAM COM 100% DE SUCESSO!');
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
