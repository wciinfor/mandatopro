import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    const contextoMandato = await obterContextoMandato(req, usuario, supabase);

    const { inicio, fim } = req.query;

    // 1. Contagens gerais com filtro de mandato
    let queryComCadastrador = supabase
      .from('eleitores')
      .select('id', { count: 'exact', head: true })
      .not('usuario_id', 'is', null);

    let querySemCadastrador = supabase
      .from('eleitores')
      .select('id', { count: 'exact', head: true })
      .is('usuario_id', null);

    let queryCadastradores = supabase
      .from('eleitores')
      .select('usuario_id, telefone, celular, whatsapp, cpf')
      .not('usuario_id', 'is', null);

    if (contextoMandato.mandatoId === 2) {
      queryComCadastrador = queryComCadastrador.in('pertencimento', ['FEDERAL', 'AMBOS']);
      querySemCadastrador = querySemCadastrador.in('pertencimento', ['FEDERAL', 'AMBOS']);
      queryCadastradores = queryCadastradores.in('pertencimento', ['FEDERAL', 'AMBOS']);
    } else {
      queryComCadastrador = queryComCadastrador.or('pertencimento.in.(ESTADUAL,AMBOS,NAO_CLASSIFICADO),pertencimento.is.null');
      querySemCadastrador = querySemCadastrador.or('pertencimento.in.(ESTADUAL,AMBOS,NAO_CLASSIFICADO),pertencimento.is.null');
      queryCadastradores = queryCadastradores.or('pertencimento.in.(ESTADUAL,AMBOS,NAO_CLASSIFICADO),pertencimento.is.null');
    }

    if (inicio) {
      queryComCadastrador = queryComCadastrador.gte('created_at', `${inicio}T00:00:00-03:00`);
      querySemCadastrador = querySemCadastrador.gte('created_at', `${inicio}T00:00:00-03:00`);
      queryCadastradores = queryCadastradores.gte('created_at', `${inicio}T00:00:00-03:00`);
    }
    if (fim) {
      queryComCadastrador = queryComCadastrador.lte('created_at', `${fim}T23:59:59-03:00`);
      querySemCadastrador = querySemCadastrador.lte('created_at', `${fim}T23:59:59-03:00`);
      queryCadastradores = queryCadastradores.lte('created_at', `${fim}T23:59:59-03:00`);
    }

    const [comCadRes, semCadRes, usuariosRes] = await Promise.all([
      queryComCadastrador,
      querySemCadastrador,
      supabase.from('usuarios').select('id, nome, email, nivel, status')
    ]);

    const totalComCadastrador = comCadRes.count || 0;
    const totalSemCadastrador = semCadRes.count || 0;
    const totalGeral = totalComCadastrador + totalSemCadastrador;

    const mapaUsuarios = {};
    (usuariosRes.data || []).forEach(u => {
      mapaUsuarios[u.id] = u;
    });

    // 2. Agrupar registros cadastrados por usuario_id se houver
    let cadastradoresLista = [];

    if (totalComCadastrador > 0) {
      const { data: registrosComUser } = await queryCadastradores.limit(10000);

      const statsPorUser = {};
      (registrosComUser || []).forEach(r => {
        const uid = r.usuario_id;
        if (!uid) return;

        if (!statsPorUser[uid]) {
          const infoUser = mapaUsuarios[uid] || { nome: `Usuário ${uid}`, email: '', nivel: 'DESCONHECIDO' };
          statsPorUser[uid] = {
            usuario_id: uid,
            nome: infoUser.nome,
            email: infoUser.email,
            nivel: infoUser.nivel,
            totalCadastrados: 0,
            comTelefone: 0,
            comCpf: 0
          };
        }

        statsPorUser[uid].totalCadastrados++;
        const temTel = Boolean(String(r.whatsapp || r.celular || r.telefone || '').replace(/\D/g, '').length >= 8);
        if (temTel) statsPorUser[uid].comTelefone++;
        const temCpf = Boolean(String(r.cpf || '').replace(/\D/g, '').length >= 11);
        if (temCpf) statsPorUser[uid].comCpf++;
      });

      cadastradoresLista = Object.values(statsPorUser)
        .map(item => ({
          ...item,
          pctTelefone: item.totalCadastrados > 0 ? Number(((item.comTelefone / item.totalCadastrados) * 100).toFixed(1)) : 0,
          pctCpf: item.totalCadastrados > 0 ? Number(((item.comCpf / item.totalCadastrados) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.totalCadastrados - a.totalCadastrados);
    }

    return res.status(200).json({
      resumo: {
        totalEleitores: totalGeral,
        totalComCadastrador,
        totalSemCadastrador,
        totalCadastradoresAtivos: cadastradoresLista.length
      },
      periodo: {
        inicio: inicio || null,
        fim: fim || null
      },
      mandatoId: contextoMandato.mandatoId,
      tipoMandato: contextoMandato.tipo,
      cadastradores: cadastradoresLista
    });
  } catch (error) {
    console.error('[Estatísticas Cadastradores] Erro:', error);
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Erro ao obter estatísticas de cadastradores'
    });
  }
}
