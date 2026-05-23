import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const CHAVE_PREFIXO = 'aniversariantes_';

const CAMPOS_CONFIG = {
  envioAutomaticoAtivo: { tipo: 'BOOLEAN', descricao: 'Ativa envio automatico de aniversariantes', padrao: true },
  horarioEnvio: { tipo: 'STRING', descricao: 'Horario padrao para envio automatico', padrao: '08:00' },
  enviarWhatsApp: { tipo: 'BOOLEAN', descricao: 'Ativa canal WhatsApp', padrao: true },
  enviarSMS: { tipo: 'BOOLEAN', descricao: 'Ativa canal SMS', padrao: false },
  enviarEmail: { tipo: 'BOOLEAN', descricao: 'Ativa canal E-mail', padrao: true },
  nomeParlamentar: { tipo: 'STRING', descricao: 'Nome para assinatura da mensagem', padrao: '' },
  mensagemPadrao: {
    tipo: 'STRING',
    descricao: 'Mensagem padrao para envio de aniversario',
    padrao: 'Parabens pelo seu aniversario!\n\nConte sempre comigo!\n\n[NOME_PARLAMENTAR]'
  },
  assinarMensagem: { tipo: 'BOOLEAN', descricao: 'Inclui assinatura na mensagem', padrao: true },
  incluirEmoji: { tipo: 'BOOLEAN', descricao: 'Inclui emoji na mensagem', padrao: true }
};

function chaveCompleta(campo) {
  return `${CHAVE_PREFIXO}${campo}`;
}

function paraBoolean(valor, padrao = false) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === null || valor === undefined) {
    return padrao;
  }

  const texto = String(valor).trim().toLowerCase();
  if (['true', '1', 'sim', 'yes'].includes(texto)) {
    return true;
  }
  if (['false', '0', 'nao', 'não', 'no'].includes(texto)) {
    return false;
  }

  return padrao;
}

function parseValor(campo, valor) {
  const definicao = CAMPOS_CONFIG[campo];
  if (!definicao) {
    return valor;
  }

  if (definicao.tipo === 'BOOLEAN') {
    return paraBoolean(valor, definicao.padrao);
  }

  return valor === null || valor === undefined ? definicao.padrao : String(valor);
}

function serializarValor(campo, valor) {
  const definicao = CAMPOS_CONFIG[campo];
  if (!definicao) {
    return String(valor ?? '');
  }

  if (definicao.tipo === 'BOOLEAN') {
    return paraBoolean(valor, definicao.padrao) ? 'true' : 'false';
  }

  return String(valor ?? definicao.padrao ?? '');
}

function configuracaoPadrao() {
  return Object.entries(CAMPOS_CONFIG).reduce((acc, [campo, definicao]) => {
    acc[campo] = definicao.padrao;
    return acc;
  }, {});
}

function normalizarPayload(payload) {
  const base = configuracaoPadrao();
  const entrada = payload && typeof payload === 'object' ? payload : {};

  for (const campo of Object.keys(CAMPOS_CONFIG)) {
    if (entrada[campo] !== undefined) {
      base[campo] = parseValor(campo, entrada[campo]);
    }
  }

  return base;
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('configuracoes_sistema')
        .select('chave,valor')
        .like('chave', `${CHAVE_PREFIXO}%`);

      if (error) {
        throw error;
      }

      const configuracao = configuracaoPadrao();

      for (const item of data || []) {
        const campo = String(item?.chave || '').replace(CHAVE_PREFIXO, '');
        if (CAMPOS_CONFIG[campo]) {
          configuracao[campo] = parseValor(campo, item?.valor);
        }
      }

      return res.status(200).json({
        success: true,
        data: configuracao
      });
    } catch (error) {
      console.error('Erro ao carregar configuracoes de aniversariantes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao carregar configuracoes de aniversariantes',
        detalhes: error?.message || 'Erro desconhecido'
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const configuracaoNormalizada = normalizarPayload(req.body?.dados ?? req.body);

      const registros = Object.keys(CAMPOS_CONFIG).map((campo) => ({
        chave: chaveCompleta(campo),
        valor: serializarValor(campo, configuracaoNormalizada[campo]),
        tipo: CAMPOS_CONFIG[campo].tipo,
        descricao: CAMPOS_CONFIG[campo].descricao,
        editavel: true
      }));

      const { error } = await supabase
        .from('configuracoes_sistema')
        .upsert(registros, { onConflict: 'chave' });

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        message: 'Configuracoes de aniversariantes salvas com sucesso',
        data: configuracaoNormalizada
      });
    } catch (error) {
      console.error('Erro ao salvar configuracoes de aniversariantes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar configuracoes de aniversariantes',
        detalhes: error?.message || 'Erro desconhecido'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
