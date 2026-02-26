import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { createClient } from '@supabase/supabase-js';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faIdCard
} from '@fortawesome/free-solid-svg-icons';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const modulos = [
  { nome: 'Dashboard', icone: faPlus, submenu: [] },
  {
    nome: 'Cadastros',
    icone: faList,
    submenu: ['Eleitores', 'Lideranças', 'Funcionários', 'Atendimentos']
  }
];

export default function GerenciarFuncionarios() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('ATIVO');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  // Carregar funcionários do Supabase
  useEffect(() => {
    carregarFuncionarios();
  }, []);

  const carregarFuncionarios = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select(`
          id,
          eleitor_id,
          cargo,
          departamento,
          dataAdmissao,
          salario,
          matricula,
          status,
          observacoes,
          eleitores:eleitor_id (
            id,
            nome,
            cpf,
            email,
            telefone
          )
        `)
        .order('id', { ascending: false });

      if (error) throw error;

      // Mapear dados para estrutura esperada
      const funcionariosFormatados = (data || []).map(func => ({
        id: func.id,
        eleitor_id: func.eleitor_id,
        nome: func.eleitores?.nome || '',
        cpf: func.eleitores?.cpf || '',
        email: func.eleitores?.email || '',
        telefone: func.eleitores?.telefone || '',
        cargo: func.cargo || '',
        departamento: func.departamento || '',
        data_admissao: func.dataAdmissao || '',
        salario: func.salario || '',
        matricula: func.matricula || '',
        status: func.status || 'ATIVO',
        observacoes: func.observacoes || ''
      }));

      setFuncionarios(funcionariosFormatados);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      showError('Erro ao carregar funcionários');
    } finally {
      setCarregando(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    router.push('/login');
  };

  const funcionariosFiltrados = funcionarios.filter(func => {
    const matchFiltro = filtro === '' || 
      func.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      func.cpf.includes(filtro) ||
      func.cargo.toLowerCase().includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'ATIVO' ? func.status === 'ATIVO' : func.status !== 'ATIVO';
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(funcionariosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const funcionariosPaginados = funcionariosFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/funcionarios/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/funcionarios/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este funcionário?', async () => {
      try {
        const { error } = await supabase
          .from('funcionarios')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setFuncionarios(funcionarios.filter(f => f.id !== id));
        showSuccess('Funcionário excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir:', error);
        showError('Erro ao excluir funcionário');
      }
    });
  };

  const handleGerarCracha = (funcionario) => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.gerarCrachaFuncionario(funcionario);
    showSuccess('Crachá gerado com sucesso!');
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE FUNCIONÁRIOS');
    
    const tableData = funcionariosFiltrados.map(func => [
      func.codigo,
      func.nome,
      func.cpf,
      func.cargo,
      func.departamento,
      func.telefone,
      func.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'CPF', 'Cargo', 'Departamento', 'Telefone', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-funcionarios-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (funcionario) => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('FICHA DE FUNCIONÁRIO');
    
    let yPos = 60;
    pdfGen.doc.setFontSize(12);
    pdfGen.doc.text(`Código: ${funcionario.codigo}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Nome: ${funcionario.nome}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`CPF: ${funcionario.cpf}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Cargo: ${funcionario.cargo}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Departamento: ${funcionario.departamento}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Telefone: ${funcionario.telefone}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Status: ${funcionario.status}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
    
    pdfGen.addFooter();
    pdfGen.doc.save(`ficha-funcionario-${funcionario.codigo}.pdf`);
  };

  return (
    <Layout titulo="Gerenciar Funcionários">
      <div className="max-w-7xl mx-auto">
        {/* Modal */}
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
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={handleInserir}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              <FontAwesomeIcon icon={faPlus} />
              Inserir
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-lg" />
            <h2 className="text-lg font-bold text-gray-700">Filtros de Busca</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BUSCAR POR NOME, CPF, CARGO...
              </label>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Digite sua busca..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SITUAÇÃO
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>
            <button
              onClick={() => setFiltro('')}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium"
            >
              LIMPAR FILTROS
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} className="text-teal-600 text-lg" />
              <h2 className="text-lg font-bold text-gray-700">Listagem de Funcionários</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-bold text-lg text-teal-600">{funcionariosFiltrados.length}</span>
              </div>
              <button
                onClick={handleImprimirListagem}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPrint} />
                IMPRIMIR
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">CPF</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Cargo</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Departamento</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {funcionariosPaginados.map((funcionario, idx) => {
                  const temFoto = false;
                  return (
                  <tr key={funcionario.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                    <td className="px-4 py-3 text-sm">{funcionario.matricula || funcionario.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{funcionario.nome}</td>
                    <td className="px-4 py-3 text-sm">{funcionario.cpf}</td>
                    <td className="px-4 py-3 text-sm">{funcionario.cargo}</td>
                    <td className="px-4 py-3 text-sm">{funcionario.departamento}</td>
                    <td className="px-4 py-3 text-sm">{funcionario.telefone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        funcionario.status === 'ATIVO' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {funcionario.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleImprimirFicha(funcionario)}
                          className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                          title="Imprimir ficha"
                        >
                          <FontAwesomeIcon icon={faPrint} />
                        </button>
                        <button
                          onClick={() => temFoto && handleGerarCracha(funcionario)}
                          disabled={!temFoto}
                          className={`p-2 rounded-lg transition ${temFoto ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-purple-300 text-white cursor-not-allowed opacity-60'}`}
                          title={temFoto ? 'Gerar crachá' : 'Adicionar foto para gerar crachá'}
                        >
                          <FontAwesomeIcon icon={faIdCard} />
                        </button>
                        <button
                          onClick={() => handleEditar(funcionario.id)}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="Editar"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() => handleExcluir(funcionario.id)}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          title="Excluir"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Página <span className="font-bold">{paginaAtual}</span> de <span className="font-bold">{totalPaginas || 1}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Primeira página"
              >
                <FontAwesomeIcon icon={faAngleDoubleLeft} />
              </button>
              <button
                onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                disabled={paginaAtual === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Página anterior"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span className="px-4 py-2 bg-teal-100 rounded-lg font-semibold text-teal-700">{paginaAtual}</span>
              <button
                onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                disabled={paginaAtual === totalPaginas}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Próxima página"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
              <button
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Última página"
              >
                <FontAwesomeIcon icon={faAngleDoubleRight} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
