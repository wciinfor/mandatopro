import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministradorOuSupervisorConnect } from '@/lib/api-auth';

export const runtime = 'nodejs';

function personalizarMensagem(template, contato) {
  return String(template || '')
    .replaceAll('{nome}', contato.nome || '')
    .replaceAll('{telefone}', contato.telefone_normalizado || contato.telefone_original || '')
    .replaceAll('{cidade}', contato.cidade || '')
    .replaceAll('{bairro}', contato.bairro || '');
}

function calcularAgendamento(baseDate, index, campanha) {
  const min = Math.max(Number(campanha.intervalo_min_segundos || 60), 1);
  const max = Math.max(Number(campanha.intervalo_max_segundos || min), min);
  const step = Math.round((min + max) / 2);
  return new Date(baseDate.getTime() + (index * step * 1000)).toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministradorOuSupervisorConnect(usuario);

    const campanhaId = Number(req.query.id);
    if (!Number.isFinite(campanhaId)) {
      return res.status(400).json({ success: false, message: 'Campanha invalida' });
    }

    const { data: campanha, error: campanhaError } = await supabase
      .from('disparo_campanhas')
      .select('id, mensagem, instancia_id, intervalo_min_segundos, intervalo_max_segundos, status')
      .eq('id', campanhaId)
      .maybeSingle();

    if (campanhaError) throw campanhaError;
    if (!campanha) return res.status(404).json({ success: false, message: 'Campanha nao encontrada' });
    if (!campanha.instancia_id) {
      return res.status(400).json({ success: false, message: 'Selecione uma instancia antes de preparar envios' });
    }

    const { data: contatos, error: contatosError } = await supabase
      .from('disparo_contatos')
      .select('id, nome, telefone_original, telefone_normalizado, cidade, bairro')
      .eq('campanha_id', campanhaId)
      .eq('valido', true)
      .eq('duplicado', false)
      .order('id', { ascending: true });

    if (contatosError) throw contatosError;
    if (!contatos?.length) {
      return res.status(400).json({ success: false, message: 'Campanha sem contatos validos' });
    }

    await supabase
      .from('disparo_envios')
      .delete()
      .eq('campanha_id', campanhaId)
      .in('status', ['pendente', 'cancelado']);

    const baseDate = new Date();
    const rows = contatos.map((contato, index) => ({
      campanha_id: campanhaId,
      contato_id: contato.id,
      instancia_id: campanha.instancia_id,
      telefone: contato.telefone_normalizado,
      mensagem: personalizarMensagem(campanha.mensagem, contato),
      status: 'pendente',
      tentativas: 0,
      agendado_para: calcularAgendamento(baseDate, index, campanha)
    }));

    const { error: insertError } = await supabase
      .from('disparo_envios')
      .insert(rows);

    if (insertError) throw insertError;

    await supabase
      .from('disparo_campanhas')
      .update({
        status: 'agendada',
        total_validos: rows.length,
        atualizado_por_id: usuario.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', campanhaId);

    await supabase
      .from('disparo_logs')
      .insert({
        campanha_id: campanhaId,
        instancia_id: campanha.instancia_id,
        nivel: 'info',
        evento: 'envios_preparados',
        mensagem: `${rows.length} envios preparados`,
        payload: { total: rows.length }
      });

    return res.status(200).json({
      success: true,
      total: rows.length,
      message: 'Envios preparados'
    });
  } catch (error) {
    console.error('Erro ao preparar envios:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Erro ao preparar envios'
    });
  }
}
