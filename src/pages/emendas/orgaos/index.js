import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faBuilding, faPhone, faEnvelope, faMapMarked, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { gerarPDFOrgaos, gerarExcelOrgaos } from '@/utils/relatorios';

export default function GerenciarOrgaos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [orgaos, setOrgaos] = useState([
    {
      id: 1,
      codigo: 1,
      nome: 'SECRETARIA MUNICIPAL DE SAÚDE',
      tipo: 'MUNICIPAL',
      cnpj: '12.345.678/0001-90',
      endereco: 'Av. Principal, 1000',
      municipio: 'Belém',
      uf: 'PA',
      telefone: '(91) 3333-4444',
      email: 'saude@prefeitura.gov.br',
      responsavel: 'Dr. João Silva',
      contato: '(91) 99999-8888',
      observacoes: 'Órgão principal para emendas de saúde',
      status: 'ATIVO'
    },
    {
      id: 2,
      codigo: 2,
      nome: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
      tipo: 'ESTADUAL',
      cnpj: '98.765.432/0001-10',
      endereco: 'Rua das Flores, 500',
      municipio: 'Belém',
      uf: 'PA',
      telefone: '(91) 3322-1100',
      email: 'educacao@seduc.pa.gov.br',
      responsavel: 'Profª Maria Santos',
      contato: '(91) 98888-7777',
      observacoes: 'Emendas para educação estadual',
      status: 'ATIVO'
    }
  ]);

  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [situacao, setSituacao] = useState('ATIVO');

  const orgaosFiltrados = orgaos.filter(org => {
    const matchFiltro = filtro === '' || 
      org.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      org.cnpj.includes(filtro) ||
      org.municipio.toLowerCase().includes(filtro.toLowerCase());
    const matchTipo = tipoFiltro === 'TODOS' || org.tipo === tipoFiltro;
    const matchSituacao = org.status === situacao;
    return matchFiltro && matchTipo && matchSituacao;
  });

  const handleInserir = () => {
    router.push('/emendas/orgaos/novo');
  };

  const handleEditar = (id) => {
    router.push(`/emendas/orgaos/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este órgão?', () => {
      setOrgaos(orgaos.filter(o => o.id !== id));
      showSuccess('Órgão excluído com sucesso!');
    });
  };

  const handleGerarRelatorio = (formato) => {
    try {
      if (formato === 'PDF') {
        gerarPDFOrgaos(orgaos, orgaosFiltrados);
        showSuccess('Relatório PDF gerado com sucesso!');
      } else if (formato === 'Excel') {
        gerarExcelOrgaos(orgaos, orgaosFiltrados);
        showSuccess('Relatório Excel gerado com sucesso!');
      }
    } catch (error) {
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  return (
    <Layout titulo="Gerenciar Órgãos">
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

      {/* Botões de Ação */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.location.href = '/emendas/orgaos'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <FontAwesomeIcon icon={faList} />
            Listar
          </button>
          <button
            onClick={handleInserir}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <FontAwesomeIcon icon={faPlus} />
            Inserir Novo Órgão
          </button>
          <button
            onClick={() => handleGerarRelatorio('PDF')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            title="Exportar PDF"
          >
            <FontAwesomeIcon icon={faFilePdf} />
            Relatório PDF
          </button>
          <button
            onClick={() => handleGerarRelatorio('Excel')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
            title="Exportar Excel"
          >
            <FontAwesomeIcon icon={faFileExcel} />
            Relatório Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Nome, CNPJ, município..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TODOS">Todos</option>
                  <option value="FEDERAL">Federal</option>
                  <option value="ESTADUAL">Estadual</option>
                  <option value="MUNICIPAL">Municipal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>

              <div className="flex items-end">
                <span className="text-sm font-semibold text-gray-700">
                  Total: {orgaosFiltrados.length} órgão(s)
                </span>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-100 border-b-2 border-blue-300">
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Cód</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Nome do Órgão</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">CNPJ</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Município/UF</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Responsável</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {orgaosFiltrados.map((orgao, idx) => (
                    <tr key={orgao.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm">{orgao.codigo}</td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
                          {orgao.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          orgao.tipo === 'FEDERAL' ? 'bg-purple-100 text-purple-800' :
                          orgao.tipo === 'ESTADUAL' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {orgao.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{orgao.cnpj}</td>
                      <td className="px-4 py-3 text-sm">{orgao.municipio}/{orgao.uf}</td>
                      <td className="px-4 py-3 text-sm">{orgao.responsavel}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          orgao.status === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {orgao.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditar(orgao.id)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(orgao.id)}
                            className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                            title="Excluir"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
    </Layout>
  );
}
