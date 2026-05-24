import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';
import { obterQrCodeInstancia } from '@/lib/disparos/evolution';
import { extrairQrCode } from '@/lib/disparos/instancias';

export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    const id = Number(req.query.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID invalido' });
    }

    const { data: instancia, error } = await supabase
      .from('disparo_instancias')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!instancia) return res.status(404).json({ success: false, message: 'Instancia nao encontrada' });

    const payload = await obterQrCodeInstancia(instancia.nome);
    const qrCode = extrairQrCode(payload);

    await supabase
      .from('disparo_instancias')
      .update({ status: 'aguardando_qr', updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.status(200).json({ success: true, qrCode, data: payload });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro ao gerar QR Code da instancia:', error);
    return res.status(status).json({
      success: false,
      message: error?.message || 'Erro ao gerar QR Code da instancia'
    });
  }
}
