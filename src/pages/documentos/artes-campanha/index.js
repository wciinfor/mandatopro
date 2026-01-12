import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette, faDownload, faEye, faTrash, faEdit, faArrowLeft, faPlus,
  faFilePdf, faFileWord, faImage, faMusic, faFile, faFilter
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarDelecao, registrarErro } from '@/services/logService';

export default function ArtesCampanha() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentos, setDocumentos] = useState([
    {
      id: 1,
      nome: 'Folder Campanha 2024',
      descricao: 'Folder principal colorido com informações da campanha',
      arquivo: 'folder-2024.pdf',
      tipo: 'pdf',
      tamanho: '2.5 MB',
      dataCriacao: '2024-11-20',
      criador: 'Admin',
      downloads: 45,
      imagem: '📄'
    },
    {
      id: 2,
      nome: 'Santinho 1000 unidades',
      descricao: 'Santinho preto e branco para impressão - frente e verso',
      arquivo: 'santinho-pb.pdf',
      tipo: 'pdf',
      tamanho: '1.2 MB',
      dataCriacao: '2024-11-15',
      criador: 'Admin',
      downloads: 120,
      imagem: '🎟️'
    },
    {
      id: 3,
      nome: 'Cartaz Grande A2',
      descricao: 'Cartaz em alta resolução para fixação em pontos estratégicos',
      arquivo: 'cartaz-a2.psd',
      tipo: 'psd',
      tamanho: '45 MB',
      dataCriacao: '2024-11-18',
      criador: 'Designer',
      downloads: 25,
      imagem: '🖼️'
    },
    {
      id: 4,
      nome: 'Banner Digital',
      descricao: 'Banner para redes sociais e publicações online (1200x628px)',
      arquivo: 'banner-web.png',
      tipo: 'png',
      tamanho: '3.8 MB',
      dataCriacao: '2024-11-16',
      criador: 'Designer',
      downloads: 67,
      imagem: '📱'
    },
    {
      id: 5,
      nome: 'Adesivo Redondo',
      descricao: 'Adesivo redondo com logo da campanha (arquivo vetorial)',
      arquivo: 'adesivo-redondo.ai',
      tipo: 'ai',
      tamanho: '2.1 MB',
      dataCriacao: '2024-10-10',
      criador: 'Designer',
      downloads: 89,
      imagem: '🔵'
    },
    {
      id: 6,
      nome: 'Tshirt Design',
      descricao: 'Design de camiseta para produção com serigrafia',
      arquivo: 'tshirt-design.psd',
      tipo: 'psd',
      tamanho: '8.3 MB',
      dataCriacao: '2024-11-05',
      criador: 'Designer',
      downloads: 34,
      imagem: '👕'
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

  useRegistrarAcesso(usuario, 'DOCUMENTOS', 'Artes de Campanha');

  const getIconeArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return faFilePdf;
      case 'psd':
      case 'ai': return faImage;
      case 'png':
      case 'jpg': return faImage;
      default: return faFile;
    }
  };

  const getCoreArquivo = (tipo) => {
    switch(tipo) {
      case 'pdf': return 'text-red-600';
      case 'psd':
      case 'ai': return 'text-pink-600';
      case 'png':
      case 'jpg': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const documentosFiltrados = documentos.filter(doc =>
    doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = async (doc) => {
    try {
      showSuccess(`Arquivo "${doc.nome}" será baixado em breve`);
    } catch (error) {
      showError('Erro ao baixar arquivo');
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
            'Arte de Campanha',
            doc.id,
            {
              nome: doc.nome,
              arquivo: doc.arquivo
            }
          );

          showSuccess('Documento removido com sucesso');
        } catch (error) {
          await registrarErro(usuario, 'DOCUMENTOS', 'Erro ao deletar arte', error);
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

  return (
    <Layout titulo="Artes de Campanha">
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
      <div className="bg-gradient-to-r from-pink-100 to-red-100 p-6 rounded-lg mb-6 border-2 border-pink-200">
        <div className="flex items-center gap-4">
          <FontAwesomeIcon icon={faPalette} className="text-5xl text-pink-600" />
          <div>
            <h2 className="text-2xl font-bold text-pink-800">Artes de Campanha</h2>
            <p className="text-sm text-pink-700">
              Materiais visuais como folders, santinhos, cartazes e designs para campanhas
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
            placeholder="🔍 Buscar artes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        {usuario?.nivel === 'ADMINISTRADOR' && (
          <button className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold 
                           flex items-center gap-2 transition-colors">
            <FontAwesomeIcon icon={faPlus} />
            Nova Arte
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-pink-500">
          <div className="text-2xl font-bold text-pink-600">{documentosFiltrados.length}</div>
          <div className="text-sm text-gray-600">Artes no Filtro</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-2xl font-bold text-orange-600">
            {documentosFiltrados.reduce((acc, doc) => acc + doc.downloads, 0)}
          </div>
          <div className="text-sm text-gray-600">Downloads Totais</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            {(documentosFiltrados.reduce((acc, doc) => {
              const tamanhoNum = parseFloat(doc.tamanho);
              return acc + tamanhoNum;
            }, 0)).toFixed(1)} MB
          </div>
          <div className="text-sm text-gray-600">Espaço Utilizado</div>
        </div>
      </div>

      {/* Lista de documentos */}
      {documentosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FontAwesomeIcon icon={faPalette} className="text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">Nenhuma arte encontrada</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-pink-600 hover:text-pink-700 font-semibold"
            >
              Limpar filtro
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documentosFiltrados.map(doc => (
            <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden hover:border-pink-200">
              {/* Preview */}
              <div className="h-40 bg-gradient-to-br from-pink-100 to-red-100 flex items-center justify-center border-b border-gray-100">
                <div className="text-6xl">{doc.imagem}</div>
              </div>

              {/* Conteúdo */}
              <div className="p-4">
                {/* Tipo de arquivo */}
                <span className="inline-block px-2 py-1 bg-pink-100 text-pink-700 text-xs font-semibold rounded mb-2">
                  {doc.tipo.toUpperCase()}
                </span>

                {/* Título */}
                <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">{doc.nome}</h3>

                {/* Descrição */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{doc.descricao}</p>

                {/* Metadados */}
                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Tamanho:</span>
                    <strong>{doc.tamanho}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Downloads:</span>
                    <strong className="text-pink-600">{doc.downloads}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Data:</span>
                    <strong>{new Date(doc.dataCriacao).toLocaleDateString('pt-BR')}</strong>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="px-4 pb-4 border-t border-gray-100 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2 rounded font-semibold
                             flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Baixar
                  </button>
                  <button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold
                             flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <FontAwesomeIcon icon={faEye} />
                    Ver
                  </button>
                </div>
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
      )}
    </Layout>
  );
}
