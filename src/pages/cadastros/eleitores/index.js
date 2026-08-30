import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faFileDownload, faTrophy, faMedal, faCrown,
  faUsers, faCalendarAlt, faSyncAlt, faTimes, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export default function GerenciarEleitores() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  const { mandatoAtivoId } = useAuth();
  
  const [eleitores, setEleitores] = useState([]);
  const [liderancas, setLiderancas] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [totalEleitores, setTotalEleitores] = useState(0);
  const [filtro, setFiltro] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [situacao, setSituacao] = useState('ATIVO');
  const [ordem, setOrdem] = useState('recentes');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);

  // Estados do Ranking de Cadastradores
  const [rankingAberto, setRankingAberto] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingPeriodo, setRankingPeriodo] = useState('hoje');
  const [rankingData, setRankingData] = useState({
    resumo: { totalEleitores: 0, totalComCadastrador: 0, totalSemCadastrador: 0, totalCadastradoresAtivos: 0 },
    cadastradores: []
  });

  const normalizarCidadeKey = (valor = '') =>
    String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const liderancasFiltradas = liderancas.filter((l) => {
    if (!filtroCidade) return true;
    const cidadeLiderancaKey = normalizarCidadeKey(l?.municipio || '');
    return cidadeLiderancaKey === filtroCidade;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      carregarEleitores();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao, paginaAtual, filtro, filtroLideranca, filtroCidade, ordem, mandatoAtivoId]);

  useEffect(() => {
    fetch('/api/usuarios/liderancas-opcoes')
      .then(r => r.json())
      .then(json => setLiderancas(Array.isArray(json.data) ? json.data : []))
      .catch(() => setLiderancas([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      carregarCidades();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filtroLideranca) return;
    const existe = liderancasFiltradas.some((l) => String(l.id) === String(filtroLideranca));
    if (!existe) {
      setFiltroLideranca('');
      setPaginaAtual(1);
    }
  }, [filtroLideranca, liderancasFiltradas]);

  const carregarCidades = async () => {
    try {
      setLoadingCidades(true);

      const params = new URLSearchParams();
      params.set('onlyCities', 'true');
      if (mandatoAtivoId) {
        params.set('mandato_id', String(mandatoAtivoId));
      }

      const response = await fetch(`/api/cadastros/eleitores?${params.toString()}`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errorMsg = errJson?.message || errJson?.error || `Falha na requisição (HTTP ${response.status})`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const opcoes = Array.isArray(data?.data) ? data.data : [];
      setCidades(opcoes);

      if (filtroCidade && !opcoes.some((c) => c.key === filtroCidade)) {
        setFiltroCidade('');
      }
    } catch (error) {
      setCidades([]);
      const prefixo = 'Erro ao carregar cidades';
      const msg = error?.message || 'Falha inesperada';
      showError(msg.startsWith(prefixo) ? msg : `${prefixo}: ${msg}`);
    } finally {
      setLoadingCidades(false);
    }
  };

  const carregarEleitores = async () => {
    try {
      setLoading(true);

      const offset = (paginaAtual - 1) * itensPorPagina;
      const params = new URLSearchParams();
      params.set('status', situacao);
      params.set('limit', String(itensPorPagina));
      params.set('offset', String(offset));
      params.set('ordem', ordem);
      if (mandatoAtivoId) {
        params.set('mandato_id', String(mandatoAtivoId));
      }

      if (filtro && filtro.trim().length > 0) params.set('search', filtro.trim());
      if (filtroLideranca) params.set('liderancaId', filtroLideranca);

      if (filtroCidade) {
        const cidadeSelecionada = cidades.find((c) => c.key === filtroCidade);
        if (cidadeSelecionada?.values?.length) {
          cidadeSelecionada.values.forEach((value) => params.append('cidadeValues', value));
        } else {
          params.set('cidade', filtroCidade);
        }
      }

      const response = await fetch(`/api/cadastros/eleitores?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar eleitores');
      }

      const data = await response.json();
      setEleitores(data.data || []);
      setTotalEleitores(Number(data.total || 0));
    } catch (error) {
      showError('Erro ao carregar eleitores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const obterDatasPeriodo = (tipoPeriodo) => {
    const hoje = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (tipoPeriodo === 'hoje') {
      const hStr = format(hoje);
      return { inicio: hStr, fim: hStr };
    }
    if (tipoPeriodo === '7dias') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 7);
      return { inicio: format(d), fim: format(hoje) };
    }
    if (tipoPeriodo === '30dias') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - 30);
      return { inicio: format(d), fim: format(hoje) };
    }
    if (tipoPeriodo === 'mes') {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: format(inicioMes), fim: format(hoje) };
    }
    return { inicio: '', fim: '' };
  };

  const carregarRanking = async (tipoPeriodo = rankingPeriodo) => {
    try {
      setRankingLoading(true);
      const { inicio, fim } = obterDatasPeriodo(tipoPeriodo);
      const params = new URLSearchParams();
      if (mandatoAtivoId) {
        params.set('mandato_id', String(mandatoAtivoId));
      }
      if (inicio) params.set('inicio', inicio);
      if (fim) params.set('fim', fim);

      const res = await fetch(`/api/cadastros/eleitores/estatisticas-cadastradores?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Erro ao carregar ranking');
      }
      const data = await res.json();
      setRankingData(data);
    } catch (err) {
      showError('Erro ao carregar ranking de cadastradores: ' + err.message);
    } finally {
      setRankingLoading(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil((totalEleitores || 0) / itensPorPagina));
  const eleitoresPaginados = eleitores;

  const handleInserir = () => {
    router.push('/cadastros/eleitores/novo');
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/eleitores/${id}`);
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este eleitor?', async () => {
      try {
        const response = await fetch(`/api/cadastros/eleitores/${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Erro ao excluir eleitor');
        }

        setEleitores(eleitores.filter(e => e.id !== id));
        showSuccess('Eleitor excluído com sucesso!');
      } catch (error) {
        showError('Erro ao excluir: ' + error.message);
      }
    });
  };

  const handleExportarCSV = () => {
    const cabecalho = ['Nome', 'Telefone'];
    const escapar = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = eleitoresPaginados.map(el => [
      el.nome,
      el.telefone || ''
    ].map(escapar).join(','));
    const conteudo = [cabecalho.join(','), ...linhas].join('\n');
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eleitores-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE ELEITORES');
    
    const tableData = eleitoresPaginados.map(el => [
      el.codigo,
      el.nome,
      el.rg,
      el.cidade || el.municipio || '-',
      el.bairro || '-',
      el.telefone,
      el.statusCadastro || el.status
    ]);
    
    pdfGen.doc.autoTable({
      head: [['Código', 'Nome', 'RG', 'Cidade', 'Bairro', 'Telefone', 'Status']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-eleitores-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImprimirFicha = (eleitor) => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('FICHA DE ELEITOR');
    
    let yPos = 60;
    pdfGen.doc.setFontSize(12);
    pdfGen.doc.text(`Código: ${eleitor.codigo}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Nome: ${eleitor.nome}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`RG: ${eleitor.rg}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Título Eleitoral: ${eleitor.tituloEleitoral}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Situação TSE: ${eleitor.situacaoTSE || eleitor.situacao_tse || eleitor.situacaotse}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Telefone: ${eleitor.telefone}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Status: ${eleitor.statusCadastro || eleitor.status}`, 20, yPos);
    yPos += 10;
    pdfGen.doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
    
    pdfGen.addFooter();
    pdfGen.doc.save(`ficha-eleitor-${eleitor.codigo}.pdf`);
  };

  return (
    <Layout titulo="Gerenciar Eleitores">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <button
                onClick={handleInserir}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors"
              >
                <FontAwesomeIcon icon={faPlus} />
                Inserir
              </button>
            </div>
            <div>
              <button
                onClick={() => {
                  setRankingAberto(true);
                  carregarRanking('hoje');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm transition-colors text-sm"
              >
                <FontAwesomeIcon icon={faTrophy} className="text-amber-200" />
                Ranking de Cadastradores
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-lg" />
            <h2 className="text-lg font-bold text-gray-700">Filtros de Busca</h2>
          </div>
          {/* Linha 1: Busca + Situação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BUSCAR POR NOME, RG, TÍTULO...
              </label>
              <input
                type="text"
                value={filtro}
                onChange={(e) => { setFiltro(e.target.value); setPaginaAtual(1); }}
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
                onChange={(e) => { setSituacao(e.target.value); setPaginaAtual(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>
          </div>
          {/* Linha 2: Cidade + Liderança + Ordenação + Limpar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CIDADE
              </label>
              <select
                value={filtroCidade}
                onChange={(e) => {
                  setFiltroCidade(e.target.value);
                  setFiltroLideranca('');
                  setPaginaAtual(1);
                }}
                disabled={loadingCidades}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {cidades.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LIDERANÇA
              </label>
              <select
                value={filtroLideranca}
                onChange={(e) => { setFiltroLideranca(e.target.value); setPaginaAtual(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {liderancasFiltradas.map(l => (
                  <option key={l.id} value={String(l.id)}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ORDENAR POR
              </label>
              <select
                value={ordem}
                onChange={(e) => { setOrdem(e.target.value); setPaginaAtual(1); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium"
              >
                <option value="recentes">Mais Recentes (Últimos)</option>
                <option value="nome_asc">Ordem Alfabética (A - Z)</option>
                <option value="nome_desc">Ordem Alfabética (Z - A)</option>
                <option value="antigos">Mais Antigos</option>
              </select>
            </div>
            <div>
              <button
                onClick={() => { setFiltro(''); setFiltroLideranca(''); setFiltroCidade(''); setOrdem('recentes'); setPaginaAtual(1); }}
                className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium"
              >
                LIMPAR FILTROS
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} className="text-teal-600 text-lg" />
              <h2 className="text-lg font-bold text-gray-700">Listagem de Eleitores</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-bold text-lg text-teal-600">{totalEleitores}</span>
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
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                title="Exportar listagem filtrada para CSV"
              >
                <FontAwesomeIcon icon={faFileDownload} />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">RG</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Cidade</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Bairro</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                        <span className="ml-3 text-gray-600">Carregando eleitores...</span>
                      </div>
                    </td>
                  </tr>
                ) : eleitoresPaginados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      Nenhum eleitor encontrado
                    </td>
                  </tr>
                ) : (
                  eleitoresPaginados.map((eleitor, idx) => (
                    <tr key={eleitor.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                      <td className="px-4 py-3 text-sm">{eleitor.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{eleitor.nome}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.rg}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.cidade || eleitor.municipio || '-'}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.bairro || '-'}</td>
                      <td className="px-4 py-3 text-sm">{eleitor.telefone || eleitor.celular || '-'}</td>
                      <td className="px-4 py-3 text-sm flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold w-max ${
                          (eleitor.statusCadastro || eleitor.status) === 'ATIVO' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {eleitor.statusCadastro || eleitor.status || 'ATIVO'}
                        </span>
                        {eleitor.pertencimento === 'ESTADUAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 w-max" title="Estadual">
                            🏛️ Estadual
                          </span>
                        )}
                        {eleitor.pertencimento === 'FEDERAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 w-max" title="Federal">
                            🏛️ Federal
                          </span>
                        )}
                        {eleitor.pertencimento === 'AMBOS' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 w-max" title="Ambos os mandatos">
                            🏛️ Estadual + Federal
                          </span>
                        )}
                        {(!eleitor.pertencimento || eleitor.pertencimento === 'NAO_CLASSIFICADO') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 w-max" title="Não Classificado">
                            ⚠️ Não Classificado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditar(eleitor.id)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(eleitor.id)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            title="Excluir"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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

        {/* Modal de Ranking de Cadastradores */}
        {rankingAberto && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-5 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-inner">
                    🏆
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Ranking de Desempenho dos Cadastradores</h3>
                    <p className="text-xs text-amber-100 flex items-center gap-2 mt-0.5">
                      <span>Rastreabilidade de autoria ativa</span>
                      <span>•</span>
                      <span className="font-semibold px-2 py-0.5 bg-black/20 rounded-full">
                        {mandatoAtivoId === 2 ? '🏛️ Mandato Federal' : '🏛️ Mandato Estadual'}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRankingAberto(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="Fechar"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              {/* Filtros de Período & Resumo */}
              <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                  {[
                    { id: 'hoje', label: 'Hoje' },
                    { id: '7dias', label: 'Últimos 7 dias' },
                    { id: '30dias', label: 'Últimos 30 dias' },
                    { id: 'mes', label: 'Mês Atual' },
                    { id: 'todos', label: 'Geral (Todos)' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setRankingPeriodo(p.id);
                        carregarRanking(p.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        rankingPeriodo === p.id
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => carregarRanking(rankingPeriodo)}
                    disabled={rankingLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faSyncAlt} className={rankingLoading ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>
              </div>

              {/* Corpo da Listagem */}
              <div className="flex-1 overflow-y-auto p-5">
                {rankingLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-3" />
                    <p className="text-sm font-medium">Carregando métricas dos cadastradores...</p>
                  </div>
                ) : !rankingData?.cadastradores || rankingData.cadastradores.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <div className="text-4xl mb-3">📋</div>
                    <h4 className="text-base font-bold text-gray-800 mb-1">Nenhum cadastro com autoria no período</h4>
                    <p className="text-xs text-gray-600 max-w-md mx-auto">
                      A rastreabilidade está ativada. Conforme os operadores realizarem novos cadastros de eleitores no sistema, os totais e percentuais de qualidade aparecerão automaticamente aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Top 3 Destaques */}
                    {rankingData.cadastradores.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                        {rankingData.cadastradores.slice(0, 3).map((cad, idx) => {
                          const medalhas = [
                            { icon: '🥇', bg: 'from-amber-50 to-amber-100/70 border-amber-300 text-amber-900', label: '1º Lugar' },
                            { icon: '🥈', bg: 'from-slate-50 to-slate-100/70 border-slate-300 text-slate-900', label: '2º Lugar' },
                            { icon: '🥉', bg: 'from-orange-50 to-orange-100/70 border-orange-300 text-orange-900', label: '3º Lugar' }
                          ];
                          const m = medalhas[idx];
                          return (
                            <div key={cad.usuario_id} className={`p-4 rounded-xl border bg-gradient-to-br ${m.bg} shadow-sm relative overflow-hidden flex flex-col justify-between`}>
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-2xl">{m.icon}</span>
                                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 shadow-xs">
                                    {m.label}
                                  </span>
                                </div>
                                <h5 className="font-bold text-sm text-gray-900 truncate" title={cad.nome}>{cad.nome}</h5>
                                <p className="text-[11px] text-gray-600 truncate">{cad.email}</p>
                              </div>
                              <div className="mt-3 pt-3 border-t border-black/5 flex items-baseline justify-between">
                                <span className="text-xs font-medium text-gray-600">Total cadastrado:</span>
                                <span className="text-lg font-black text-gray-900">{cad.totalCadastrados}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tabela Completa */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                          <tr>
                            <th className="py-3 px-4 w-16 text-center">Posição</th>
                            <th className="py-3 px-4">Cadastrador</th>
                            <th className="py-3 px-4 text-center">Perfil</th>
                            <th className="py-3 px-4 text-center">Total</th>
                            <th className="py-3 px-4 text-center">% WhatsApp</th>
                            <th className="py-3 px-4 text-center">% CPF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {rankingData.cadastradores.map((cad, idx) => {
                            const isTop1 = idx === 0;
                            const isTop2 = idx === 1;
                            const isTop3 = idx === 2;
                            return (
                              <tr key={cad.usuario_id} className={`hover:bg-slate-50 transition ${isTop1 ? 'bg-amber-50/40 font-semibold' : ''}`}>
                                <td className="py-3 px-4 text-center">
                                  {isTop1 ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs shadow-xs">1º</span>
                                  ) : isTop2 ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-black text-xs shadow-xs">2º</span>
                                  ) : isTop3 ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs shadow-xs">3º</span>
                                  ) : (
                                    <span className="text-gray-500 font-bold">#{idx + 1}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-gray-900">{cad.nome}</div>
                                  <div className="text-[11px] text-gray-500">{cad.email}</div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    cad.nivel === 'ADMINISTRADOR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {cad.nivel}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="text-sm font-black text-gray-900 bg-slate-100 px-2.5 py-1 rounded-md">
                                    {cad.totalCadastrados}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-bold text-emerald-700">{cad.pctTelefone}%</span>
                                    <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(cad.pctTelefone, 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-bold text-blue-700">{cad.pctCpf}%</span>
                                    <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(cad.pctCpf, 100)}%` }} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Total de Cadastradores Ativos:{' '}
                  <strong className="text-gray-800">{rankingData?.resumo?.totalCadastradoresAtivos || 0}</strong>
                </span>
                <button
                  onClick={() => setRankingAberto(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
