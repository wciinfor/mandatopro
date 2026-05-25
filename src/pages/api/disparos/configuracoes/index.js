import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect, exigirAdministradorOuSupervisorConnect } from '@/lib/api-auth';

export const runtime = 'nodejs';

const DEFAULTS = {
  intervalo_min_segundos: 60,
  intervalo_max_segundos: 120,
  limite_lote: 10,
  pausa_lote_minutos: 10,
  ia_reescrita_ativa: false,
  ia_modelo: 'gpt-4o-mini'
};

const DESCRICOES = {
  intervalo_min_segundos: 'Intervalo minimo entre disparos',
  intervalo_max_segundos: 'Intervalo maximo entre disparos',
  limite_lote: 'Quantidade de mensagens por lote',
  pausa_lote_minutos: 'Pausa de seguranca entre lotes',
  ia_reescrita_ativa: 'Ativa reescrita de mensagens com IA',
  ia_modelo: 'Modelo padrao para recursos de IA'
};

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '').toUpperCase() === '42P01'
    || message.includes('disparo_configuracoes');
}

function normalizarPayload(dados = {}) {
  const min = Number(dados.intervalo_min_segundos ?? DEFAULTS.intervalo_min_segundos);
  const max = Number(dados.intervalo_max_segundos ?? DEFAULTS.intervalo_max_segundos);
  const lote = Number(dados.limite_lote ?? DEFAULTS.limite_lote);
  const pausa = Number(dados.pausa_lote_minutos ?? DEFAULTS.pausa_lote_minutos);

  if (!Number.isFinite(min) || min < 1) throw new Error('Intervalo minimo invalido');
  if (!Number.isFinite(max) || max < min) throw new Error('Intervalo maximo deve ser maior ou igual ao minimo');
  if (!Number.isFinite(lote) || lote < 1) throw new Error('Limite por lote invalido');
  if (!Number.isFinite(pausa) || pausa < 0) throw new Error('Pausa entre lotes invalida');

  return {
    intervalo_min_segundos: Math.round(min),
    intervalo_max_segundos: Math.round(max),
    limite_lote: Math.round(lote),
    pausa_lote_minutos: Math.round(pausa),
    ia_reescrita_ativa: Boolean(dados.ia_reescrita_ativa),
    ia_modelo: String(dados.ia_modelo || DEFAULTS.ia_modelo).trim() || DEFAULTS.ia_modelo
  };
}

function rowsToConfig(rows = []) {
  return rows.reduce((acc, row) => {
    acc[row.chave] = row.valor;
    return acc;
  }, { ...DEFAULTS });
}

export default async function handler(req, res) {
  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('disparo_configuracoes')
        .select('chave, valor')
        .in('chave', Object.keys(DEFAULTS));

      if (error) {
        if (isMissingTableError(error)) {
          return res.status(200).json({
            success: true,
            configurado: false,
            data: DEFAULTS
          });
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        configurado: true,
        data: rowsToConfig(data || [])
      });
    }

    if (req.method === 'POST') {
      exigirAdministradorOuSupervisorConnect(usuario);

      const config = normalizarPayload(req.body?.dados || req.body || {});
      const rows = Object.entries(config).map(([chave, valor]) => ({
        chave,
        valor,
        descricao: DESCRICOES[chave] || null,
        editavel: true,
        atualizado_por_id: usuario.id,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('disparo_configuracoes')
        .upsert(rows, { onConflict: 'chave' });

      if (error) throw error;

      return res.status(200).json({ success: true, data: config, message: 'Configuracoes salvas' });
    }

    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  } catch (error) {
    const status = error?.statusCode || (error?.message?.includes('invalido') ? 400 : 500);
    console.error('Erro em disparos/configuracoes:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao processar configuracoes'
    });
  }
}
