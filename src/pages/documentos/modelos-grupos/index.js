import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faDownload, faEye, faTrash, faEdit, faArrowLeft, faPlus,
  faFileWord, faFileExcel, faFile, faFilter, faCopy
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarDelecao, registrarCadastro, registrarErro } from '@/services/logService';

export default function ModelosGrupos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentos, setDocumentos] = useState([
    {
      id: 101,
      nome: 'Modelo de Petição',
      descricao: 'Petição padrão para grupos solicitarem ao mandato (2 páginas)',
      arquivo: 'modelo-peticao.docx',
      tipo: 'docx',
      tamanho: '150 KB',
      dataCriacao: '2024-10-01',
      criador: 'Admin',
      downloads: 200,
      categoria: 'Documentos Formais',
      status: 'Ativo',
      versao: '2.0'
    },
    {
      id: 102,
      nome: 'Ofício Parlamentar',
      descricao: 'Modelo de ofício para comunicação oficial com órgãos públicos',
      arquivo: 'modelo-oficio.docx',
      tipo: 'docx',
      tamanho: '85 KB',
      dataCriacao: '2024-10-05',
      criador: 'Jurídico',
      downloads: 156,
      categoria: 'Documentos Formais',
      status: 'Ativo',
      versao: '1.5'
    },
    {
      id: 103,
      nome: 'Ata de Reunião',
      descricao: 'Modelo padrão para registrar atas de reuniões de grupos',
      arquivo: 'modelo-ata.xlsx',
      tipo: 'xlsx',
      tamanho: '120 KB',
      dataCriacao: '2024-10-10',
      criador: 'Admin',
      downloads: 87,
      categoria: 'Registro de Atividades',
      status: 'Ativo',
      versao: '1.2'
    },
    {
      id: 104,
      nome: 'Termo de Responsabilidade',
      descricao: 'Termo assinado por líderes quando recebem materiais de campanha',
      arquivo: 'termo-responsabilidade.docx',
      tipo: 'docx',
      tamanho: '95 KB',
      dataCriacao: '2024-11-01',
      criador: 'Jurídico',
      downloads: 45,
      categoria: 'Documentos Formais',
      status: 'Ativo',
      versao: '1.0'
    },
    {
      id: 105,
      nome: 'Relatório de Atividades',
      descricao: 'Modelo para grupos relatarem suas atividades mensalmente',
      arquivo: 'relatorio-atividades.xlsx',
      tipo: 'xlsx',
      tamanho: '180 KB',
      dataCriacao: '2024-09-15',
      criador: 'Admin',
      downloads: 120,
      categoria: 'Registro de Atividades',
      status: 'Ativo',
      versao: '2.1'
    },
    {
      id: 106,
      nome: 'Solicitação de Recursos',
      descricao: 'Formulário para grupos solicitarem recursos e materiais ao mandato',
      arquivo: 'solicitacao-recursos.docx',
      tipo: 'docx',
      tamanho: '110 KB',
      dataCriacao: '2024-10-20',
      criador: 'Admin',
      downloads: 78,
      categoria: 'Formulários',
      status: 'Ativo',
      versao: '1.3'
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

  useRegistrarAcesso(usuario, 'DOCUMENTOS', 'Modelos de Grupos');

  const getCoreArquivo = (tipo) => {
    switch(tipo) {
      case 'docx':
      case 'doc': return 'text-blue-600';
      case 'xlsx':
      case 'xls': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getIconeArquivo = (tipo) => {
    return tipo.includes('doc') ? faFileWord : faFileExcel;
  };

  const documentosFiltrados = documentos.filter(doc =>
    doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = async (doc) => {
    try {
      showSuccess(`Arquivo "${doc.nome}" será baixado em breve`);
    } catch (error) {
      showError('Erro ao baixar arquivo');
    }
  };

  const handleDuplicar = async (doc) => {
    try {
      const novoId = Math.max(...documentos.map(d => d.id)) + 1;
      const novoDoc = {
        ...doc,
        id: novoId,
        nome: `${doc.nome} (Cópia)`,
        dataCriacao: new Date().toISOString().split('T')[0],
        downloads: 0
      };
      
      setDocumentos([...documentos, novoDoc]);
      
      await registrarCadastro(
        usuario,
        'DOCUMENTOS',
        'Modelo de Grupo',
        novoId,
        {
          nome: novoDoc.nome,
          baseadoEm: doc.nome
        }
      );
      
      showSuccess(`"${doc.nome}" foi duplicado com sucesso`);
    } catch (error) {
      await registrarErro(usuario, 'DOCUMENTOS', 'Erro ao duplicar modelo', error);
      showError('Erro ao duplicar documento');
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
            'Modelo de Grupo',
            doc.id,
            {
              nome: doc.nome,
              categoria: doc.categoria
            }
          );

          showSuccess('Documento removido com sucesso');
        } catch (error) {
          await registrarErro(usuario, 'DOCUMENTOS', 'Erro ao deletar modelo', error);
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
    <Layout titulo="Modelos de Grupos">
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
      <div className="bg-gradient-to-r from-blue-100 to-cyan-100 p-6 rounded-lg mb-6 border-2 border-blue-200">
        <div className="flex items-center gap-4">
          <FontAwesomeIcon icon={faUsers} className="text-5xl text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-blue-800">Modelos de Grupos</h2>
            <p className="text-sm text-blue-700">
              Templates e documentos padrão para lideranças e grupos utilizarem
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
            placeholder="🔍 Buscar modelos, categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {usuario?.nivel === 'ADMINISTRADOR' && (
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold 
                           flex items-center gap-2 transition-colors">
            <FontAwesomeIcon icon={faPlus} />
            Novo Modelo
          </button>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{documentosFiltrados.length}</div>
          <div className="text-sm text-gray-600">Modelos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{Object.keys(categorias).length}</div>
          <div className="text-sm text-gray-600">Categorias</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-2xl font-bold text-orange-600">
            {documentosFiltrados.reduce((acc, doc) => acc + doc.downloads, 0)}
          </div>
          <div className="text-sm text-gray-600">Downloads</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">v2.1</div>
          <div className="text-sm text-gray-600">Versão Média</div>
        </div>
      </div>

      {/* Modelos organizados por categoria */}
      {documentosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FontAwesomeIcon icon={faUsers} className="text-4xl text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">Nenhum modelo encontrado</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Limpar filtro
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categorias).map(([categoria, docs]) => (
            <div key={categoria}>
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-gray-200 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                {categoria}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map(doc => (
                  <div key={doc.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon 
                            icon={getIconeArquivo(doc.tipo)} 
                            className={`text-2xl ${getCoreArquivo(doc.tipo)}`}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-800 line-clamp-1">{doc.nome}</h4>
                            <p className="text-xs text-gray-500">{doc.arquivo}</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap ml-2">
                          v{doc.versao}
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-4">
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.descricao}</p>

                      {/* Metadados */}
                      <div className="space-y-1 text-xs text-gray-500 mb-4">
                        <div className="flex items-center justify-between">
                          <span>Tamanho:</span>
                          <strong>{doc.tamanho}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Downloads:</span>
                          <strong className="text-blue-600">{doc.downloads}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <strong className="text-green-600">{doc.status}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="px-4 pb-4 border-t border-gray-100 space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                          <FontAwesomeIcon icon={faDownload} />
                          Baixar
                        </button>
                        <button
                          onClick={() => handleDuplicar(doc)}
                          className="px-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold
                                   flex items-center justify-center gap-2 transition-colors text-sm"
                          title="Duplicar este modelo"
                        >
                          <FontAwesomeIcon icon={faCopy} />
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
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
