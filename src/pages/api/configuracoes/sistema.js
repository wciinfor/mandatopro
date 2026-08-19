// API alternativa de configuraÃ§Ãµes do sistema â€” armazenamento no Supabase
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario, exigirAdministrador } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CHAVES_SISTEMA = [
  'nome_orgao', 'sigla', 'cnpj', 'endereco', 'telefone',
  'email_orgao', 'website', 'cargo', 'nome_parlamentar', 'parlamentares'
];

function parseParlamentares(rawJson, legacyNome, legacyCargo) {
  let list = [];
  if (rawJson) {
    try {
      const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed.map((item, idx) => ({
          id: item.id || `parlamentar-${idx + 1}`,
          nome: String(item.nome || '').trim(),
          cargo: String(item.cargo || '').trim(),
          ativo: item.ativo !== false,
          padrao: Boolean(item.padrao)
        })).filter(item => Boolean(item.nome));
      }
    } catch {
      list = [];
    }
  }

  if (list.length === 0 && legacyNome) {
    list = [
      {
        id: 'parlamentar-1',
        nome: legacyNome,
        cargo: legacyCargo || '',
        ativo: true,
        padrao: true
      }
    ];
  }

  if (list.length > 0 && !list.some(p => p.padrao && p.ativo)) {
    const primeiroAtivo = list.find(p => p.ativo) || list[0];
    primeiroAtivo.padrao = true;
  }

  return list;
}

function rowsToSistema(rows) {
  const map = {};
  for (const row of (rows || [])) {
    map[row.chave] = row.valor;
  }
  const legacyNome = map.nome_parlamentar || '';
  const legacyCargo = map.cargo || '';
  const parlamentares = parseParlamentares(map.parlamentares, legacyNome, legacyCargo);
  const principal = parlamentares.find(p => p.padrao) || parlamentares[0] || { nome: legacyNome, cargo: legacyCargo };

  return {
    nomeParlamentar: principal.nome || legacyNome,
    nomeOrgao: map.nome_orgao || '',
    sigla: map.sigla || '',
    cnpj: map.cnpj || '',
    endereco: map.endereco || '',
    telefone: map.telefone || '',
    email: map.email_orgao || '',
    website: map.website || '',
    cargo: principal.cargo || legacyCargo,
    parlamentares: parlamentares
  };
}

export default async function handler(req, res) {
  const supabase = createServerClient();
  let usuario = null;

  try {
    const auth = await obterUsuarioAutenticado(req, supabase);
    usuario = auth.usuario;
    exigirUsuario(usuario);
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ sucesso: false, erro: error.message || 'Erro de autenticacao' });
  }

  // GET: Recuperar configurações
  if (req.method === 'GET') {
    try {
      const { data: rows, error } = await supabase
        .from('configuracoes_sistema')
        .select('chave, valor')
        .in('chave', CHAVES_SISTEMA);

      if (error) throw error;

      return res.status(200).json({
        sucesso: true,
        dados: rowsToSistema(rows)
      });
    } catch (error) {
      console.error('Erro ao ler configurações:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao recuperar configurações' });
    }
  }

  // POST: Salvar configurações
  if (req.method === 'POST') {
    try {
      exigirAdministrador(usuario);

      const { dados } = req.body;

      if (!dados) {
        return res.status(400).json({ sucesso: false, erro: 'Dados do sistema são obrigatórios' });
      }

      if (!dados.nomeParlamentar || !dados.cnpj) {
        return res.status(400).json({ sucesso: false, erro: 'Nome do Parlamentar e CNPJ são obrigatórios' });
      }

      const parlamentaresList = Array.isArray(dados.parlamentares) && dados.parlamentares.length > 0
        ? dados.parlamentares.map((p, idx) => ({
            id: p.id || `parlamentar-${idx + 1}`,
            nome: String(p.nome || '').trim(),
            cargo: String(p.cargo || '').trim(),
            ativo: p.ativo !== false,
            padrao: Boolean(p.padrao)
          })).filter(p => Boolean(p.nome))
        : [
            {
              id: 'parlamentar-1',
              nome: dados.nomeParlamentar || '',
              cargo: dados.cargo || '',
              ativo: true,
              padrao: true
            }
          ].filter(p => Boolean(p.nome));

      if (parlamentaresList.length > 0 && !parlamentaresList.some(p => p.padrao && p.ativo)) {
        const primeiroAtivo = parlamentaresList.find(p => p.ativo) || parlamentaresList[0];
        primeiroAtivo.padrao = true;
      }

      const principal = parlamentaresList.find(p => p.padrao) || parlamentaresList[0] || {};
      const nomePrincipal = principal.nome || dados.nomeParlamentar || '';
      const cargoPrincipal = principal.cargo || dados.cargo || '';

      const upserts = [
        { chave: 'nome_orgao', valor: dados.nomeOrgao ?? '', tipo: 'STRING', editavel: true },
        { chave: 'sigla', valor: dados.sigla ?? '', tipo: 'STRING', editavel: true },
        { chave: 'cnpj', valor: dados.cnpj ?? '', tipo: 'STRING', editavel: true },
        { chave: 'endereco', valor: dados.endereco ?? '', tipo: 'STRING', editavel: true },
        { chave: 'telefone', valor: dados.telefone ?? '', tipo: 'STRING', editavel: true },
        { chave: 'email_orgao', valor: dados.email ?? '', tipo: 'STRING', editavel: true },
        { chave: 'website', valor: dados.website ?? '', tipo: 'STRING', editavel: true },
        { chave: 'cargo', valor: cargoPrincipal, tipo: 'STRING', editavel: true },
        { chave: 'nome_parlamentar', valor: nomePrincipal, tipo: 'STRING', editavel: true },
        { chave: 'parlamentares', valor: JSON.stringify(parlamentaresList), tipo: 'JSON', editavel: true },
      ];

      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert(upserts, { onConflict: 'chave' });

      if (error) throw error;

      return res.status(200).json({ sucesso: true, mensagem: 'Configurações salvas com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar configurações' });
    }
  }

  return res.status(405).json({ sucesso: false, erro: 'MÃ©todo nÃ£o permitido' });
}
