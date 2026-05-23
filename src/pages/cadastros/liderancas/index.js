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
  faAngleDoubleLeft, faAngleDoubleRight, faIdCard, faFileDownload, faArrowUp, faArrowDown, faSort
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarLiderancas() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [liderancas, setLiderancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [filtro, setFiltro] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);
  const [contagemCadastros, setContagemCadastros] = useState({});
  const [colunhaOrdenacao, setColunhaOrdenacao] = useState('');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState('desc');

  const areasUnicas = [...new Set(liderancas
    .map(lid => lid.areaAtuacao || lid.area_atuacao)
    .filter(area => area)
    .sort())]
    .filter(Boolean);

  const liderancasFiltradas = liderancas.filter(lid => {
    const nome = (lid.nome || lid.nomeSocial || '').toLowerCase();
    const rg = lid.rg || '';
    const telefone = lid.telefone || '';
    const areaAtuacao = (lid.areaAtuacao || lid.area_atuacao || '').toLowerCase();
    const matchFiltro = filtro === '' || 
      nome.includes(filtro.toLowerCase()) ||
      rg.includes(filtro) ||
      telefone.includes(filtro) ||
      areaAtuacao.includes(filtro.toLowerCase());
    const matchArea = filtroArea === '' || areaAtuacao === filtroArea.toLowerCase();
    return matchFiltro && matchArea;
  }).sort((a, b) => {
    // Se nenhuma coluna selecionada, retorna sem ordenação
    if (!colunhaOrdenacao) return 0;

    let valorA = 0;
    let valorB = 0;

    if (colunhaOrdenacao === 'nome') {
      const nomeA = (a.nome || a.nomeSocial || '').toLowerCase();
      const nomeB = (b.nome || b.nomeSocial || '').toLowerCase();
      if (direcaoOrdenacao === 'desc') {
        return nomeB.localeCompare(nomeA, 'pt-BR');
      } else {
        return nomeA.localeCompare(nomeB, 'pt-BR');
      }
    } else if (colunhaOrdenacao === 'projecao') {
      valorA = a.projecao_votos || a.projecaoVotos || 0;
      valorB = b.projecao_votos || b.projecaoVotos || 0;
    } else if (colunhaOrdenacao === 'cadastros') {
      valorA = contagemCadastros[a.id] || 0;
      valorB = contagemCadastros[b.id] || 0;
    } else if (colunhaOrdenacao === 'percentual') {
      const projecaoA = a.projecao_votos || a.projecaoVotos || 0;
      const cadastrosA = contagemCadastros[a.id] || 0;
      valorA = projecaoA > 0 ? (cadastrosA / projecaoA) * 100 : 0;

      const projecaoB = b.projecao_votos || b.projecaoVotos || 0;
      const cadastrosB = contagemCadastros[b.id] || 0;
      valorB = projecaoB > 0 ? (cadastrosB / projecaoB) * 100 : 0;
    }

    if (colunhaOrdenacao !== 'nome') {
      if (direcaoOrdenacao === 'desc') {
        return valorB - valorA;
      } else {
        return valorA - valorB;
      }
    }
    return 0;
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
    setErroCarregamento('');
    try {
      const dados = await obterLiderancas();
      setLiderancas(dados || []);
      
      // Carregar contagem de cadastros para cada liderança
      carregarContagemCadastros(dados || []);
    } catch (error) {
      const mensagem = error?.message || 'Erro ao carregar liderancas. Tente novamente.';
      setErroCarregamento(mensagem);
      showError(mensagem);
      if (mensagem.toLowerCase().includes('sessao expirada')) {
        router.push('/login');
      }
    } finally {
      setCarregando(false);
    }
  };

  const carregarContagemCadastros = async (liderancasList) => {
    try {
      const contagem = {};
      for (const lid of liderancasList) {
        const response = await fetch(`/api/cadastros/eleitores?lideranca_id=${lid.id}&limit=1`);
        if (response.ok) {
          const dados = await response.json();
          // Usar total de registros se disponível, senão contar
          contagem[lid.id] = dados.total || dados.data?.length || 0;
        } else {
          contagem[lid.id] = 0;
        }
      }
      setContagemCadastros(contagem);
    } catch (error) {
      console.error('Erro ao carregar contagem de cadastros:', error);
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
    
    const tableData = liderancasFiltradas.map(lid => {
      const projecao = lid.projecao_votos || lid.projecaoVotos || 0;
      const cadastros = contagemCadastros[lid.id] || 0;
      const percentual = projecao > 0 ? ((cadastros / projecao) * 100).toFixed(1) : 0;
      
      return [
        lid.id,
        lid.nome || lid.nomeSocial,
        lid.telefone,
        lid.areaAtuacao || '-',
        projecao,
        cadastros,
        `${percentual}%`
      ];
    });
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'Telefone', 'Área de Atuação', 'Projeção de Votos', 'Cadastros', 'Percentual']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-liderancas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportarCSV = () => {
    if (liderancasFiltradas.length === 0) {
      showError('Nenhuma liderança para exportar.');
      return;
    }

    // Preparar dados do CSV
    const headers = ['Nome', 'Telefone'];
    const rows = liderancasFiltradas.map(lid => [
      `"${(lid.nome || lid.nomeSocial || '').replace(/"/g, '""')}"`,
      `"${(lid.telefone || '').replace(/"/g, '""')}"`
    ]);

    // Montar conteúdo do CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Criar blob e fazer download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `liderancas-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('CSV exportado com sucesso!');
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
    pdfGen.doc.text(`Telefone: ${lideranca.telefone || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Influência: ${lideranca.influencia || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Área de Atuação: ${lideranca.areaAtuacao || '-'}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Projeção de Votos: ${lideranca.projecao_votos || lideranca.projecaoVotos || 0}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Total de Cadastros: ${contagemCadastros[lideranca.id] || 0}`, 20, yPos);
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
                BUSCAR POR NOME, RG, TELEFONE...
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
                AREA DE ATUACAO
              </label>
              <select
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todas as areas</option>
                {areasUnicas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setFiltro('');
                setFiltroArea('');
              }}
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
              <button
                onClick={handleExportarCSV}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFileDownload} />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {erroCarregamento && !carregando && (
              <div className="py-4 text-center text-red-600">{erroCarregamento}</div>
            )}
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
                  <th 
                    className={`px-4 py-3 text-left text-sm font-bold cursor-pointer transition ${
                      colunhaOrdenacao === 'nome' 
                        ? 'bg-teal-100 text-teal-700' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      if (colunhaOrdenacao === 'nome') {
                        setDirecaoOrdenacao(direcaoOrdenacao === 'desc' ? 'asc' : 'desc');
                      } else {
                        setColunhaOrdenacao('nome');
                        setDirecaoOrdenacao('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Nome
                      {colunhaOrdenacao === 'nome' ? (
                        <FontAwesomeIcon icon={direcaoOrdenacao === 'desc' ? faArrowDown : faArrowUp} className="text-teal-600" />
                      ) : (
                        <FontAwesomeIcon icon={faSort} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Área de Atuação</th>
                  <th 
                    className={`px-4 py-3 text-center text-sm font-bold cursor-pointer transition ${
                      colunhaOrdenacao === 'projecao' 
                        ? 'bg-teal-100 text-teal-700' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      if (colunhaOrdenacao === 'projecao') {
                        setDirecaoOrdenacao(direcaoOrdenacao === 'desc' ? 'asc' : 'desc');
                      } else {
                        setColunhaOrdenacao('projecao');
                        setDirecaoOrdenacao('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Projeção de Votos
                      {colunhaOrdenacao === 'projecao' ? (
                        <FontAwesomeIcon icon={direcaoOrdenacao === 'desc' ? faArrowDown : faArrowUp} className="text-teal-600" />
                      ) : (
                        <FontAwesomeIcon icon={faSort} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-center text-sm font-bold cursor-pointer transition ${
                      colunhaOrdenacao === 'cadastros' 
                        ? 'bg-teal-100 text-teal-700' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      if (colunhaOrdenacao === 'cadastros') {
                        setDirecaoOrdenacao(direcaoOrdenacao === 'desc' ? 'asc' : 'desc');
                      } else {
                        setColunhaOrdenacao('cadastros');
                        setDirecaoOrdenacao('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Cadastros
                      {colunhaOrdenacao === 'cadastros' ? (
                        <FontAwesomeIcon icon={direcaoOrdenacao === 'desc' ? faArrowDown : faArrowUp} className="text-teal-600" />
                      ) : (
                        <FontAwesomeIcon icon={faSort} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3 text-center text-sm font-bold cursor-pointer transition ${
                      colunhaOrdenacao === 'percentual' 
                        ? 'bg-teal-100 text-teal-700' 
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      if (colunhaOrdenacao === 'percentual') {
                        setDirecaoOrdenacao(direcaoOrdenacao === 'desc' ? 'asc' : 'desc');
                      } else {
                        setColunhaOrdenacao('percentual');
                        setDirecaoOrdenacao('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Percentual
                      {colunhaOrdenacao === 'percentual' ? (
                        <FontAwesomeIcon icon={direcaoOrdenacao === 'desc' ? faArrowDown : faArrowUp} className="text-teal-600" />
                      ) : (
                        <FontAwesomeIcon icon={faSort} className="text-gray-400" />
                      )}
                    </div>
                  </th>
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
                    <td className="px-4 py-3 text-sm">{lideranca.telefone}</td>
                    <td className="px-4 py-3 text-sm">{lideranca.areaAtuacao || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold text-xs">
                        {lideranca.projecao_votos || lideranca.projecaoVotos || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-semibold text-xs">
                        {contagemCadastros[lideranca.id] || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {(() => {
                        const projecao = lideranca.projecao_votos || lideranca.projecaoVotos || 0;
                        const cadastros = contagemCadastros[lideranca.id] || 0;
                        const percentual = projecao > 0 ? ((cadastros / projecao) * 100).toFixed(1) : 0;
                        const corBg = percentual >= 75 ? 'bg-green-100' : percentual >= 50 ? 'bg-yellow-100' : percentual >= 25 ? 'bg-orange-100' : 'bg-red-100';
                        const corTexto = percentual >= 75 ? 'text-green-800' : percentual >= 50 ? 'text-yellow-800' : percentual >= 25 ? 'text-orange-800' : 'text-red-800';
                        return (
                          <span className={`inline-block px-3 py-1 ${corBg} ${corTexto} rounded-full font-semibold text-xs`}>
                            {percentual}%
                          </span>
                        );
                      })()}
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
