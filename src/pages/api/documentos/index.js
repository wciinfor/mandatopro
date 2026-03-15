// API de Documentos — CRUD usando Supabase
import { createServerClient } from '@/lib/supabase-server';
import { obterUsuarioHeader } from '@/lib/financeiro-utils';

export const runtime = 'nodejs';

// Mapa entre chaves de categoria do frontend e tipos no banco
const CATEGORIA_PARA_TIPO = {
  artes: 'ARTE_CAMPANHA',
  modelos: 'MODELO_GRUPO',
  treinamento: 'TREINAMENTO',
  videos: 'VIDEO_CAMPANHA',
  contratos: 'CONTRATO',
  pareceres: 'PARECER'
};

const TIPO_PARA_CATEGORIA = Object.fromEntries(
  Object.entries(CATEGORIA_PARA_TIPO).map(([k, v]) => [v, k])
);

export default async function handler(req, res) {
  const usuario = obterUsuarioHeader(req);
  if (!usuario) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }

  const supabase = createServerClient();

  // GET — listar documentos (opcionalmente filtrado por categoria)
  if (req.method === 'GET') {
    try {
      const { categoria, search, limit = '100', offset = '0' } = req.query;

      let query = supabase
        .from('documentos')
        .select('*, usuarios!criado_por_id(nome)', { count: 'exact' })
        .order('data_upload', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (categoria && CATEGORIA_PARA_TIPO[categoria]) {
        query = query.eq('tipo', CATEGORIA_PARA_TIPO[categoria]);
      }

      if (search) {
        query = query.ilike('titulo', `%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Formata para compatibilidade com o frontend
      const documentos = (data || []).map(doc => ({
        id: doc.id,
        nome: doc.titulo,
        descricao: doc.descricao || '',
        arquivo: doc.caminho_arquivo || doc.url_arquivo || '',
        url: doc.url_arquivo || '',
        tipo: doc.mime_type?.split('/').pop() || 'file',
        tamanho: doc.tamanho_bytes
          ? doc.tamanho_bytes >= 1024 * 1024
            ? `${(doc.tamanho_bytes / 1024 / 1024).toFixed(1)} MB`
            : `${Math.ceil(doc.tamanho_bytes / 1024)} KB`
          : '',
        dataCriacao: doc.data_upload?.slice(0, 10) || '',
        criador: doc.usuarios?.nome || '',
        downloads: 0,
        categoria: TIPO_PARA_CATEGORIA[doc.tipo] || doc.tipo,
        publico: doc.publico || false
      }));

      return res.status(200).json({ success: true, data: documentos, total: count || 0 });
    } catch (error) {
      console.error('Erro ao listar documentos:', error);
      return res.status(500).json({ success: false, message: 'Erro ao buscar documentos' });
    }
  }

  // PUT — atualizar título e descrição
  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, message: 'ID obrigatório' });

      const { titulo, descricao } = req.body;
      if (!titulo?.trim()) return res.status(400).json({ success: false, message: 'Título é obrigatório' });

      const { data, error } = await supabase
        .from('documentos')
        .update({ titulo: titulo.trim(), descricao: descricao?.trim() || null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      return res.status(500).json({ success: false, message: 'Erro ao atualizar documento' });
    }
  }

  // POST — criar documento
  if (req.method === 'POST') {
    try {
      const { titulo, descricao, categoria, url_arquivo, caminho_arquivo, tamanho_bytes, mime_type, publico } = req.body;

      if (!titulo || !categoria) {
        return res.status(400).json({ success: false, message: 'Título e categoria são obrigatórios' });
      }

      const tipo = CATEGORIA_PARA_TIPO[categoria] || 'CONTRATO';

      const { data, error } = await supabase
        .from('documentos')
        .insert({
          titulo,
          descricao: descricao || null,
          tipo,
          url_arquivo: url_arquivo || null,
          caminho_arquivo: caminho_arquivo || null,
          tamanho_bytes: tamanho_bytes || null,
          mime_type: mime_type || null,
          criado_por_id: usuario.id || null,
          publico: publico ?? false,
          data_upload: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, data });
    } catch (error) {
      console.error('Erro ao criar documento:', error);
      return res.status(500).json({ success: false, message: 'Erro ao criar documento' });
    }
  }

  // DELETE — remover documento
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, message: 'ID obrigatório' });

      const { error } = await supabase
        .from('documentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Documento removido' });
    } catch (error) {
      console.error('Erro ao remover documento:', error);
      return res.status(500).json({ success: false, message: 'Erro ao remover documento' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método não permitido' });
}
