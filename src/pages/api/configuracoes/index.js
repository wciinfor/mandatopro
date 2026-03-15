// API para gerenciar configurações do sistema — armazenamento no Supabase
import { createServerClient } from '@/lib/supabase-server';
import { lerConfiguracoes, salvarConfiguracoes } from '@/lib/configuracoes';

export const runtime = 'nodejs';

// Chaves armazenadas na tabela configuracoes_sistema
const CHAVES_SISTEMA = [
  'nome_orgao', 'sigla', 'logo', 'cnpj', 'endereco', 'telefone',
  'email_orgao', 'website', 'cargo', 'nome_parlamentar',
  'cor_principal', 'cor_secundaria',
  'whatsapp_phone_number_id', 'whatsapp_access_token'
];

function rowsToConfig(rows) {
  const map = {};
  for (const row of (rows || [])) {
    map[row.chave] = row.valor;
  }
  return {
    nomeOrgao: map.nome_orgao || '',
    sigla: map.sigla || '',
    logo: map.logo || null,
    cnpj: map.cnpj || '',
    endereco: map.endereco || '',
    telefone: map.telefone || '',
    email: map.email_orgao || '',
    website: map.website || '',
    cargo: map.cargo || '',
    nomeParlamentar: map.nome_parlamentar || '',
    corPrincipal: map.cor_principal || '#14b8a6',
    corSecundaria: map.cor_secundaria || '#0d9488',
    whatsapp: {
      phoneNumberId: map.whatsapp_phone_number_id || '',
      accessToken: map.whatsapp_access_token || ''
    }
  };
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    if (req.method === 'GET') {
      const { data: rows, error } = await supabase
        .from('configuracoes_sistema')
        .select('chave, valor')
        .in('chave', CHAVES_SISTEMA);

      if (error) throw error;

      const config = rowsToConfig(rows);
      const privado = lerConfiguracoes();

      return res.status(200).json({
        success: true,
        data: {
          ...config,
          openai: {
            enabled: privado.openai?.enabled ?? false,
            provider: privado.openai?.provider || 'openai',
            model: privado.openai?.model || 'gpt-4o-mini',
            groqModel: privado.openai?.groqModel || 'llama-3.1-8b-instant',
            hasKey: Boolean(privado.openai?.apiKey),
            hasGroqKey: Boolean(privado.openai?.groqApiKey)
          }
        }
      });
    }

    else if (req.method === 'POST') {
      const { tipo, dados } = req.body;

      if (!tipo || !dados) {
        return res.status(400).json({ success: false, message: 'Tipo e dados são obrigatórios' });
      }

      if (tipo === 'sistema') {
        const upserts = [
          { chave: 'nome_orgao', valor: dados.nomeOrgao ?? '', tipo: 'STRING', editavel: true },
          { chave: 'sigla', valor: dados.sigla ?? '', tipo: 'STRING', editavel: true },
          { chave: 'logo', valor: dados.logo ?? null, tipo: 'STRING', editavel: true },
          { chave: 'cnpj', valor: dados.cnpj ?? '', tipo: 'STRING', editavel: true },
          { chave: 'endereco', valor: dados.endereco ?? '', tipo: 'STRING', editavel: true },
          { chave: 'telefone', valor: dados.telefone ?? '', tipo: 'STRING', editavel: true },
          { chave: 'email_orgao', valor: dados.email ?? '', tipo: 'STRING', editavel: true },
          { chave: 'website', valor: dados.website ?? '', tipo: 'STRING', editavel: true },
          { chave: 'cargo', valor: dados.cargo ?? '', tipo: 'STRING', editavel: true },
          { chave: 'nome_parlamentar', valor: dados.nomeParlamentar ?? '', tipo: 'STRING', editavel: true },
          { chave: 'cor_principal', valor: dados.corPrincipal ?? '#14b8a6', tipo: 'STRING', editavel: true },
          { chave: 'cor_secundaria', valor: dados.corSecundaria ?? '#0d9488', tipo: 'STRING', editavel: true },
        ];

        const { error } = await supabase
          .from('configuracoes_sistema')
          .upsert(upserts, { onConflict: 'chave' });

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Configuração salva com sucesso' });
      }

      else if (tipo === 'whatsapp') {
        const upserts = [
          { chave: 'whatsapp_phone_number_id', valor: dados.phoneNumberId ?? '', tipo: 'STRING', editavel: true },
          { chave: 'whatsapp_access_token', valor: dados.accessToken ?? '', tipo: 'STRING', editavel: true },
        ];

        const { error } = await supabase
          .from('configuracoes_sistema')
          .upsert(upserts, { onConflict: 'chave' });

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'WhatsApp configurado com sucesso' });
      }

      else if (tipo === 'openai') {
        const configPrivado = lerConfiguracoes();
        const provider = dados.provider || configPrivado.openai?.provider || 'openai';
        const apiKey = dados.apiKey ?? configPrivado.openai?.apiKey ?? '';
        const model = dados.model || configPrivado.openai?.model || 'gpt-4o-mini';
        const groqApiKey = dados.groqApiKey ?? configPrivado.openai?.groqApiKey ?? '';
        const groqModel = dados.groqModel || configPrivado.openai?.groqModel || 'llama-3.1-8b-instant';
        const enabled = dados.enabled ?? configPrivado.openai?.enabled ?? false;

        configPrivado.openai = {
          ...configPrivado.openai,
          provider, apiKey, model, groqApiKey, groqModel, enabled,
          updatedAt: new Date().toISOString()
        };

        if (!salvarConfiguracoes(configPrivado)) {
          return res.status(500).json({ success: false, message: 'Erro ao salvar configuracao OpenAI' });
        }

        return res.status(200).json({ success: true, message: 'Configuração IA salva com sucesso' });
      }

      else {
        return res.status(400).json({ success: false, message: 'Tipo de configuracao invalido' });
      }
    }

    else {
      return res.status(405).json({ success: false, message: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro na API de configurações:', error);
    return res.status(500).json({ success: false, message: 'Erro ao processar configuração', error: error.message });
  }
}
