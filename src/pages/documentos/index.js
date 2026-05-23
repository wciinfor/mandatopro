import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette, faUsers, faBook, faDownload, faFolder, faPlus,
  faEye, faTrash, faEdit, faArrowLeft, faUpload, faFile,
  faMusic, faImage, faFilePdf, faFileWord, faFilter,
  faCheckCircle, faTimes, faVideo, faPlay, faExternalLinkAlt, faLink, faCopy
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarCadastro, registrarDelecao, registrarErro } from '@/services/logService';

// Dados mock de documentos por categoria
const CATEGORIAS = {
  artes: {
    nome: 'Artes de Campanha',
    icone: faPalette,
    cor: 'bg-pink-100 text-pink-800',
    iconeColor: 'text-pink-600',
    descricao: 'Folders, santinhos, cartazes e materiais impressos para campanha'
  },
  videos: {
    nome: 'Vídeos de Campanha',
    icone: faVideo,
    cor: 'bg-red-100 text-red-800',
    iconeColor: 'text-red-600',
    descricao: 'Vídeos do YouTube sobre a campanha e eventos'
  },
  modelos: {
    nome: 'Modelos de Grupos',
    icone: faUsers,
    cor: 'bg-blue-100 text-blue-800',
    iconeColor: 'text-blue-600',
    descricao: 'Modelos de documentos para grupos e lideranças'
  },
  treinamento: {
    nome: 'Material de Treinamento',
    icone: faBook,
    cor: 'bg-green-100 text-green-800',
    iconeColor: 'text-green-600',
    descricao: 'Manuais, guias e materiais educativos'
  }
};

