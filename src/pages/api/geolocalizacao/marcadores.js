import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';

export const runtime = 'nodejs';

function mapearMarcador(item) {
  const telefoneEleitor = item.eleitores?.celular || item.eleitores?.telefone || item.eleitores?.whatsapp || null;
  const telefoneLideranca = item.liderancas?.telefone || null;

  return {
    id: item.id,
    tipo: item.tipo,
    nome: item.nome,
    cidade: item.cidade,
    bairro: item.bairro,
    endereco: item.endereco,
    latitude: item.latitude,
    longitude: item.longitude,
    status: item.status || 'ATIVO',
    telefone: telefoneEleitor || telefoneLideranca,
    influencia: item.liderancas?.influencia || item.nivel_influencia || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo nao permitido' });
  }

  const supabase = createServerClient();

  try {
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirUsuario(usuario);

    const { data, error } = await supabase
      .from('geolocalizacao')
      .select('id, tipo, nome, descricao, cidade, bairro, endereco, latitude, longitude, status, nivel_influencia, eleitor_id, lideranca_id, eleitores(telefone,celular,whatsapp,email), liderancas(telefone,email,influencia)')
      .order('id', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ data: (data || []).map(mapearMarcador) });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }
}
