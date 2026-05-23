import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioAutenticado, exigirAdministrador } from '@/lib/api-auth';

export const runtime = 'nodejs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

const CATEGORIA_PARA_TIPO = {
  artes: 'ARTE_CAMPANHA',
  modelos: 'MODELO_GRUPO',
  treinamento: 'TREINAMENTO',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo nao permitido' });
  }

  try {
    const supabase = createServerClient();
    const { usuario } = await obterUsuarioAutenticado(req, supabase);
    exigirAdministrador(usuario);

    const { nome, descricao, categoria, arquivo_base64, arquivo_nome, mime_type } = req.body;

    if (!nome || !arquivo_base64 || !arquivo_nome) {
      return res.status(400).json({ success: false, message: 'Nome e arquivo sao obrigatorios' });
    }

    const id = crypto.randomUUID();
    const ext = arquivo_nome.split('.').pop().toLowerCase();
    const caminho = `${categoria || 'geral'}/${id}.${ext}`;
    const buffer = Buffer.from(arquivo_base64, 'base64');

    const { error: storageError } = await supabase.storage
      .from('documentos')
      .upload(caminho, buffer, {
        contentType: mime_type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(caminho);

    const { data, error: dbError } = await supabase
      .from('documentos')
      .insert({
        titulo: nome,
        descricao: descricao || null,
        tipo: CATEGORIA_PARA_TIPO[categoria] || 'OUTRO',
        url_arquivo: urlData?.publicUrl || null,
        caminho_arquivo: caminho,
        tamanho_bytes: buffer.length,
        mime_type: mime_type || null,
        criado_por_id: usuario.id || null,
        publico: true,
        data_upload: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('documentos').remove([caminho]);
      throw dbError;
    }

    const tamanho =
      buffer.length >= 1024 * 1024
        ? `${(buffer.length / 1024 / 1024).toFixed(1)} MB`
        : `${Math.ceil(buffer.length / 1024)} KB`;

    return res.status(201).json({
      success: true,
      data: {
        id: data.id,
        nome: data.titulo,
        descricao: data.descricao || '',
        arquivo: arquivo_nome,
        url: urlData?.publicUrl || '',
        tipo: ext,
        tamanho,
        dataCriacao: data.data_upload?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        criador: usuario.nome || 'Admin',
        downloads: 0,
        categoria,
        imagem: 'documento',
        versao: '1.0',
        status: 'Ativo',
        favoritos: 0,
        nivel: 'Iniciante',
        duracao: '',
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    console.error('Erro no upload de documento:', error);
    return res
      .status(status)
      .json({ success: false, message: 'Erro ao fazer upload: ' + (error.message || 'Erro desconhecido') });
  }
}
