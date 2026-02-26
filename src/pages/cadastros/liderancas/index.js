import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { obterLiderancas } from '@/services/liderancaService';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faIdCard
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarLiderancas() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [liderancas, setLiderancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('ATIVO');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  const liderancasFiltradas = liderancas.filter(lid => {
    const nome = (lid.nome || lid.nomeSocial || '').toLowerCase();
    const cpf = lid.cpf || '';
    const telefone = lid.telefone || '';
    const areaAtuacao = (lid.areaAtuacao || '').toLowerCase();
    const matchFiltro = filtro === '' || 
      nome.includes(filtro.toLowerCase()) ||
      cpf.includes(filtro) ||
      telefone.includes(filtro) ||
      areaAtuacao.includes(filtro.toLowerCase());
    const matchSituacao = situacao === 'ATIVO' ? lid.status === 'ATIVO' : lid.status !== 'ATIVO';
    return matchFiltro && matchSituacao;
  });

  const totalPaginas = Math.ceil(liderancasFiltradas.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const liderancasPaginadas = liderancasFiltradas.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/liderancas/novo');
  };

  const carregarLiderancas = async () => {
    setCarregando(true);
    try {
      const dados = await obterLiderancas();
      setLiderancas(dados || []);
    } catch (error) {
      showError('Erro ao carregar liderancas. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarLiderancas();
  }, []);

  const handleEditar = (id) => {
    router.push(`/cadastros/liderancas/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir esta liderança?', () => {
      setLiderancas(liderancas.filter(l => l.id !== id));
      showSuccess('Liderança excluída com sucesso!');
    });
  };

  const handleGerarCracha = (lideranca) => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.gerarCrachaLideranca(lideranca);
    showSuccess('Crachá gerado com sucesso!');
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE LIDERANÇAS');
    
    const tableData = liderancasFiltradas.map(lid => [
      lid.id,
      lid.nome || lid.nomeSocial,
      lid.cpf,
      lid.telefone,
      lid.influencia || '-',
      lid.areaAtuacao || '-',
      lid.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'CPF', 'Telefone', 'Influência', 'Área de Atuação', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-liderancas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (lideranca) => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('FICHA DE LIDERANÇA');
    
    let yPos = 60;
    pdfGen.doc.setFontSize(12);
    pdfGen.doc.text(`Código: ${lideranca.id}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Nome: ${lideranca.nome || lideranca.nomeSocial}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`CPF: ${lideranca.cpf}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Telefone: ${lideranca.telefone || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Influência: ${lideranca.influencia || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Área de Atuação: ${lideranca.areaAtuacao || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Status: ${lideranca.status}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
    
    pdfGen.addFooter();
    pdfGen.doc.save(`ficha-lideranca-${lideranca.codigo}.pdf`);
  };

  return (
    <Layout titulo="Gerenciar Lideranças">
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
                BUSCAR POR NOME, CPF, TELEFONE...
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
              <h2 className="text-lg font-bold text-gray-700">Listagem de Lideranças</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-bold text-lg text-teal-600">{liderancasFiltradas.length}</span>
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
            {carregando && (
              <div className="py-6 text-center text-gray-500">Carregando liderancas...</div>
            )}
            {!carregando && liderancasFiltradas.length === 0 && (
              <div className="py-6 text-center text-gray-500">Nenhuma liderança encontrada.</div>
            )}
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">CPF</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Influência</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Área de Atuação</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {liderancasPaginadas.map((lideranca, idx) => {
                  const temFoto = Boolean(lideranca.foto || lideranca.fotoUrl || lideranca.imagem || lideranca.avatar);

                  return (
                  <tr key={lideranca.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                    <td className="px-4 py-3 text-sm">{lideranca.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{lideranca.nome || lideranca.nomeSocial}</td>
                    <td className="px-4 py-3 text-sm">{lideranca.cpf}</td>
                    <td className="px-4 py-3 text-sm">{lideranca.telefone}</td>
                    <td className="px-4 py-3 text-sm">{lideranca.influencia || '-'}</td>
                    <td className="px-4 py-3 text-sm">{lideranca.areaAtuacao || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        lideranca.status === 'ATIVO' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {lideranca.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleImprimirFicha(lideranca)}
                          className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                          title="Imprimir ficha"
                        >
                          <FontAwesomeIcon icon={faPrint} />
                        </button>
                        <button
                          onClick={() => temFoto && handleGerarCracha(lideranca)}
                          disabled={!temFoto}
                          className={`p-2 rounded-lg transition ${temFoto ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-purple-300 text-white cursor-not-allowed opacity-60'}`}
                          title={temFoto ? 'Gerar crachá' : 'Adicionar foto para gerar crachá'}
                        >
                          <FontAwesomeIcon icon={faIdCard} />
                        </button>
                        <button
                          onClick={() => handleEditar(lideranca.id)}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="Editar"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          onClick={() => handleExcluir(lideranca.id)}
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
