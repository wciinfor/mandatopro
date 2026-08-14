import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirUsuario } from '@/lib/api-auth';
import { obterContextoMandato } from '@/lib/mandato-auth';

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

    const contextoMandato = await obterContextoMandato(req, usuario, supabase);
    const { pertencimentosPermitidos, mandatoId } = contextoMandato;

    // Buscar marcadores e suas relações para filtro
    const { data, error } = await supabase
      .from('geolocalizacao')
      .select('id, tipo, nome, descricao, cidade, bairro, endereco, latitude, longitude, status, nivel_influencia, eleitor_id, lideranca_id, eleitores(telefone,celular,whatsapp,email,pertencimento), liderancas(telefone,email,influencia)')
      .order('id', { ascending: false });

    if (error) throw error;

    let marcadores = data || [];

    // Se houver liderancas com vinculo por mandato, obter IDs permitidos
    let liderancaIdsPermitidos = null;
    try {
      const { data: vinculosLid } = await supabase
        .from('liderancas_mandatos')
        .select('lideranca_id')
        .eq('mandato_id', mandatoId);

      if (Array.isArray(vinculosLid)) {
        liderancaIdsPermitidos = new Set(vinculosLid.map(v => Number(v.lideranca_id)));
      }
    } catch {
      liderancaIdsPermitidos = null;
    }

    // Filtrar marcadores conforme o mandato ativo
    const marcadoresFiltrados = marcadores.filter((item) => {
      // Se for marcador de eleitor, validar pertencimento
      if (item.eleitores) {
        const p = item.eleitores.pertencimento;
        if (!p || !pertencimentosPermitidos.includes(p)) {
          return false;
        }
      }

      // Se for marcador de liderança, validar vínculo de mandato se tabela existir
      if (item.lideranca_id && liderancaIdsPermitidos) {
        if (!liderancaIdsPermitidos.has(Number(item.lideranca_id))) {
          return false;
        }
      }

      return true;
    });

    return res.status(200).json({ data: marcadoresFiltrados.map(mapearMarcador) });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Erro interno' });
  }
}
