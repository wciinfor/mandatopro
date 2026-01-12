import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faUserTie, faPhone, faEnvelope, faIdCard, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { gerarPDFResponsaveis, gerarExcelResponsaveis } from '@/utils/relatorios';

export default function GerenciarResponsaveis() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [responsaveis, setResponsaveis] = useState([
    {
      id: 1,
      codigo: 1,
      nome: 'Dr. João Silva',
      cargo: 'Secretário de Saúde',
      orgao: 'SECRETARIA MUNICIPAL DE SAÚDE',
      cpf: '123.456.789-00',
      telefone: '(91) 99999-8888',
      email: 'joao.silva@prefeitura.gov.br',
      whatsapp: '(91) 99999-8888',
      observacoes: 'Responsável principal pelas emendas de saúde',
      status: 'ATIVO'
    },
    {
      id: 2,
      codigo: 2,
      nome: 'Profª Maria Santos',
      cargo: 'Secretária de Educação',
      orgao: 'SECRETARIA ESTADUAL DE EDUCAÇÃO',
      cpf: '987.654.321-00',
      telefone: '(91) 98888-7777',
      email: 'maria.santos@seduc.pa.gov.br',
      whatsapp: '(91) 98888-7777',
      observacoes: 'Coordena projetos educacionais',
      status: 'ATIVO'
    },
    {
      id: 3,
      codigo: 3,
      nome: 'Eng. Carlos Oliveira',
      cargo: 'Diretor de Infraestrutura',
      orgao: 'SECRETARIA MUNICIPAL DE OBRAS',
      cpf: '456.789.123-00',
      telefone: '(91) 97777-6666',
      email: 'carlos.oliveira@obras.gov.br',
      whatsapp: '(91) 97777-6666',
      observacoes: 'Responsável por emendas de infraestrutura',
      status: 'ATIVO'
    }
  ]);

  const [filtro, setFiltro] = useState('');
  const [orgaoFiltro, setOrgaoFiltro] = useState('TODOS');
  const [situacao, setSituacao] = useState('ATIVO');

  const responsaveisFiltrados = responsaveis.filter(resp => {
    const matchFiltro = filtro === '' || 
      resp.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      resp.cargo.toLowerCase().includes(filtro.toLowerCase()) ||
      resp.email.toLowerCase().includes(filtro.toLowerCase());
    const matchOrgao = orgaoFiltro === 'TODOS' || resp.orgao === orgaoFiltro;
    const matchSituacao = resp.status === situacao;
    return matchFiltro && matchOrgao && matchSituacao;
  });

  const handleInserir = () => {
    router.push('/emendas/responsaveis/novo');
  };

  const handleEditar = (id) => {
    router.push(`/emendas/responsaveis/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este responsável?', () => {
      setResponsaveis(responsaveis.filter(r => r.id !== id));
      showSuccess('Responsável excluído com sucesso!');
    });
  };

  const handleGerarRelatorio = (formato) => {
    try {
      if (formato === 'PDF') {
        gerarPDFResponsaveis(responsaveis, responsaveisFiltrados);
        showSuccess('Relatório PDF gerado com sucesso!');
      } else if (formato === 'Excel') {
        gerarExcelResponsaveis(responsaveis, responsaveisFiltrados);
        showSuccess('Relatório Excel gerado com sucesso!');
      }
    } catch (error) {
      showError('Erro ao gerar relatório: ' + error.message);
    }
  };

  return (
    <Layout titulo="Gerenciar Responsáveis">
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faList} className="text-teal-600 text-2xl" />
            <h2 className="text-2xl font-bold text-gray-800">Lista de Responsáveis</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleGerarRelatorio('PDF')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              title="Exportar PDF"
            >
              <FontAwesomeIcon icon={faFilePdf} />
              <span className="hidden md:inline">PDF</span>
            </button>
            <button
              onClick={() => handleGerarRelatorio('Excel')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              title="Exportar Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              <span className="hidden md:inline">Excel</span>
            </button>
            <button
              onClick={handleInserir}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Novo</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nome, cargo ou e-mail..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Órgão
            </label>
            <select
              value={orgaoFiltro}
              onChange={(e) => setOrgaoFiltro(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="TODOS">Todos os Órgãos</option>
              <option value="SECRETARIA MUNICIPAL DE SAÚDE">Sec. Municipal de Saúde</option>
              <option value="SECRETARIA ESTADUAL DE EDUCAÇÃO">Sec. Estadual de Educação</option>
              <option value="SECRETARIA MUNICIPAL DE OBRAS">Sec. Municipal de Obras</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Situação
            </label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Órgão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {responsaveisFiltrados.map((resp) => (
                <tr key={resp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {resp.codigo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faUserTie} className="text-teal-600 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{resp.nome}</div>
                        <div className="text-sm text-gray-500">{resp.cpf}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {resp.cargo}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {resp.orgao}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faPhone} className="text-gray-400" />
                        {resp.telefone}
                      </div>
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
                        {resp.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(resp.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        onClick={() => handleExcluir(resp.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
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

          {responsaveisFiltrados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum responsável encontrado com os filtros aplicados.
            </div>
          )}
        </div>

        {/* Rodapé com total */}
        <div className="mt-4 text-sm text-gray-600">
          Total de responsáveis: <span className="font-bold">{responsaveisFiltrados.length}</span>
        </div>
      </div>
    </Layout>
  );
}
