import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato, validarAcessoRegistroPorId } from '@/lib/mandato-auth';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  const supabase = createServerClient();
  let usuarioObj = null;
  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);
    usuarioObj = usuario;
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Erro interno' });
  }

  let contextoMandato = null;
  try {
    contextoMandato = await obterContextoMandato(req, usuarioObj, supabase);
  } catch (error) {
    const status = error?.statusCode || 403;
    return res.status(status).json({ error: error.message || 'Erro ao resolver contexto de mandato' });
  }

  if (req.method === 'GET') {
    try {
      let query = supabase.from('agenda_eventos').select('*');

      // Estadual inclui legados (NULL), Federal filtra estritamente mandato_id = 2
      if (contextoMandato.mandatoId === 1) {
        query = query.or(`mandato_id.eq.${contextoMandato.mandatoId},mandato_id.is.null`);
      } else {
        query = query.eq('mandato_id', contextoMandato.mandatoId);
      }

      const { data, error } = await query.order('data', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ data: data || [] });
    } catch (error) {
      console.error('Erro ao listar agenda:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      // Garante que o mandato_id gravado seja estritamente o mandato ativo resolvido
      const payload = {
        ...body,
        mandato_id: contextoMandato.mandatoId,
      };

      const { data, error } = await supabase
        .from('agenda_eventos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ data });
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...body } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      // Validar autorização de acesso ao evento por mandato
      const valAcc = await validarAcessoRegistroPorId('AGENDA', id, contextoMandato, supabase);
      if (!valAcc.autorizado) {
        return res.status(valAcc.status).json({ error: valAcc.message });
      }

      // Impede sobrescrever o mandato_id do evento
      const payload = { ...body };
      delete payload.mandato_id;

      const { data, error } = await supabase
        .from('agenda_eventos')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ data });
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });

      // Validar autorização de acesso ao evento por mandato
      const valAcc = await validarAcessoRegistroPorId('AGENDA', id, contextoMandato, supabase);
      if (!valAcc.autorizado) {
        return res.status(valAcc.status).json({ error: valAcc.message });
      }

      const { error } = await supabase
        .from('agenda_eventos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
