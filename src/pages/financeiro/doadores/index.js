import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList, faPlus, faEdit, faTrash, faUser, faPhone, faEnvelope, faMoneyBillWave, faFilePdf, faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function Doadores() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showConfirm } = useModal();
  
  const [doadores, setDoadores] = useState([
    {
      id: 1,
      codigo: 'DOAD-001',
      nome: 'João Silva Santos',
      cpf: '123.456.789-00',
      telefone: '(91) 99999-8888',
      email: 'joao.silva@email.com',
      tipo: 'PESSOA_FISICA',
      totalDoado: 15000.00,
      ultimaDoacao: '2024-11-15',
      status: 'ATIVO'
    },
    {
      id: 2,
      codigo: 'DOAD-002',
      nome: 'Maria Costa Oliveira',
      cpf: '987.654.321-00',
      telefone: '(91) 98888-7777',
      email: 'maria.costa@email.com',
      tipo: 'PESSOA_FISICA',
      totalDoado: 8000.00,
      ultimaDoacao: '2024-11-20',
      status: 'ATIVO'
    },
    {
      id: 3,
      codigo: 'DOAD-003',
      nome: 'Empresa ABC Ltda',
      cnpj: '12.345.678/0001-90',
      telefone: '(91) 3333-4444',
      email: 'contato@empresaabc.com.br',
      tipo: 'PESSOA_JURIDICA',
      totalDoado: 25000.00,
      ultimaDoacao: '2024-11-10',
      status: 'ATIVO'
    }
  ]);

  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');

  const doadoresFiltrados = doadores.filter(doador => {
    const matchFiltro = filtro === '' || 
      doador.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      (doador.cpf && doador.cpf.includes(filtro)) ||
      (doador.cnpj && doador.cnpj.includes(filtro));
    const matchTipo = tipoFiltro === 'TODOS' || doador.tipo === tipoFiltro;
    return matchFiltro && matchTipo;
  });

  const totalDoadores = doadoresFiltrados.length;
  const totalDoadoPessoaFisica = doadoresFiltrados
    .filter(d => d.tipo === 'PESSOA_FISICA')
    .reduce((acc, d) => acc + d.totalDoado, 0);
  const totalDoadoPessoaJuridica = doadoresFiltrados
    .filter(d => d.tipo === 'PESSOA_JURIDICA')
    .reduce((acc, d) => acc + d.totalDoado, 0);

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const handleInserir = () => {
    router.push('/financeiro/doadores/novo');
  };

  const handleEditar = (id) => {
    router.push(`/financeiro/doadores/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este doador?', () => {
      setDoadores(doadores.filter(d => d.id !== id));
      showSuccess('Doador excluído com sucesso!');
    });
  };

  const handleGerarRelatorio = (formato) => {
    showSuccess(`Relatório ${formato} em desenvolvimento`);
  };

  return (
    <Layout titulo="Doadores / Parceiros">
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

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Doadores</p>
              <p className="text-2xl font-bold text-blue-600">{totalDoadores}</p>
            </div>
            <FontAwesomeIcon icon={faUser} className="text-4xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pessoa Física</p>
              <p className="text-2xl font-bold text-green-600">{formatarValor(totalDoadoPessoaFisica)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pessoa Jurídica</p>
              <p className="text-2xl font-bold text-purple-600">{formatarValor(totalDoadoPessoaJuridica)}</p>
            </div>
            <FontAwesomeIcon icon={faMoneyBillWave} className="text-4xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleInserir}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="hidden md:inline">Novo Doador</span>
          </button>
          <button
            onClick={() => handleGerarRelatorio('PDF')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FontAwesomeIcon icon={faFilePdf} />
            <span className="hidden md:inline">PDF</span>
          </button>
          <button
            onClick={() => handleGerarRelatorio('Excel')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FontAwesomeIcon icon={faFileExcel} />
            <span className="hidden md:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Nome, CPF, CNPJ..."
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
              <option value="PESSOA_FISICA">Pessoa Física</option>
              <option value="PESSOA_JURIDICA">Pessoa Jurídica</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF/CNPJ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Doado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Doação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {doadoresFiltrados.map((doador) => (
                <tr key={doador.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {doador.codigo}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <FontAwesomeIcon icon={faUser} className="mr-2 text-gray-400" />
                    {doador.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      doador.tipo === 'PESSOA_FISICA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {doador.tipo === 'PESSOA_FISICA' ? 'PF' : 'PJ'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {doador.cpf || doador.cnpj}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex flex-col gap-1">
                      <div>
                        <FontAwesomeIcon icon={faPhone} className="mr-2 text-gray-400" />
                        {doador.telefone}
                      </div>
                      <div>
                        <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-gray-400" />
                        {doador.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {formatarValor(doador.totalDoado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatarData(doador.ultimaDoacao)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditar(doador.id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Editar"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      onClick={() => handleExcluir(doador.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {doadoresFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum doador encontrado
          </div>
        )}
      </div>
    </Layout>
  );
}
