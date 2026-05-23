// API alternativa de configuraÃ§Ãµes do sistema â€” armazenamento no Supabase
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario, exigirAdministrador } from '@/lib/api-auth';

export const runtime = 'nodejs';

const CHAVES_SISTEMA = [
  'nome_orgao', 'sigla', 'cnpj', 'endereco', 'telefone',
  'email_orgao', 'website', 'cargo', 'nome_parlamentar'
];

function rowsToSistema(rows) {
  const map = {};
  for (const row of (rows || [])) {
    map[row.chave] = row.valor;
  }
  return {
    nomeParlamentar: map.nome_parlamentar || '',
    nomeOrgao: map.nome_orgao || '',
    sigla: map.sigla || '',
    cnpj: map.cnpj || '',
    endereco: map.endereco || '',
    telefone: map.telefone || '',
    email: map.email_orgao || '',
    website: map.website || '',
    cargo: map.cargo || ''
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

  // GET: Recuperar configuraÃ§Ãµes
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
      console.error('Erro ao ler configuraÃ§Ãµes:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao recuperar configuraÃ§Ãµes' });
    }
  }

  // POST: Salvar configuraÃ§Ãµes
  if (req.method === 'POST') {
    try {
      exigirAdministrador(usuario);

      const { dados } = req.body;

      if (!dados) {
        return res.status(400).json({ sucesso: false, erro: 'Dados do sistema sÃ£o obrigatÃ³rios' });
      }

      if (!dados.nomeParlamentar || !dados.cnpj) {
        return res.status(400).json({ sucesso: false, erro: 'Nome do Parlamentar e CNPJ sÃ£o obrigatÃ³rios' });
      }

      const upserts = [
        { chave: 'nome_orgao', valor: dados.nomeOrgao ?? '', tipo: 'STRING', editavel: true },
        { chave: 'sigla', valor: dados.sigla ?? '', tipo: 'STRING', editavel: true },
        { chave: 'cnpj', valor: dados.cnpj ?? '', tipo: 'STRING', editavel: true },
        { chave: 'endereco', valor: dados.endereco ?? '', tipo: 'STRING', editavel: true },
        { chave: 'telefone', valor: dados.telefone ?? '', tipo: 'STRING', editavel: true },
        { chave: 'email_orgao', valor: dados.email ?? '', tipo: 'STRING', editavel: true },
        { chave: 'website', valor: dados.website ?? '', tipo: 'STRING', editavel: true },
        { chave: 'cargo', valor: dados.cargo ?? '', tipo: 'STRING', editavel: true },
        { chave: 'nome_parlamentar', valor: dados.nomeParlamentar ?? '', tipo: 'STRING', editavel: true },
      ];

      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert(upserts, { onConflict: 'chave' });

      if (error) throw error;

      return res.status(200).json({ sucesso: true, mensagem: 'ConfiguraÃ§Ãµes salvas com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar configuraÃ§Ãµes:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao salvar configuraÃ§Ãµes' });
    }
  }

  return res.status(405).json({ sucesso: false, erro: 'MÃ©todo nÃ£o permitido' });
}