export default function Documentos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documentos, setDocumentos] = useState({
    artes: [],
    modelos: [],
    treinamento: [],
    videos: []
  });

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }
    const u = JSON.parse(usuarioStr);
    setUsuario(u);

    // Buscar documentos do Supabase
    const fetchDocumentos = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/documentos', {
          headers: { usuario: JSON.stringify(u) }
        });
        if (!response.ok) throw new Error('Erro ao buscar documentos');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          // Agrupa por categoria
          const agrupados = { artes: [], modelos: [], treinamento: [], videos: [] };
          for (const doc of result.data) {
            const cat = doc.categoria;
            if (agrupados[cat]) agrupados[cat].push(doc);
            else agrupados[cat] = [doc];
          }
          setDocumentos(agrupados);
        }
      } catch (error) {
        console.error('Erro ao carregar documentos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentos();
  }, [router]);

  // Registra acesso ao módulo
  useRegistrarAcesso(usuario, 'DOCUMENTOS', 'Centro de Documentos');

  // --- Upload modal state ---
  const [showModalUpload, setShowModalUpload] = useState(false);
  const [formUpload, setFormUpload] = useState({ nome: '', descricao: '', arquivo: null });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setFormUpload((prev) => ({ ...prev, arquivo: file, nome: prev.nome || file.name.replace(/\.[^.]+$/, '') }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setFormUpload((prev) => ({ ...prev, arquivo: file, nome: prev.nome || file.name.replace(/\.[^.]+$/, '') }));
  };

  const fecharModalUpload = () => {
    setShowModalUpload(false);
    setFormUpload({ nome: '', descricao: '', arquivo: null });
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!formUpload.arquivo) { showError('Selecione um arquivo para upload'); return; }
    if (!formUpload.nome.trim()) { showError('Informe o nome do documento'); return; }
    if (!categoriaSelecionada) { showError('Selecione uma categoria primeiro'); return; }
    setUploading(true);
    try {
      const base64 = await fileToBase64(formUpload.arquivo);
      const response = await fetch('/api/documentos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(usuario) },
        body: JSON.stringify({
          nome: formUpload.nome.trim(),
          descricao: formUpload.descricao.trim(),
          categoria: categoriaSelecionada,
          arquivo_base64: base64,
          arquivo_nome: formUpload.arquivo.name,
          mime_type: formUpload.arquivo.type,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setDocumentos((prev) => ({
        ...prev,
        [categoriaSelecionada]: [result.data, ...prev[categoriaSelecionada]],
      }));
      fecharModalUpload();
      showSuccess('Documento enviado com sucesso!');
    } catch (error) {
      showError('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // --- Editar modal state ---
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [docEditando, setDocEditando] = useState(null);
  const [formEditar, setFormEditar] = useState({ nome: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);

  const handleEditar = (doc) => {
    setDocEditando(doc);
    setFormEditar({ nome: doc.nome, descricao: doc.descricao || '' });
    setShowModalEditar(true);
  };

  const fecharModalEditar = () => {
    setShowModalEditar(false);
    setDocEditando(null);
  };

  const handleSubmitEditar = async (e) => {
    e.preventDefault();
    if (!formEditar.nome.trim()) { showError('Informe o nome do documento'); return; }
    setSalvando(true);
    try {
      const response = await fetch(`/api/documentos?id=${docEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(usuario) },
        body: JSON.stringify({ titulo: formEditar.nome.trim(), descricao: formEditar.descricao.trim() }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setDocumentos((prev) => ({
        ...prev,
        [categoriaSelecionada]: prev[categoriaSelecionada].map((d) =>
          d.id === docEditando.id
            ? { ...d, nome: formEditar.nome.trim(), descricao: formEditar.descricao.trim() }
            : d
        ),
      }));
      fecharModalEditar();
      showSuccess('Documento atualizado com sucesso!');
    } catch (error) {
      showError('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  // --- Vídeos state ---
  const [showModalVideo, setShowModalVideo] = useState(false);
  const [formVideo, setFormVideo] = useState({ nome: '', descricao: '', url: '' });
  const [salvandoVideo, setSalvandoVideo] = useState(false);
  const [videoEditando, setVideoEditando] = useState(null);

  const extrairYoutubeId = (url) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const fecharModalVideo = () => {
    setShowModalVideo(false);
    setFormVideo({ nome: '', descricao: '', url: '' });
    setVideoEditando(null);
  };

  const handleNovoVideo = () => {
    setVideoEditando(null);
    setFormVideo({ nome: '', descricao: '', url: '' });
    setShowModalVideo(true);
  };

  const handleEditarVideo = (video) => {
    setVideoEditando(video);
    setFormVideo({ nome: video.nome, descricao: video.descricao || '', url: video.url || '' });
    setShowModalVideo(true);
  };

  const handleSubmitVideo = async (e) => {
    e.preventDefault();
    const urlVal = formVideo.url.trim();
    if (!formVideo.nome.trim()) { showError('Informe o título do vídeo'); return; }
    if (!urlVal) { showError('Informe a URL do YouTube'); return; }
    if (!extrairYoutubeId(urlVal)) { showError('URL do YouTube inválida. Use o formato: https://www.youtube.com/watch?v=...'); return; }
    setSalvandoVideo(true);
    try {
      if (videoEditando) {
        // Editar
        const response = await fetch(`/api/documentos?id=${videoEditando.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(usuario) },
          body: JSON.stringify({ titulo: formVideo.nome.trim(), descricao: formVideo.descricao.trim() }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        setDocumentos((prev) => ({
          ...prev,
          videos: prev.videos.map((v) =>
            v.id === videoEditando.id
              ? { ...v, nome: formVideo.nome.trim(), descricao: formVideo.descricao.trim() }
              : v
          ),
        }));
        showSuccess('Vídeo atualizado com sucesso!');
      } else {
        // Criar
        const response = await fetch('/api/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(usuario) },
          body: JSON.stringify({
            titulo: formVideo.nome.trim(),
            descricao: formVideo.descricao.trim(),
            categoria: 'videos',
            url_arquivo: urlVal,
            mime_type: 'video/youtube',
            publico: true,
          }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        const novoVideo = {
          id: result.data.id,
          nome: formVideo.nome.trim(),
          descricao: formVideo.descricao.trim(),
          url: urlVal,
          arquivo: '',
          tipo: 'youtube',
          tamanho: '',
          dataCriacao: new Date().toISOString().slice(0, 10),
          criador: usuario.nome || 'Admin',
          downloads: 0,
          categoria: 'videos',
        };
        setDocumentos((prev) => ({ ...prev, videos: [novoVideo, ...prev.videos] }));
        showSuccess('Vídeo adicionado com sucesso!');
      }
      fecharModalVideo();
    } catch (error) {
      showError('Erro ao salvar vídeo: ' + error.message);
    } finally {
      setSalvandoVideo(false);
    }
  };

  const handleDeletarVideo = (video) => {
    showConfirm(
      'Confirmar exclusão',
      `Deseja remover "${video.nome}"?`,
      async () => {
        try {
          const response = await fetch(`/api/documentos?id=${video.id}`, {
            method: 'DELETE',
            headers: { usuario: JSON.stringify(usuario) },
          });
          if (!response.ok) throw new Error('Erro ao remover');
          setDocumentos((prev) => ({ ...prev, videos: prev.videos.filter((v) => v.id !== video.id) }));
          showSuccess('Vídeo removido com sucesso');
        } catch (error) {
          showError('Erro ao remover vídeo');
        }
      },
      'Deletar',
      'Cancelar'
    );
  };

  // Miniatura do arquivo
  const getThumbnail = (doc) => {
    const imgTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const tipo = (doc.tipo || '').toLowerCase();
    if (imgTypes.includes(tipo) && doc.url) {
      return (
        <img
          src={doc.url}
          alt={doc.nome}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      );
    }
    const bgMap = {
      pdf: 'bg-red-50', docx: 'bg-blue-50', doc: 'bg-blue-50',
      xlsx: 'bg-green-50', xls: 'bg-green-50', pptx: 'bg-orange-50',
      ppt: 'bg-orange-50', mp4: 'bg-purple-50', avi: 'bg-purple-50',
      psd: 'bg-pink-50', ai: 'bg-pink-50',
    };
    const bg = bgMap[tipo] || 'bg-gray-50';
    return (
      <div className={`w-full h-full ${bg} flex items-center justify-center`}>
        <FontAwesomeIcon
          icon={getIconeArquivo(tipo)}
          className={`text-4xl ${getCoreArquivo(tipo)}`}
        />
      </div>
    );
  };

  const getIconeArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return faFilePdf;
      case 'docx':
      case 'doc': return faFileWord;
      case 'pptx':
      case 'ppt': return faFile;
      case 'xlsx':
      case 'xls': return faFile;
      case 'mp4':
      case 'avi': return faMusic;
      case 'jpg':
      case 'png':
      case 'psd': return faImage;
      default: return faFile;
    }
  };

  const getCoreArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return 'text-red-600';
      case 'docx':
      case 'doc': return 'text-blue-600';
      case 'pptx':
      case 'ppt': return 'text-orange-600';
      case 'xlsx':
      case 'xls': return 'text-green-600';
      case 'mp4':
      case 'avi': return 'text-purple-600';
      case 'jpg':
      case 'png':
      case 'psd': return 'text-pink-600';
      default: return 'text-gray-600';
    }
  };

  const handleDownload = async (doc) => {
    if (!doc.url && !doc.arquivo) {
      showError('URL do arquivo não disponível');
      return;
    }
    try {
      const url = doc.url || doc.arquivo;
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.arquivo || doc.nome;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      showError('Erro ao baixar arquivo');
    }
  };

  const handleDeletar = (categoria, doc) => {
    showConfirm(
      'Confirmar exclusão',
      `Deseja remover "${doc.nome}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          const response = await fetch(`/api/documentos?id=${doc.id}`, {
            method: 'DELETE',
            headers: { usuario: JSON.stringify(usuario) }
          });
          if (!response.ok) throw new Error('Erro ao remover documento');

          setDocumentos(prev => ({
            ...prev,
            [categoria]: prev[categoria].filter(d => d.id !== doc.id)
          }));

          await registrarDelecao(
            usuario,
            'DOCUMENTOS',
            'Documento',
            doc.id,
            { nome: doc.nome, categoria: CATEGORIAS[categoria]?.nome, arquivo: doc.arquivo }
          );

          showSuccess('Documento removido com sucesso');
        } catch (error) {
          await registrarErro(usuario, 'DOCUMENTOS', 'Erro ao deletar documento', error);
          showError('Erro ao remover documento');
        }
      },
      'Deletar',
      'Cancelar'
    );
  };

  if (!usuario) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  // Se nenhuma categoria selecionada, mostra galeria de categorias
  if (!categoriaSelecionada) {
    return (
      <Layout titulo="Centro de Documentos">
        <Modal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onConfirm={modalState.onConfirm}
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          confirmText={modalState.confirmText}
          cancelText={modalState.cancelText}
          showCancel={modalState.showCancel}
        />

        {/* Descrição do módulo */}
        <div className="mb-8 p-6 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
          <h2 className="text-2xl font-bold text-teal-800 mb-2">
            📚 Centro de Documentos e Materiais
          </h2>
          <p className="text-gray-700">
            Repositório centralizado com artes de campanha, modelos de documentos e materiais de treinamento 
            para uso das lideranças e equipes.
          </p>
        </div>

        {/* Grid de Categorias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Object.entries(CATEGORIAS).map(([chave, categoria]) => (
            <div
              key={chave}
              onClick={() => setCategoriaSelecionada(chave)}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer 
                         overflow-hidden border border-gray-100 hover:border-teal-200 transform hover:scale-105"
            >
              {/* Header com ícone e cor */}
              <div className={`${categoria.cor} p-8 flex flex-col items-center justify-center h-32`}>
                <FontAwesomeIcon icon={categoria.icone} className={`text-5xl ${categoria.iconeColor} mb-3`} />
                <h3 className="text-xl font-bold text-center">{categoria.nome}</h3>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-4">{categoria.descricao}</p>
                
                {/* Estatísticas */}
                <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={chave === 'videos' ? faVideo : faFile} />
                    <span>{documentos[chave]?.length || 0} {chave === 'videos' ? 'vídeos' : 'documentos'}</span>
                  </div>
                  {chave !== 'videos' && (
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faDownload} />
                      <span>{(documentos[chave] || []).reduce((acc, doc) => acc + doc.downloads, 0)} downloads</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer com botão */}
              <div className="px-6 pb-6">
                <button
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700
                             text-white font-bold py-3 rounded-lg transition-all duration-200 flex items-center 
                             justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <FontAwesomeIcon icon={chave === 'videos' ? faPlay : faFolder} />
                  Acessar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo geral */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-teal-500">
            <div className="text-3xl font-bold text-teal-600">
              {Object.keys(CATEGORIAS).length}
            </div>
            <div className="text-sm text-gray-600">Categorias</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <div className="text-3xl font-bold text-blue-600">
              {Object.values(documentos).flat().length}
            </div>
            <div className="text-sm text-gray-600">Total de Documentos</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="text-3xl font-bold text-green-600">
              {Object.values(documentos).flat().reduce((acc, doc) => acc + doc.downloads, 0)}
            </div>
            <div className="text-sm text-gray-600">Downloads Totais</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div className="text-3xl font-bold text-purple-600">
              {Object.values(documentos).flat().reduce((acc, doc) => {
                const tamanhoNum = parseFloat(doc.tamanho);
                return acc + tamanhoNum;
              }, 0).toFixed(1)} MB
            </div>
            <div className="text-sm text-gray-600">Espaço Total</div>
          </div>
        </div>
      </Layout>
    );
  }

  // Se categoria videos, mostra grade de vídeos em vez de documentos
  if (categoriaSelecionada === 'videos') {
    const videosLista = documentos.videos;
    return (
      <Layout titulo="Vídeos de Campanha">
        <Modal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          onConfirm={modalState.onConfirm}
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          confirmText={modalState.confirmText}
          cancelText={modalState.cancelText}
          showCancel={modalState.showCancel}
        />

        {/* Botão voltar */}
        <button
          onClick={() => setCategoriaSelecionada(null)}
          className="mb-6 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg
                    font-semibold flex items-center gap-2 transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Voltar para Categorias
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-red-100 to-rose-100 p-6 rounded-lg mb-6 border-2 border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FontAwesomeIcon icon={faVideo} className="text-4xl text-red-600" />
            <div>
              <h2 className="text-2xl font-bold text-red-800">Vídeos de Campanha</h2>
              <p className="text-sm text-red-700">Vídeos do YouTube sobre a campanha e eventos</p>
            </div>
          </div>
          {usuario?.nivel === 'ADMINISTRADOR' && (
            <button
              onClick={handleNovoVideo}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold
                         flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} />
              Adicionar Vídeo
            </button>
          )}
        </div>

        {/* Grade de vídeos */}
        {videosLista.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <FontAwesomeIcon icon={faVideo} className="text-5xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-1">Nenhum vídeo cadastrado</p>
            {usuario?.nivel === 'ADMINISTRADOR' && (
              <button
                onClick={handleNovoVideo}
                className="mt-4 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold
                           flex items-center gap-2 transition-colors mx-auto"
              >
                <FontAwesomeIcon icon={faPlus} />
                Adicionar primeiro vídeo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videosLista.map((video) => {
              const ytId = extrairYoutubeId(video.url || '');
              return (
                <div key={video.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 flex flex-col overflow-hidden">
                  {/* Thumbnail YouTube clicável */}
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block bg-black group"
                  >
                    {ytId ? (
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={video.nome}
                        className="w-full h-44 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-44 bg-red-900 flex items-center justify-center">
                        <FontAwesomeIcon icon={faVideo} className="text-5xl text-white/40" />
                      </div>
                    )}
                    {/* Botão play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 bg-red-600/90 group-hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors">
                        <FontAwesomeIcon icon={faPlay} className="text-white text-xl ml-1" />
                      </div>
                    </div>
                  </a>

                  {/* Conteúdo */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">{video.nome}</h3>
                    {video.descricao && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">{video.descricao}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-auto">
                      {video.criador} · {video.dataCriacao ? new Date(video.dataCriacao).toLocaleDateString('pt-BR') : ''}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="px-4 pb-4 flex gap-2">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-semibold
                               flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      Assistir
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(video.url);
                        showSuccess('Link copiado!');
                      }}
                      title="Copiar link"
                      className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded font-semibold
                               flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                    {usuario?.nivel === 'ADMINISTRADOR' && (
                      <>
                        <button
                          onClick={() => handleEditarVideo(video)}
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeletarVideo(video)}
                          className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Deletar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de vídeo */}
        {showModalVideo && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-800">
                  {videoEditando ? 'Editar Vídeo' : 'Adicionar Vídeo do YouTube'}
                </h3>
                <button onClick={fecharModalVideo} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <FontAwesomeIcon icon={faTimes} className="text-xl" />
                </button>
              </div>
              <form onSubmit={handleSubmitVideo} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Título do vídeo <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formVideo.nome}
                    onChange={(e) => setFormVideo((p) => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Discurso na Câmara Municipal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                  <textarea
                    value={formVideo.descricao}
                    onChange={(e) => setFormVideo((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descreva o conteúdo do vídeo..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </div>
                {!videoEditando && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      URL do YouTube <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FontAwesomeIcon icon={faLink} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="url"
                        value={formVideo.url}
                        onChange={(e) => setFormVideo((p) => ({ ...p, url: e.target.value }))}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        required
                      />
                    </div>
                    {formVideo.url && extrairYoutubeId(formVideo.url) && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={`https://img.youtube.com/vi/${extrairYoutubeId(formVideo.url)}/hqdefault.jpg`}
                          alt="Preview"
                          className="w-full h-32 object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={fecharModalVideo}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoVideo}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {salvandoVideo ? (
                      <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Salvando...</>
                    ) : videoEditando ? (
                      <><FontAwesomeIcon icon={faEdit} /> Salvar</>
                    ) : (
                      <><FontAwesomeIcon icon={faPlay} /> Adicionar</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  // Se categoria selecionada, mostra lista de documentos
  const categoria = CATEGORIAS[categoriaSelecionada];
  const docs = documentos[categoriaSelecionada];

  return (
    <Layout titulo={categoria.nome}>
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {/* Botão voltar */}
      <button
        onClick={() => setCategoriaSelecionada(null)}
        className="mb-6 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg 
                  font-semibold flex items-center gap-2 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        Voltar para Categorias
      </button>

      {/* Header da Categoria */}
      <div className={`${categoria.cor} p-6 rounded-lg mb-6 border-2`}>
        <div className="flex items-center gap-4">
          <FontAwesomeIcon icon={categoria.icone} className={`text-4xl ${categoria.iconeColor}`} />
          <div>
            <h2 className="text-2xl font-bold">{categoria.nome}</h2>
            <p className="text-sm opacity-75">{categoria.descricao}</p>
          </div>
        </div>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar documentos..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        {usuario?.nivel === 'ADMINISTRADOR' && (
          <button
            onClick={() => setShowModalUpload(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold 
                           flex items-center gap-2 transition-colors">
            <FontAwesomeIcon icon={faPlus} />
            Novo Documento
          </button>
        )}
      </div>

      {/* Lista de Documentos */}
      {docs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FontAwesomeIcon icon={faFolder} className="text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500">Nenhum documento nesta categoria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 flex flex-col">
              {/* Header do card com miniatura */}
              <div className="flex gap-3 p-4 border-b border-gray-100">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FontAwesomeIcon icon={getIconeArquivo(doc.tipo)} className={`text-lg ${getCoreArquivo(doc.tipo)}`} />
                    <h3 className="font-bold text-gray-800 truncate text-sm">{doc.nome}</h3>
                  </div>
                  <p className="text-xs text-gray-400 truncate mb-2">{doc.arquivo}</p>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                    {(doc.tipo || 'arquivo').toUpperCase()}
                  </span>
                </div>
                {/* Miniatura */}
                <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200">
                  {getThumbnail(doc)}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1">
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.descricao}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>Tamanho:</span>
                    <strong>{doc.tamanho}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Criador:</span>
                    <strong>{doc.criador}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Data:</span>
                    <strong>{new Date(doc.dataCriacao).toLocaleDateString('pt-BR')}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Downloads:</span>
                    <strong className="text-teal-600">{doc.downloads}</strong>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => handleDownload(doc)}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-semibold
                           flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Baixar
                </button>
                {usuario?.nivel === 'ADMINISTRADOR' && (
                  <>
                    <button
                      onClick={() => handleEditar(doc)}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded font-semibold
                             flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeletar(categoriaSelecionada, doc)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-semibold
                             flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Deletar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Upload */}
      {showModalUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                Novo Documento — {CATEGORIAS[categoriaSelecionada]?.nome}
              </h3>
              <button onClick={fecharModalUpload} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FontAwesomeIcon icon={faTimes} className="text-xl" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitUpload} className="p-6 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do arquivo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formUpload.nome}
                  onChange={(e) => setFormUpload((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Folder Campanha 2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formUpload.descricao}
                  onChange={(e) => setFormUpload((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descreva o conteúdo do arquivo..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Área de Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Arquivo <span className="text-red-500">*</span></label>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-teal-400 bg-teal-50'
                      : formUpload.arquivo
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {formUpload.arquivo ? (
                    <div>
                      <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-3xl mb-2" />
                      <p className="text-green-700 font-semibold">{formUpload.arquivo.name}</p>
                      <p className="text-gray-500 text-sm mt-1">
                        {formUpload.arquivo.size >= 1024 * 1024
                          ? `${(formUpload.arquivo.size / 1024 / 1024).toFixed(1)} MB`
                          : `${Math.ceil(formUpload.arquivo.size / 1024)} KB`}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFormUpload((p) => ({ ...p, arquivo: null })); }}
                        className="mt-2 text-red-500 hover:text-red-700 text-sm underline"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-3xl mb-2" />
                      <p className="text-gray-600 font-medium">Clique ou arraste o arquivo aqui</p>
                      <p className="text-gray-400 text-sm mt-1">PDF, DOCX, PPTX, PNG, MP4 e outros</p>
                    </div>
                  )}
                  <input ref={inputRef} type="file" hidden onChange={handleFileSelect} />
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalUpload}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Enviando...</>
                  ) : (
                    <><FontAwesomeIcon icon={faUpload} /> Fazer Upload</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showModalEditar && docEditando && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Editar Documento</h3>
              <button onClick={fecharModalEditar} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FontAwesomeIcon icon={faTimes} className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleSubmitEditar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do arquivo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formEditar.nome}
                  onChange={(e) => setFormEditar((p) => ({ ...p, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formEditar.descricao}
                  onChange={(e) => setFormEditar((p) => ({ ...p, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalEditar}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {salvando ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Salvando...</>
                  ) : (
                    <><FontAwesomeIcon icon={faEdit} /> Salvar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
