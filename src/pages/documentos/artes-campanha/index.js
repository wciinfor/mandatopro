import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette, faDownload, faEye, faTrash, faEdit, faArrowLeft, faPlus,
  faFilePdf, faFileWord, faImage, faMusic, faFile, faFilter,
  faUpload, faCheckCircle, faTimes
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

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!formUpload.arquivo) { showError('Selecione um arquivo para upload'); return; }
    if (!formUpload.nome.trim()) { showError('Informe o nome do documento'); return; }
    setUploading(true);
    try {
      const base64 = await fileToBase64(formUpload.arquivo);
      const response = await fetch('/api/documentos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(usuario) },
        body: JSON.stringify({
          nome: formUpload.nome.trim(),
          descricao: formUpload.descricao.trim(),
          categoria: 'artes',
          arquivo_base64: base64,
          arquivo_nome: formUpload.arquivo.name,
          mime_type: formUpload.arquivo.type,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setDocumentos((prev) => [result.data, ...prev]);
      setShowModalUpload(false);
      setFormUpload({ nome: '', descricao: '', arquivo: null });
      showSuccess('Arte enviada com sucesso!');
    } catch (error) {
      showError('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

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
          <button
            onClick={() => setShowModalUpload(true)}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold 
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

      {/* Modal de Upload */}
      {showModalUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Nova Arte de Campanha</h3>
              <button
                onClick={() => { setShowModalUpload(false); setFormUpload({ nome: '', descricao: '', arquivo: null }); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
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
                    dragOver ? 'border-pink-400 bg-pink-50' : formUpload.arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-pink-300 hover:bg-pink-50'
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
                      <p className="text-gray-400 text-sm mt-1">PDF, PSD, PNG, JPG, AI e outros</p>
                    </div>
                  )}
                  <input ref={inputRef} type="file" hidden onChange={handleFileSelect} />
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModalUpload(false); setFormUpload({ nome: '', descricao: '', arquivo: null }); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
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
    </Layout>
  );
}
