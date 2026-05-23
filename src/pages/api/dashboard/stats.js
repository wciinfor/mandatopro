import { createServerClient } from '@/lib/supabase-server';
import { carregarSnapshotAniversariantes } from '@/lib/aniversariantes';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerClient();

    const [eleitores, eleitoresAtivos, eleitoresInativos, liderancas, campanhas, atendimentos] = await Promise.all([
      supabase.from('eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).eq('status', 'ATIVO'),
      supabase.from('eleitores').select('id', { count: 'exact', head: true }).eq('status', 'INATIVO'),
      supabase.from('liderancas').select('id', { count: 'exact', head: true }),
      supabase
        .from('campanhas')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PLANEJAMENTO', 'EXECUCAO']),
      supabase.from('atendimentos').select('id', { count: 'exact', head: true })
    ]);

    if (eleitores.error) throw eleitores.error;
    if (eleitoresAtivos.error) throw eleitoresAtivos.error;
    if (eleitoresInativos.error) throw eleitoresInativos.error;
    if (liderancas.error) throw liderancas.error;
    if (campanhas.error) throw campanhas.error;
    if (atendimentos.error) throw atendimentos.error;

    let aniversariantesResumo = {
      aniversariantesHoje: 0,
      aniversariantesSemana: 0,
      aniversariantesMes: 0
    };
    let proximosAniversariantes = [];

    try {
      const snapshot = await carregarSnapshotAniversariantes(supabase, {
        limite: 10,
        incluirInativos: false,
        deduplicar: true
      });

      aniversariantesResumo = {
        aniversariantesHoje: snapshot.resumo.aniversariantesHoje || 0,
        aniversariantesSemana: snapshot.resumo.aniversariantesSemana || 0,
        aniversariantesMes: snapshot.resumo.aniversariantesMes || 0
      };
      proximosAniversariantes = Array.isArray(snapshot.proximosAniversariantes)
        ? snapshot.proximosAniversariantes
        : [];
    } catch (erroAniversariantes) {
      console.error('Erro ao carregar aniversariantes do dashboard:', erroAniversariantes);
    }

    return res.status(200).json({
      totalEleitores: eleitores.count || 0,
      eleitoresAtivos: eleitoresAtivos.count || 0,
      eleitoresInativos: eleitoresInativos.count || 0,
      totalLiderancas: liderancas.count || 0,
      campanhasAtivas: campanhas.count || 0,
      totalAtendimentos: atendimentos.count || 0,
      ...aniversariantesResumo,
      proximosAniversariantes
    });
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    return res.status(500).json({ error: 'Erro ao buscar estatisticas do dashboard' });
  }
}
