import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAcessoMandatoConnect } from '@/lib/api-auth';

export const runtime = 'nodejs';

function contarPorStatus(rows = []) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'pendente';
    acc[status] = (acc[status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0, pendente: 0, processando: 0, enviado: 0, falhou: 0, cancelado: 0 });
}

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
      .select(`
        id,
        telefone,
        status,
        tentativas,
        erro,
        agendado_para,
        enviado_em,
        created_at,
        disparo_contatos (
          nome
        )
      `)
      .eq('campanha_id', campanhaId)
      .order('id', { ascending: true })
      .limit(500);

    if (enviosError) throw enviosError;

    const resumo = contarPorStatus(envios || []);
    const concluidos = resumo.enviado + resumo.falhou + resumo.cancelado;
    const percentual = resumo.total > 0 ? Math.round((concluidos / resumo.total) * 100) : 0;

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
        createdAt: campanha.created_at,
        updatedAt: campanha.updated_at
      },
      resumo: {
        ...resumo,
        concluidos,
        percentual
      },
      envios: (envios || []).map((envio) => ({
        id: envio.id,
        nome: envio.disparo_contatos?.nome || '',
        telefone: envio.telefone,
        status: envio.status,
        tentativas: envio.tentativas || 0,
        erro: envio.erro || null,
        agendadoPara: envio.agendado_para || null,
        enviadoEm: envio.enviado_em || null,
        createdAt: envio.created_at || null
      }))
    });
  } catch (error) {
    console.error('Erro ao carregar progresso:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao carregar progresso'
    });
  }
}
