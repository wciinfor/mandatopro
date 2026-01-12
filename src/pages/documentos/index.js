import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette, faUsers, faBook, faDownload, faFolder, faPlus,
  faEye, faTrash, faEdit, faArrowLeft, faUpload, faFile,
  faMusic, faImage, faFilePdf, faFileWord, faFilter
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
  const [documentos, setDocumentos] = useState({
    artes: [
      {
        id: 1,
        nome: 'Folder Campanha 2024',
        descricao: 'Folder principal da campanha',
        arquivo: 'folder-2024.pdf',
        tipo: 'pdf',
        tamanho: '2.5 MB',
        dataCriacao: '2024-11-20',
        criador: 'Admin',
        downloads: 45
      },
      {
        id: 2,
        nome: 'Santinho 1000 unidades',
        descricao: 'Santinho preto e branco para impressão',
        arquivo: 'santinho-pb.pdf',
        tipo: 'pdf',
        tamanho: '1.2 MB',
        dataCriacao: '2024-11-15',
        criador: 'Admin',
        downloads: 120
      },
      {
        id: 3,
        nome: 'Cartaz Grande',
        descricao: 'Cartaz A2 para fixação em pontos estratégicos',
        arquivo: 'cartaz-a2.psd',
        tipo: 'psd',
        tamanho: '45 MB',
        dataCriacao: '2024-11-18',
        criador: 'Designer',
        downloads: 25
      }
    ],
    modelos: [
      {
        id: 101,
        nome: 'Modelo de Petição',
        descricao: 'Petição padrão para grupos solicitar ao mandato',
        arquivo: 'modelo-peticao.docx',
        tipo: 'docx',
        tamanho: '150 KB',
        dataCriacao: '2024-10-01',
        criador: 'Admin',
        downloads: 200
      },
      {
        id: 102,
        nome: 'Ofício Parlamentar',
        descricao: 'Ofício para comunicação oficial com órgãos públicos',
        arquivo: 'modelo-oficio.docx',
        tipo: 'docx',
        tamanho: '85 KB',
        dataCriacao: '2024-10-05',
        criador: 'Jurídico',
        downloads: 156
      },
      {
        id: 103,
        nome: 'Ata de Reunião',
        descricao: 'Modelo padrão de ata para reuniões de grupo',
        arquivo: 'modelo-ata.xlsx',
        tipo: 'xlsx',
        tamanho: '120 KB',
        dataCriacao: '2024-10-10',
        criador: 'Admin',
        downloads: 87
      }
    ],
    treinamento: [
      {
        id: 201,
        nome: 'Guia do Líder',
        descricao: 'Manual completo de como ser um líder eficaz',
        arquivo: 'guia-lider.pdf',
        tipo: 'pdf',
        tamanho: '3.2 MB',
        dataCriacao: '2024-08-01',
        criador: 'Coordenação',
        downloads: 450
      },
      {
        id: 202,
        nome: 'Vídeo: Técnicas de Comunicação',
        descricao: 'Aula em vídeo sobre técnicas de comunicação política',
        arquivo: 'video-comunicacao.mp4',
        tipo: 'mp4',
        tamanho: '250 MB',
        dataCriacao: '2024-09-01',
        criador: 'Treinamento',
        downloads: 180
      },
      {
        id: 203,
        nome: 'Apresentação Executiva',
        descricao: 'Slide show sobre objetivos da campanha',
        arquivo: 'apresentacao-2024.pptx',
        tipo: 'pptx',
        tamanho: '8.5 MB',
        dataCriacao: '2024-11-01',
        criador: 'Comunicação',
        downloads: 92
      }
    ]
  });

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }
    setUsuario(JSON.parse(usuarioStr));
  }, [router]);

  // Registra acesso ao módulo
  useRegistrarAcesso(usuario, 'DOCUMENTOS', 'Centro de Documentos');

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
    try {
      showSuccess(`Arquivo "${doc.nome}" será baixado em breve`);
      // Aqui você implementaria a lógica de download real
      console.log(`Baixando: ${doc.arquivo}`);
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
          setDocumentos(prev => ({
            ...prev,
            [categoria]: prev[categoria].filter(d => d.id !== doc.id)
          }));

          await registrarDelecao(
            usuario,
            'DOCUMENTOS',
            'Documento',
            doc.id,
            {
              nome: doc.nome,
              categoria: CATEGORIAS[categoria].nome,
              arquivo: doc.arquivo
            }
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                    <FontAwesomeIcon icon={faFile} />
                    <span>{documentos[chave].length} documentos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faDownload} />
                    <span>{documentos[chave].reduce((acc, doc) => acc + doc.downloads, 0)} downloads</span>
                  </div>
                </div>
              </div>

              {/* Footer com botão */}
              <div className="px-6 pb-6">
                <button
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700
                             text-white font-bold py-3 rounded-lg transition-all duration-200 flex items-center 
                             justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <FontAwesomeIcon icon={faFolder} />
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
          <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold 
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
            <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100">
              {/* Header do card */}
              <div className="p-4 border-b border-gray-100 flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <FontAwesomeIcon 
                    icon={getIconeArquivo(doc.tipo)} 
                    className={`text-3xl ${getCoreArquivo(doc.tipo)} mt-1`}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-800 truncate">{doc.nome}</h3>
                    <p className="text-xs text-gray-500">{doc.arquivo}</p>
                  </div>
                </div>
                <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                  {doc.tipo.toUpperCase()}
                </span>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.descricao}</p>
                
                {/* Metadados */}
                <div className="space-y-1 text-xs text-gray-500 mb-3">
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
                <button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold
                           flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <FontAwesomeIcon icon={faEye} />
                  Visualizar
                </button>
                {usuario?.nivel === 'ADMINISTRADOR' && (
                  <>
                    <button
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
    </Layout>
  );
}
