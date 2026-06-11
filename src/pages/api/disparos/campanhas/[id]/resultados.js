import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAcessoMandatoConnect(usuario);

    const campanhaId = Number(req.query.id);
    if (!Number.isFinite(campanhaId)) {
      return res.status(400).json({ success: false, message: 'Campanha invalida' });
    }

    const { data: campanha, error: campanhaError } = await supabase
      .from('disparo_campanhas')
      .select('id, titulo, status, total_contatos, total_validos, total_invalidos, total_enviados, total_falhas, created_at, updated_at')
      .eq('id', campanhaId)
      .maybeSingle();

    if (campanhaError) throw campanhaError;
    if (!campanha) return res.status(404).json({ success: false, message: 'Campanha nao encontrada' });

    const { data: envios, error: enviosError } = await supabase
      .from('disparo_envios')
      .select('status, erro, created_at, enviado_em')
      .eq('campanha_id', campanhaId);

    if (enviosError) throw enviosError;

    const totalEnvios = envios?.length || 0;
    const enviados = (envios || []).filter((envio) => envio.status === 'enviado').length;
    const falhas = (envios || []).filter((envio) => envio.status === 'falhou').length;
    const pendentes = (envios || []).filter((envio) => envio.status === 'pendente').length;
    const processando = (envios || []).filter((envio) => envio.status === 'processando').length;
    const cancelados = (envios || []).filter((envio) => envio.status === 'cancelado').length;
    const concluidos = enviados + falhas + cancelados;
    const taxaSucesso = totalEnvios > 0 ? Math.round((enviados / totalEnvios) * 100) : 0;

    const erros = (envios || []).reduce((acc, envio) => {
      if (envio.status !== 'falhou') return acc;
      const key = envio.erro || 'Erro nao informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      campanha: {
        id: campanha.id,
        titulo: campanha.titulo,
        status: campanha.status,
        totalContatos: campanha.total_contatos || 0,
        totalValidos: campanha.total_validos || 0,
        totalInvalidos: campanha.total_invalidos || 0,
        totalEnviados: campanha.total_enviados || 0,
        totalFalhas: campanha.total_falhas || 0,
        createdAt: campanha.created_at || null,
        updatedAt: campanha.updated_at || null
      },
      resultados: {
        totalEnvios,
        enviados,
        falhas,
        pendentes,
        processando,
        cancelados,
        concluidos,
        taxaSucesso,
        erros
      }
    });
  } catch (error) {
    console.error('Erro ao carregar resultados:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao carregar resultados'
    });
  }
}
