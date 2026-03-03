import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import {
  faList, faPlus, faFilter, faPrint, faEdit, faTrash, faChevronLeft, faChevronRight, 
  faAngleDoubleLeft, faAngleDoubleRight, faEye
} from '@fortawesome/free-solid-svg-icons';

export default function GerenciarAtendimentos() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();
  
  const [atendimentos, setAtendimentos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [situacao, setSituacao] = useState('');
  const [campanhaFiltro, setCampanhaFiltro] = useState('');
  const [campanhaDataInicio, setCampanhaDataInicio] = useState('');
  const [campanhaDataFim, setCampanhaDataFim] = useState('');
  const [incluirAvulsosPeriodo, setIncluirAvulsosPeriodo] = useState(false);
  const [liderancaFiltro, setLiderancaFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoAtendimento, setHistoricoAtendimento] = useState(null);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [historicoErro, setHistoricoErro] = useState('');

  // Mapeamento de tipos para cores
  const getTipoBadgeStyle = (tipo) => {
    const estilos = {
      'ATENDIMENTO_MEDICO': { bg: 'bg-green-100', text: 'text-green-800', label: 'Atendimento Médico' },
      'ATENDIMENTO_ODONTOLOGICO': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Atendimento Odontológico' },
      'CADASTRO_BENEFICIOS': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Cadastro de Benefícios' },
      'CURSOS_PROFISSIONALIZANTES': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Cursos Profissionalizantes' },
      'DISTRIBUICAO_ALIMENTOS': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Distribuição de Alimentos' },
      'EMISSAO_DOCUMENTOS': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Emissão de Documentos' },
      'ENCAMINHAMENTO_SOCIAL': { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Encaminhamento Social' },
      'OFICINAS_CAPACITACAO': { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Oficinas de Capacitação' },
      'OFTALMOLOGISTA': { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Oftalmologista' },
      'ORIENTACAO_SAUDE': { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Orientação de Saúde' },
      'ORIENTACAO_JURIDICA': { bg: 'bg-violet-100', text: 'text-violet-800', label: 'Orientação Jurídica' },
      'OUTROS': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Outros' }
    };
    
    return estilos[tipo] || { bg: 'bg-gray-100', text: 'text-gray-800', label: tipo };
  };

  // Buscar atendimentos do Supabase
  useEffect(() => {
    carregarAtendimentos();
  }, []);

  useEffect(() => {
    carregarCampanhas();
  }, []);

  const carregarAtendimentos = async () => {
    try {
      setCarregando(true);
      const response = await fetch('/api/cadastros/atendimentos');
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setAtendimentos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar atendimentos:', error);
      setAtendimentos([]);
      showError('Erro ao carregar atendimentos do banco de dados');
    } finally {
      setCarregando(false);
    }
  };

  const carregarCampanhas = async () => {
    try {
      const response = await fetch('/api/cadastros/campanhas?limit=200');
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setCampanhas(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      setCampanhas([]);
    }
  };

  const campanhaInicioDate = campanhaDataInicio ? new Date(campanhaDataInicio) : null;
  const campanhaFimDate = campanhaDataFim ? new Date(campanhaDataFim) : null;
  const campanhasPorPeriodo = campanhas.filter((campanha) => {
    if (!campanha?.data_campanha) return false;
    const dataCampanha = new Date(campanha.data_campanha);
    if (Number.isNaN(dataCampanha.getTime())) return false;
    const matchInicio = !campanhaInicioDate || dataCampanha >= campanhaInicioDate;
    const matchFim = !campanhaFimDate || dataCampanha <= campanhaFimDate;
    return matchInicio && matchFim;
  });
  const campanhaIdsPeriodo = new Set(campanhasPorPeriodo.map((campanha) => campanha.id));

  const campanhasParaFiltro = (campanhaInicioDate || campanhaFimDate) ? campanhasPorPeriodo : campanhas;
  const periodoAtivo = Boolean(campanhaInicioDate || campanhaFimDate);
  const liderancasParaFiltro = campanhasParaFiltro
    .flatMap((campanha) => campanha.campanhas_liderancas || [])
    .map((item) => ({
      id: String(item.liderancas?.id || item.lideranca_id || ''),
      nome: item.liderancas?.nome || ''
    }))
    .filter((item) => item.id && item.nome);
  const liderancasUnicas = Array.from(
    new Map(liderancasParaFiltro.map((lideranca) => [lideranca.id, lideranca])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));
  const campanhaIdsPorLideranca = new Set(
    campanhasParaFiltro
      .filter((campanha) =>
        (campanha.campanhas_liderancas || []).some((item) =>
          String(item.liderancas?.id || item.lideranca_id || '') === liderancaFiltro
        )
      )
      .map((campanha) => campanha.id)
  );

  const atendimentosFiltrados = atendimentos.filter(at => {
    const matchFiltro = filtro === '' || 
      (at.eleitores?.nome?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
      (at.eleitores?.cpf || '').includes(filtro) ||
      (at.tipo_atendimento?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
      (at.protocolo?.toLowerCase() || '').includes(filtro.toLowerCase()) ||
      (at.campanhas?.nome?.toLowerCase() || '').includes(filtro.toLowerCase());
    const matchSituacao = situacao === '' || at.status === situacao;
    const matchCampanha = campanhaFiltro === '' ||
      (campanhaFiltro === 'AVULSO' ? !at.campanha_id : at.campanha_id === campanhaFiltro);
    const matchLideranca = liderancaFiltro === '' || campanhaIdsPorLideranca.has(at.campanha_id);
    const inicio = campanhaDataInicio ? new Date(campanhaDataInicio) : null;
    const fim = campanhaDataFim ? new Date(campanhaDataFim) : null;
    const temPeriodo = Boolean(inicio || fim);
    const matchPeriodo = !temPeriodo || campanhaIdsPeriodo.has(at.campanha_id) || (incluirAvulsosPeriodo && !at.campanha_id);
    return matchFiltro && matchSituacao && matchCampanha && matchLideranca && matchPeriodo;
  });

  const totalPaginas = Math.ceil(atendimentosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const atendimentosPaginados = atendimentosFiltrados.slice(indiceInicio, indiceFim);

  const handleInserir = () => {
    router.push('/cadastros/atendimentos/novo');
  };

  const handleVisualizar = (id) => {
    router.push(`/cadastros/atendimentos/${id}`);
  };

  const handleEditar = (id) => {
    router.push(`/cadastros/atendimentos/${id}`);
  };

  const abrirHistoricoModal = async (atendimento) => {
    setHistoricoModalOpen(true);
    setHistoricoCarregando(true);
    setHistoricoErro('');
    setHistoricoAtendimento({
      id: atendimento.id,
      eleitorNome: atendimento.eleitores?.nome || '-',
      historico: []
    });

    try {
      const response = await fetch(`/api/cadastros/atendimentos/${atendimento.id}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar historico');
      }

      const data = await response.json();
      const historicoNormalizado = Array.isArray(data.historico)
        ? data.historico.map((item) => ({
            status: item.status || 'AGENDADO',
            observacao: item.observacao || 'Status atualizado',
            usuario: item.usuario_nome || 'Sistema',
            data: item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''
          }))
        : [];

      setHistoricoAtendimento({
        id: data.id,
        eleitorNome: data.eleitores?.nome || '-',
        historico: historicoNormalizado
      });
    } catch (error) {
      console.error('Erro ao carregar historico:', error);
      setHistoricoErro('Nao foi possivel carregar o historico.');
    } finally {
      setHistoricoCarregando(false);
    }
  };

  const fecharHistoricoModal = () => {
    setHistoricoModalOpen(false);
    setHistoricoAtendimento(null);
    setHistoricoErro('');
  };

  const handleExcluir = (id) => {
    showConfirm('Tem certeza que deseja excluir este atendimento?', async () => {
      try {
        const response = await fetch(`/api/cadastros/atendimentos/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          showSuccess('Atendimento excluído com sucesso!');
          carregarAtendimentos(); // Recarregar lista
        } else {
          showError('Erro ao excluir atendimento');
        }
      } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao excluir atendimento');
      }
    });
  };

  const handleImprimirListagem = () => {
    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    pdfGen.addHeader('LISTAGEM DE ATENDIMENTOS');

    const campanhaSelecionadaNome =
      campanhaFiltro === 'AVULSO'
        ? 'Avulso'
        : campanhas.find((campanha) => campanha.id === campanhaFiltro)?.nome || '';
    const liderancaSelecionadaNome =
      liderancasUnicas.find((lideranca) => lideranca.id === liderancaFiltro)?.nome || '';

    const filtrosAplicados = [];
    if (filtro) filtrosAplicados.push({ label: 'Busca', value: filtro });
    if (campanhaFiltro) filtrosAplicados.push({ label: 'Campanha', value: campanhaSelecionadaNome });
    if (liderancaFiltro) filtrosAplicados.push({ label: 'Lideranca', value: liderancaSelecionadaNome });
    if (campanhaDataInicio || campanhaDataFim) {
      const inicio = campanhaDataInicio
        ? new Date(campanhaDataInicio).toLocaleDateString('pt-BR')
        : '';
      const fim = campanhaDataFim
        ? new Date(campanhaDataFim).toLocaleDateString('pt-BR')
        : '';
      const periodoTexto = inicio && fim ? `${inicio} a ${fim}` : inicio || fim;
      filtrosAplicados.push({ label: 'Periodo da campanha', value: periodoTexto });
    }
    if ((campanhaDataInicio || campanhaDataFim) && incluirAvulsosPeriodo) {
      filtrosAplicados.push({ label: 'Avulsos no periodo', value: 'Sim' });
    }

    const campanhasDaLideranca = liderancaFiltro
      ? campanhasParaFiltro.filter((campanha) =>
          (campanha.campanhas_liderancas || []).some((item) =>
            String(item.liderancas?.id || item.lideranca_id || '') === liderancaFiltro
          )
        )
      : [];
    const campanhaParaMetricas =
      campanhaFiltro && campanhaFiltro !== 'AVULSO'
        ? campanhas.find((campanha) => campanha.id === campanhaFiltro)
        : (liderancaFiltro && campanhasDaLideranca.length === 1 ? campanhasDaLideranca[0] : null);
    const servicosMetricas = campanhaParaMetricas?.campanhas_servicos || [];
    const resumoFiltros = [];
    if (situacao) resumoFiltros.push(`Status: ${situacao}`);
    if (campanhaDataInicio || campanhaDataFim) {
      resumoFiltros.push(`Campanhas no periodo: ${campanhasPorPeriodo.length}`);
    }

    const metricasResumo = [
      { label: 'Total atendimentos', value: String(atendimentosFiltrados.length) }
    ];

    if (campanhaParaMetricas && servicosMetricas.length > 0) {
      const totals = servicosMetricas.reduce(
        (acc, item) => {
          const total = item.quantidade || 0;
          const usados = item.quantidade_usada ?? 0;
          const disponiveis = item.quantidade_disponivel ?? Math.max(total - usados, 0);
          return {
            total: acc.total + total,
            usados: acc.usados + usados,
            disponiveis: acc.disponiveis + disponiveis
          };
        },
        { total: 0, usados: 0, disponiveis: 0 }
      );

      metricasResumo.push({ label: 'Servicos total', value: String(totals.total) });
      metricasResumo.push({ label: 'Servicos usados', value: String(totals.usados) });
      metricasResumo.push({ label: 'Servicos disponiveis', value: String(totals.disponiveis) });
    }

    let yPos = 52;
    pdfGen.doc.setFontSize(10);
    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(60, 60, 60);

    if (filtrosAplicados.length > 0) {
      const maxWidth = pdfGen.pageWidth - pdfGen.margin * 2;
      const columnGap = 6;
      const columnWidth = (maxWidth - columnGap) / 2;
      const leftX = pdfGen.margin;
      const rightX = pdfGen.margin + columnWidth + columnGap;

      const labelGap = 2;

      for (let i = 0; i < filtrosAplicados.length; i += 2) {
        const linhaItens = filtrosAplicados.slice(i, i + 2);
        const yStart = yPos;

        const renderItem = (item, xBase) => {
          if (!item) return yStart;
          const labelText = `${item.label}:`;
          pdfGen.doc.setFont('helvetica', 'bold');
          const labelWidth = pdfGen.doc.getTextWidth(labelText);
          const valorLinhas = pdfGen.doc.splitTextToSize(
            item.value,
            Math.max(columnWidth - labelWidth - labelGap, 10)
          );

          pdfGen.doc.setFont('helvetica', 'bold');
          pdfGen.doc.setTextColor(10, 76, 83);
          pdfGen.doc.text(labelText, xBase, yStart);

          pdfGen.doc.setFont('helvetica', 'normal');
          pdfGen.doc.setTextColor(80, 80, 80);
          pdfGen.doc.text(valorLinhas[0], xBase + labelWidth + labelGap, yStart);

          let yLocal = yStart;
          for (let j = 1; j < valorLinhas.length; j += 1) {
            yLocal += 5;
            pdfGen.doc.text(valorLinhas[j], xBase + labelWidth + labelGap, yLocal);
          }

          return yLocal;
        };

        const yLeft = renderItem(linhaItens[0], leftX);
        const yRight = renderItem(linhaItens[1], rightX);
        yPos = Math.max(yLeft, yRight) + 6;
      }
    }

    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(80, 80, 80);
    const resumoMaxWidth = pdfGen.pageWidth - pdfGen.margin * 2;
    const resumoGap = 6;
    const resumoColWidth = (resumoMaxWidth - resumoGap) / 2;
    const resumoLeftX = pdfGen.margin;
    const resumoRightX = pdfGen.margin + resumoColWidth + resumoGap;

    if (metricasResumo.length > 0) {
      const separator = ' | ';
      let xPos = pdfGen.margin;
      const maxX = pdfGen.margin + resumoMaxWidth;

      metricasResumo.forEach((item, index) => {
        const labelText = `${item.label}:`;
        const valueText = item.value;
        pdfGen.doc.setFont('helvetica', 'bold');
        const labelWidth = pdfGen.doc.getTextWidth(labelText);
        pdfGen.doc.setFont('helvetica', 'normal');
        const valueWidth = pdfGen.doc.getTextWidth(valueText);
        const labelGap = 2;
        const sepWidth = pdfGen.doc.getTextWidth(separator);
        const totalWidth = labelWidth + labelGap + valueWidth + (index < metricasResumo.length - 1 ? sepWidth : 0);

        if (xPos + totalWidth > maxX && xPos !== pdfGen.margin) {
          xPos = pdfGen.margin;
          yPos += 5;
        }

        pdfGen.doc.setFont('helvetica', 'bold');
        pdfGen.doc.setTextColor(10, 76, 83);
        pdfGen.doc.text(labelText, xPos, yPos);
        xPos += labelWidth + labelGap;

        pdfGen.doc.setFont('helvetica', 'normal');
        pdfGen.doc.setTextColor(80, 80, 80);
        pdfGen.doc.text(valueText, xPos, yPos);
        xPos += valueWidth;

        if (index < metricasResumo.length - 1) {
          pdfGen.doc.text(separator, xPos, yPos);
          xPos += sepWidth;
        }
      });

      yPos += 8;
    }

    for (let i = 0; i < resumoFiltros.length; i += 2) {
      const linhaResumo = resumoFiltros.slice(i, i + 2);
      const yStart = yPos;
      const leftLines = pdfGen.doc.splitTextToSize(linhaResumo[0], resumoColWidth);
      const rightLines = linhaResumo[1]
        ? pdfGen.doc.splitTextToSize(linhaResumo[1], resumoColWidth)
        : [];

      pdfGen.doc.text(leftLines, resumoLeftX, yStart);
      if (rightLines.length > 0) {
        pdfGen.doc.text(rightLines, resumoRightX, yStart);
      }

      const leftHeight = leftLines.length * 5;
      const rightHeight = rightLines.length * 5;
      yPos += Math.max(leftHeight, rightHeight) + 4;
    }
    yPos += 2;
    
    const tableData = atendimentosFiltrados.map(at => {
      // Determinar o tipo a exibir
      let tipo = '-';
      if (at.atendimentos_servicos && at.atendimentos_servicos.length > 0) {
        tipo = at.atendimentos_servicos
          .map(as => as?.categorias_servicos?.nome || as?.nome || 'Serviço')
          .join(', ');
      } else if (at.tipo_atendimento) {
        const estilo = getTipoBadgeStyle(at.tipo_atendimento);
        tipo = estilo.label;
      }
      
      return [
        at.eleitores?.nome || '-',
        at.eleitores?.rg || '-',
        tipo,
        new Date(at.data_atendimento).toLocaleDateString('pt-BR'),
        at.status || '-'
      ];
    });
    
    pdfGen.doc.autoTable({
      head: [['Eleitor', 'RG', 'Tipo', 'Data', 'Status']],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    pdfGen.addFooter();
    pdfGen.doc.save(`listagem-atendimentos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Layout titulo="Gerenciar Atendimentos">
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

        {historicoModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={fecharHistoricoModal}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4">
              <div className="bg-[#0A4C53] text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Historico de Atualizacoes</h3>
                  <p className="text-xs text-teal-100">
                    Atendimento #{historicoAtendimento?.id} - {historicoAtendimento?.eleitorNome}
                  </p>
                </div>
                <button
                  onClick={fecharHistoricoModal}
                  className="text-white hover:text-teal-200 transition-colors"
                >
                  <span className="text-xl">&times;</span>
                </button>
              </div>

              <div className="p-6">
                {historicoCarregando && (
                  <p className="text-gray-600">Carregando historico...</p>
                )}

                {!historicoCarregando && historicoErro && (
                  <p className="text-red-600">{historicoErro}</p>
                )}

                {!historicoCarregando && !historicoErro && (
                  <div className="space-y-3">
                    {historicoAtendimento?.historico?.length > 0 ? (
                      historicoAtendimento.historico.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-4 p-4 bg-gray-50 rounded-lg border-l-4 border-teal-500"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-700">
                                {item.status === 'REALIZADO'
                                  ? 'Realizado'
                                  : item.status === 'CANCELADO'
                                  ? 'Cancelado'
                                  : 'Agendado'}
                              </span>
                              <span className="text-xs text-gray-500">{item.data}</span>
                            </div>
                            <p className="text-sm text-gray-600">{item.observacao}</p>
                            <p className="text-xs text-gray-500 mt-1">Por: {item.usuario}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">Nenhum historico disponivel.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  BUSCAR POR ELEITOR, CPF, TIPO...
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
                  <option value="">TODAS</option>
                  <option value="REALIZADO">REALIZADO</option>
                  <option value="AGENDADO">AGENDADO</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAMPANHA
                </label>
                <select
                  value={campanhaFiltro}
                  onChange={(e) => setCampanhaFiltro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">TODAS</option>
                  <option value="AVULSO">AVULSO</option>
                  {campanhasParaFiltro.map((campanha) => (
                    <option key={campanha.id} value={campanha.id}>
                      {campanha.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LIDERANCA
                </label>
                <select
                  value={liderancaFiltro}
                  onChange={(e) => setLiderancaFiltro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">TODAS</option>
                  {liderancasUnicas.map((lideranca) => (
                    <option key={lideranca.id} value={lideranca.id}>
                      {lideranca.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAMPANHA (INICIO)
                </label>
                <input
                  type="date"
                  value={campanhaDataInicio}
                  onChange={(e) => setCampanhaDataInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAMPANHA (FIM)
                </label>
                <input
                  type="date"
                  value={campanhaDataFim}
                  onChange={(e) => setCampanhaDataFim(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="incluirAvulsosPeriodo"
                    checked={incluirAvulsosPeriodo}
                    onChange={(e) => setIncluirAvulsosPeriodo(e.target.checked)}
                    disabled={!periodoAtivo}
                    className="h-4 w-4 text-teal-600 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="incluirAvulsosPeriodo"
                    className={`text-sm font-medium ${periodoAtivo ? 'text-gray-700' : 'text-gray-400'}`}
                  >
                    Incluir avulsos
                  </label>
                </div>
                <button
                  onClick={() => {
                    setFiltro('');
                    setSituacao('');
                    setCampanhaFiltro('');
                    setCampanhaDataInicio('');
                    setCampanhaDataFim('');
                    setIncluirAvulsosPeriodo(false);
                    setLiderancaFiltro('');
                  }}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium"
                >
                  LIMPAR FILTROS
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faList} className="text-teal-600 text-lg" />
              <h2 className="text-lg font-bold text-gray-700">Listagem de Atendimentos</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-bold text-lg text-teal-600">{atendimentosFiltrados.length}</span>
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
            {carregando ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Carregando atendimentos...</p>
              </div>
            ) : atendimentosPaginados.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Nenhum atendimento encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Eleitor</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">RG</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Campanha</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atendimentosPaginados.map((atendimento, idx) => (
                    <tr key={atendimento.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                      <td className="px-4 py-3 text-sm font-mono">{atendimento.id}</td>
                      <td className="px-4 py-3 text-sm">{atendimento.eleitores?.nome || '-'}</td>
                      <td className="px-4 py-3 text-sm">{atendimento.eleitores?.rg || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {atendimento.atendimentos_servicos && atendimento.atendimentos_servicos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {atendimento.atendimentos_servicos.map((as, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-full font-semibold whitespace-nowrap"
                                title={as?.categorias_servicos?.nome || as?.nome || 'Serviço'}
                              >
                                {as?.categorias_servicos?.nome || as?.nome || 'Serviço'}
                              </span>
                            ))}
                          </div>
                        ) : atendimento.tipo_atendimento ? (
                          (() => {
                            const estilo = getTipoBadgeStyle(atendimento.tipo_atendimento);
                            return (
                              <span className={`inline-block px-3 py-1 ${estilo.bg} ${estilo.text} text-xs rounded-full font-semibold whitespace-nowrap`}>
                                {estilo.label}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {atendimento.campanhas?.nome ? (
                          <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-semibold whitespace-nowrap">
                            {atendimento.campanhas.nome}
                          </span>
                        ) : (
                          <span className="text-gray-500">Avulso</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(atendimento.data_atendimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          atendimento.status === 'REALIZADO' 
                            ? 'bg-green-100 text-green-800' 
                            : atendimento.status === 'AGENDADO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {atendimento.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => abrirHistoricoModal(atendimento)}
                            className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                            title="Visualizar"
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          <button
                            onClick={() => handleEditar(atendimento.id)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleExcluir(atendimento.id)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
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
            )}
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
