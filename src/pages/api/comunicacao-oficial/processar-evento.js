import { createServerClient } from '@/lib/supabase-server';
import { processarEventoMensagem, processarEventoStatus } from '@/services/processarEventoComunicacao';

/**
 * API Handler para processamento de eventos do webhook com RLS e persistência atômica.
 * Delega a lógica completa para processarEventoComunicacao.js, eliminando a dependência
 * de autochamadas HTTP internas no ambiente Serverless/Vercel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const evento = req.body;

  if (!evento || !evento.tipo) {
    return res.status(400).json({ error: 'Evento inválido' });
  }

  try {
    const supabase = createServerClient();

    if (evento.tipo === 'mensagem') {
      const resultado = await processarEventoMensagem(supabase, evento);
      return res.status(200).json(resultado);
    }

    if (evento.tipo === 'status') {
      const resultado = await processarEventoStatus(supabase, evento);
      return res.status(200).json(resultado);
    }

    return res.status(400).json({ error: 'Tipo de evento não processado' });
  } catch (error) {
    console.error('[ProcessarEventoAPI] Erro ao consolidar evento:', error);
    return res.status(500).json({ error: error.message });
  }
}
