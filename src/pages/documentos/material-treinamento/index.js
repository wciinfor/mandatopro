import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook, faDownload, faEye, faTrash, faEdit, faArrowLeft, faPlus,
  faFilePdf, faVideo, faMusic, faFile, faFilter, faStar, faPlayCircle
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarDelecao, registrarErro, registrarAcesso } from '@/services/logService';

export default function MaterialTreinamento() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [documentos, setDocumentos] = useState([
    {
      id: 201,
      nome: 'Guia do Líder - Edição 2024',
      descricao: 'Manual completo de como ser um líder eficaz. Inclui dicas de comunicação, mobilização e engajamento',
      arquivo: 'guia-lider-2024.pdf',
      tipo: 'pdf',
      tamanho: '3.2 MB',
      dataCriacao: '2024-08-01',
      criador: 'Coordenação',
      downloads: 450,
      categoria: 'Guias e Manuais',
      favoritos: 234,
      duracao: '45 páginas',
      nivel: 'Iniciante'
    },
    {
      id: 202,
      nome: 'Vídeo: Técnicas de Comunicação Política',
      descricao: 'Aula em vídeo HD sobre técnicas eficazes de comunicação em campanhas políticas',
      arquivo: 'video-comunicacao.mp4',
      tipo: 'mp4',
      tamanho: '250 MB',
      dataCriacao: '2024-09-01',
      criador: 'Treinamento',
      downloads: 180,
      categoria: 'Vídeos e Webinars',
      favoritos: 145,
      duracao: '18 minutos',
      nivel: 'Intermediário'
    },
    {
      id: 203,
      nome: 'Apresentação Executiva 2024',
      descricao: 'Slide show com objetivos, metas e estratégia da campanha para apresentações',
      arquivo: 'apresentacao-2024.pptx',
      tipo: 'pptx',
      tamanho: '8.5 MB',
      dataCriacao: '2024-11-01',
      criador: 'Comunicação',
      downloads: 92,
      categoria: 'Apresentações',
      favoritos: 67,
      duracao: '25 slides',
      nivel: 'Intermediário'
    },
    {
      id: 204,
      nome: 'Vídeo: Como Organizar um Abaixo-Assinado',
      descricao: 'Tutorial passo a passo de como organizar e executar um abaixo-assinado efetivo',
      arquivo: 'video-abaixo-assinado.mp4',
      tipo: 'mp4',
      tamanho: '180 MB',
      dataCriacao: '2024-10-10',
      criador: 'Treinamento',
      downloads: 220,
      categoria: 'Vídeos e Webinars',
      favoritos: 189,
      duracao: '12 minutos',
      nivel: 'Iniciante'
    },
    {
      id: 205,
      nome: 'Manual de Mídias Sociais',
      descricao: 'Guia prático para usar redes sociais de forma estratégica na campanha',
      arquivo: 'manual-midias.pdf',
      tipo: 'pdf',
      tamanho: '2.8 MB',
      dataCriacao: '2024-09-15',
      criador: 'Comunicação',
      downloads: 310,
      categoria: 'Guias e Manuais',
      favoritos: 198,
      duracao: '38 páginas',
      nivel: 'Intermediário'
    },
    {
      id: 206,
      nome: 'Vídeo: Resolução de Conflitos em Grupos',
      descricao: 'Aula sobre mediação e resolução construtiva de conflitos dentro de grupos de trabalho',
      arquivo: 'video-conflitos.mp4',
      tipo: 'mp4',
      tamanho: '220 MB',
      dataCriacao: '2024-10-20',
      criador: 'Treinamento',
      downloads: 156,
      categoria: 'Vídeos e Webinars',
      favoritos: 134,
      duracao: '15 minutos',
      nivel: 'Avançado'
    },
    {
      id: 207,
      nome: 'Checklist de Campanha',
      descricao: 'Lista de verificação com todas as tarefas e prazos para uma campanha bem-sucedida',
      arquivo: 'checklist-campanha.xlsx',
      tipo: 'xlsx',
      tamanho: '450 KB',
      dataCriacao: '2024-08-15',
      criador: 'Admin',
      downloads: 289,
      categoria: 'Ferramentas',
      favoritos: 156,
      duracao: '3 abas',
      nivel: 'Iniciante'
    },
    {
      id: 208,
      nome: 'Vídeo: Recrutamento e Motivação de Voluntários',
      descricao: 'Estratégias práticas para recrutar e manter voluntários motivados durante a campanha',
      arquivo: 'video-voluntarios.mp4',
      tipo: 'mp4',
      tamanho: '195 MB',
      dataCriacao: '2024-11-05',
      criador: 'Treinamento',
      downloads: 167,
      categoria: 'Vídeos e Webinars',
      favoritos: 121,
      duracao: '14 minutos',
      nivel: 'Avançado'
    }
  ]);

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }
    setUsuario(JSON.parse(usuarioStr));
  }, [router]);

  useRegistrarAcesso(usuario, 'DOCUMENTOS', 'Material de Treinamento');

  const getCoreArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return 'text-red-600';
      case 'mp4':
      case 'avi': return 'text-purple-600';
      case 'pptx':
      case 'ppt': return 'text-orange-600';
      case 'xlsx':
      case 'xls': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getIconeArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return faFilePdf;
      case 'mp4':
      case 'avi': return faVideo;
      case 'pptx':
      case 'ppt': return faFile;
      case 'xlsx':
      case 'xls': return faFile;
      default: return faFile;
    }
  };

  const getCoreNivel = (nivel) => {
    switch(nivel) {
      case 'Iniciante': return 'bg-green-100 text-green-700';
      case 'Intermediário': return 'bg-yellow-100 text-yellow-700';
      case 'Avançado': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  let documentosFiltrados = documentos;

  if (searchTerm) {
    documentosFiltrados = documentosFiltrados.filter(doc =>
      doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (tipoFiltro !== 'todos') {
    documentosFiltrados = documentosFiltrados.filter(doc => {
      if (tipoFiltro === 'videos') return doc.tipo === 'mp4';
      if (tipoFiltro === 'pdfs') return doc.tipo === 'pdf';
      if (tipoFiltro === 'apresentacoes') return doc.tipo === 'pptx';
      if (tipoFiltro === 'ferramentas') return doc.tipo === 'xlsx';
      return true;
    });
  }

  const handleAssistir = async (doc) => {
    try {
      await registrarAcesso(
        usuario,
        'DOCUMENTOS',
        `Assistindo: ${doc.nome}`
      );
      showSuccess(`Abrindo "${doc.nome}"...`);
    } catch (error) {
      showError('Erro ao abrir documento');
    }
  };

  const handleDeletar = (doc) => {
    showConfirm(
      'Confirmar exclusão',
      `Deseja remover "${doc.nome}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          setDocumentos(prev => prev.filter(d => d.id !== doc.id));
          
          await registrarDelecao(
            usuario,
            'DOCUMENTOS',
            'Material de Treinamento',
            doc.id,
            {
              nome: doc.nome,
              categoria: doc.categoria
            }
          );

          showSuccess('Documento removido com sucesso');
        } catch (error) {
          await registrarErro(usuario, 'DOCUMENTOS', 'Erro ao deletar material', error);
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

  // Agrupar por categoria
  const categorias = {};
  documentosFiltrados.forEach(doc => {
    if (!categorias[doc.categoria]) {
      categorias[doc.categoria] = [];
    }
    categorias[doc.categoria].push(doc);
  });

  return (
    <Layout titulo="Material de Treinamento">
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
        onClick={() => router.push('/documentos')}
        className="mb-6 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg 
                  font-semibold flex items-center gap-2 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        Voltar
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-6 rounded-lg mb-6 border-2 border-green-200">
        <div className="flex items-center gap-4">
          <FontAwesomeIcon icon={faBook} className="text-5xl text-green-600" />
          <div>
            <h2 className="text-2xl font-bold text-green-800">Material de Treinamento</h2>
            <p className="text-sm text-green-700">
              Guias, vídeos, apresentações e ferramentas para capacitação e desenvolvimento
            </p>
          </div>
        </div>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <FontAwesomeIcon 
            icon={faFilter} 
            className="absolute left-3 top-3 text-gray-400"
          />
          <input
            type="text"
            placeholder="🔍 Buscar materiais..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        
        {/* Filtro por tipo */}
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="todos">Todos os Tipos</option>
          <option value="videos">Vídeos</option>
          <option value="pdfs">Guias (PDF)</option>
          <option value="apresentacoes">Apresentações</option>
          <option value="ferramentas">Ferramentas</option>
        </select>

        {usuario?.nivel === 'ADMINISTRADOR' && (
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold 
                           flex items-center gap-2 transition-colors whitespace-nowrap">
            <FontAwesomeIcon icon={faPlus} />
            Novo Material
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{documentosFiltrados.length}</div>
          <div className="text-sm text-gray-600">Materiais</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">
            {documentosFiltrados.filter(d => d.tipo === 'mp4').length}
          </div>
          <div className="text-sm text-gray-600">Vídeos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-2xl font-bold text-orange-600">
            {documentosFiltrados.reduce((acc, doc) => acc + doc.downloads, 0)}
          </div>
          <div className="text-sm text-gray-600">Downloads</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-pink-500">
          <div className="text-2xl font-bold text-pink-600">
            {documentosFiltrados.reduce((acc, doc) => acc + doc.favoritos, 0)}
          </div>
          <div className="text-sm text-gray-600">Favoritos</div>
        </div>
      </div>

      {/* Materiais organizados por categoria */}
      {documentosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FontAwesomeIcon icon={faBook} className="text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">Nenhum material encontrado</p>
          {(searchTerm || tipoFiltro !== 'todos') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTipoFiltro('todos');
              }}
              className="text-green-600 hover:text-green-700 font-semibold"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(categorias).map(([categoria, docs]) => (
            <div key={categoria}>
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-600"></span>
                {categoria}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {docs.map(doc => (
                  <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden hover:border-green-200">
                    {/* Header com preview */}
                    <div className="h-32 bg-gradient-to-br from-green-100 to-emerald-100 relative flex items-center justify-center overflow-hidden group">
                      {doc.tipo === 'mp4' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FontAwesomeIcon 
                            icon={faPlayCircle} 
                            className="text-5xl text-green-600 opacity-30 group-hover:opacity-60 transition-opacity"
                          />
                        </div>
                      )}
                      <FontAwesomeIcon 
                        icon={getIconeArquivo(doc.tipo)} 
                        className={`text-4xl ${getCoreArquivo(doc.tipo)} opacity-70`}
                      />
                    </div>

                    {/* Conteúdo */}
                    <div className="p-4">
                      {/* Badges */}
                      <div className="flex gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getCoreNivel(doc.nivel)}`}>
                          {doc.nivel}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                          {doc.tipo.toUpperCase()}
                        </span>
                      </div>

                      {/* Título */}
                      <h4 className="font-bold text-gray-800 mb-2 line-clamp-2">{doc.nome}</h4>

                      {/* Descrição */}
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.descricao}</p>

                      {/* Metadados */}
                      <div className="space-y-1 text-xs text-gray-500 mb-4">
                        <div className="flex items-center justify-between">
                          <span>Duração:</span>
                          <strong>{doc.duracao}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tamanho:</span>
                          <strong>{doc.tamanho}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Downloads:</span>
                          <strong className="text-green-600">{doc.downloads}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Favoritos:</span>
                          <strong className="text-pink-600">
                            <FontAwesomeIcon icon={faStar} className="text-pink-500 mr-1" />
                            {doc.favoritos}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-2">
                      {doc.tipo === 'mp4' ? (
                        <button
                          onClick={() => handleAssistir(doc)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                          <FontAwesomeIcon icon={faPlayCircle} />
                          Assistir
                        </button>
                      ) : (
                        <button
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                          <FontAwesomeIcon icon={faDownload} />
                          Baixar
                        </button>
                      )}
                      {usuario?.nivel === 'ADMINISTRADOR' && (
                        <div className="flex gap-2">
                          <button
                            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded font-semibold
                                     flex items-center justify-center gap-2 transition-colors text-sm"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeletar(doc)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-semibold
                                     flex items-center justify-center gap-2 transition-colors text-sm"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                            Deletar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
