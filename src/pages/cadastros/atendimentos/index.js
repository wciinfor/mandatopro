import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PDFGenerator from '@/utils/pdfGenerator';
import QRCode from 'qrcode';
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
  const showErrorRef = useRef(showError);
  const FICHA_BG_VERSION = '20260325-4';
  
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

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);
  const [atendimentosSelecionados, setAtendimentosSelecionados] = useState([]);

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

  const carregarAtendimentos = useCallback(async () => {
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
      showErrorRef.current('Erro ao carregar atendimentos do banco de dados');
    } finally {
      setCarregando(false);
    }
  }, []); // showError excluído: recria a cada render e causaria loop infinito

  const carregarCampanhas = useCallback(async () => {
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
  }, []);

  // Buscar atendimentos do Supabase
  useEffect(() => {
    carregarAtendimentos();
  }, [carregarAtendimentos]);

  useEffect(() => {
    carregarCampanhas();
  }, [carregarCampanhas]);

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
  const todosPaginadosSelecionados =
    atendimentosPaginados.length > 0 &&
    atendimentosPaginados.every((item) => atendimentosSelecionados.includes(item.id));

  useEffect(() => {
    const idsFiltrados = new Set(atendimentosFiltrados.map((item) => item.id));
    setAtendimentosSelecionados((prev) => prev.filter((id) => idsFiltrados.has(id)));
  }, [atendimentosFiltrados]);

  const alternarSelecaoAtendimento = (id) => {
    setAtendimentosSelecionados((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const alternarSelecaoTodosPaginados = () => {
    const idsPagina = atendimentosPaginados.map((item) => item.id);
    if (idsPagina.length === 0) return;

    setAtendimentosSelecionados((prev) => {
      const todosSelecionados = idsPagina.every((id) => prev.includes(id));
      if (todosSelecionados) {
        return prev.filter((id) => !idsPagina.includes(id));
      }

      const uniao = new Set([...prev, ...idsPagina]);
      return Array.from(uniao);
    });
  };

  const handleInserir = () => {
    const destino = '/cadastros/atendimentos/novo';
    if (typeof window !== 'undefined') {
      window.location.href = destino;
      return;
    }

    router.push(destino);
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

  const getTipoAtendimentoTexto = (atendimento) => {
    if (atendimento.atendimentos_servicos && atendimento.atendimentos_servicos.length > 0) {
      return atendimento.atendimentos_servicos
        .map((item) => item?.categorias_servicos?.nome || item?.nome || 'Servico')
        .join(', ');
    }

    if (atendimento.tipo_atendimento) {
      const estilo = getTipoBadgeStyle(atendimento.tipo_atendimento);
      return estilo.label;
    }

    return '-';
  };

  const getNomeArquivoFicha = (atendimento) => {
    const nome = atendimento?.eleitores?.nome || `atendimento-${atendimento?.id || 'sem-id'}`;
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
  };

  const montarTextoProtocolo = (atendimento) => {
    const protocolo = atendimento?.protocolo || `ATD-${atendimento?.id || 'SEM-ID'}`;
    const urlHistorico = getUrlHistoricoAcompanhamento(atendimento);
    const dataAtendimento = atendimento?.data_atendimento
      ? new Date(atendimento.data_atendimento).toLocaleDateString('pt-BR')
      : '-';

    return [
      urlHistorico,
      `Protocolo: ${protocolo}`,
      `ID: ${atendimento?.id || '-'}`,
      `Status: ${atendimento?.status || '-'}`,
      `Data: ${dataAtendimento}`
    ].join('\n');
  };

  const getUrlHistoricoAcompanhamento = (atendimento) => {
    const protocolo = atendimento?.protocolo || `ATD-${atendimento?.id || 'SEM-ID'}`;
    const atendimentoId = atendimento?.id ? String(atendimento.id) : '';
    const eleitorId = atendimento?.eleitores?.id ? String(atendimento.eleitores.id) : '';
    const origem = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origem}/atendimentos/historico?protocolo=${encodeURIComponent(protocolo)}&aid=${encodeURIComponent(atendimentoId)}&eid=${encodeURIComponent(eleitorId)}`;
  };

  const isAtendimentoOftalmologista = (atendimento) => {
    if (atendimento?.tipo_atendimento === 'OFTALMOLOGISTA') return true;
    return getTipoAtendimentoTexto(atendimento).toLowerCase().includes('oftalmo');
  };

  const adicionarProtocoloEQRCode = async (pdfGen, atendimento) => {
    const protocolo = atendimento?.protocolo || `ATD-${atendimento?.id || 'SEM-ID'}`;
    const qrPayload = montarTextoProtocolo(atendimento);
    const urlHistorico = getUrlHistoricoAcompanhamento(atendimento);

    pdfGen.doc.setFontSize(9);
    pdfGen.doc.setFont('helvetica', 'bold');
    pdfGen.doc.setTextColor(10, 76, 83);
    pdfGen.doc.text(`Protocolo: ${protocolo}`, pdfGen.margin, 50);

    pdfGen.doc.setFontSize(7);
    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(90, 90, 90);
    const linhasConsulta = pdfGen.doc.splitTextToSize(`Consulta: ${urlHistorico}`, pdfGen.pageWidth - (pdfGen.margin * 2) - 24);
    pdfGen.doc.text(linhasConsulta, pdfGen.margin, 54);

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 180
    });

    const qrSize = 18;
    const qrX = pdfGen.pageWidth - pdfGen.margin - qrSize;
    const qrY = 34;
    pdfGen.doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    pdfGen.doc.setFontSize(7);
    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(90, 90, 90);
    pdfGen.doc.text('Acompanhar', qrX + (qrSize / 2), qrY + qrSize + 3, { align: 'center' });
  };

  const getFichaOftalmoBackground = async () => {
    const bust = `${FICHA_BG_VERSION}-${Date.now()}`;
    const tentativas = [
      `/img/ficha2.png?v=${encodeURIComponent(bust)}`,
      `/img/ficha.png?v=${encodeURIComponent(bust)}`
    ];

    let response = null;
    for (const url of tentativas) {
      // Forca leitura sem cache para refletir alteracoes recentes da arte
      const tentativa = await fetch(url, { cache: 'no-store' });
      if (tentativa.ok) {
        response = tentativa;
        break;
      }
    }

    if (!response) {
      throw new Error('Nao foi possivel carregar o fundo da ficha oftalmologica.');
    }

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return dataUrl;
  };

  const renderFichaPadraoA4 = async (pdfGen, atendimento) => {
    const titulo = 'FICHA DE ATENDIMENTO';
    const subtitulo = atendimento.protocolo
      ? `Protocolo: ${atendimento.protocolo}`
      : `Atendimento #${atendimento.id}`;

    pdfGen.addHeader(titulo, subtitulo);
    await adicionarProtocoloEQRCode(pdfGen, atendimento);

    const dataAtendimento = atendimento.data_atendimento
      ? new Date(atendimento.data_atendimento).toLocaleDateString('pt-BR')
      : '-';

    const dataCriacao = atendimento.created_at
      ? new Date(atendimento.created_at).toLocaleDateString('pt-BR')
      : '-';

    const tipoAtendimento = getTipoAtendimentoTexto(atendimento);
    const campanhaNome = atendimento.campanhas?.nome || 'Avulso';

    const dadosAtendimento = [
      ['ID', String(atendimento.id || '-')],
      ['Status', atendimento.status || '-'],
      ['Data do atendimento', dataAtendimento],
      ['Data de cadastro', dataCriacao],
      ['Campanha', campanhaNome],
      ['Tipo', tipoAtendimento]
    ];

    const dadosEleitor = [
      ['Nome', atendimento.eleitores?.nome || '-'],
      ['CPF', atendimento.eleitores?.cpf || '-'],
      ['RG', atendimento.eleitores?.rg || '-'],
      ['Celular', atendimento.eleitores?.celular || atendimento.eleitores?.telefone || '-'],
      ['Email', atendimento.eleitores?.email || '-']
    ];

    let yPos = 55;

    pdfGen.doc.setFontSize(11);
    pdfGen.doc.setFont('helvetica', 'bold');
    pdfGen.doc.setTextColor(10, 76, 83);
    pdfGen.doc.text('INFORMACOES DO ATENDIMENTO', pdfGen.margin, yPos);
    yPos += 5;

    pdfGen.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informacao']],
      body: dadosAtendimento,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      margin: { left: pdfGen.margin, right: pdfGen.margin }
    });

    yPos = pdfGen.doc.lastAutoTable.finalY + 8;

    pdfGen.doc.setFontSize(11);
    pdfGen.doc.setFont('helvetica', 'bold');
    pdfGen.doc.setTextColor(10, 76, 83);
    pdfGen.doc.text('DADOS DO ELEITOR', pdfGen.margin, yPos);
    yPos += 5;

    pdfGen.doc.autoTable({
      startY: yPos,
      head: [['Campo', 'Informacao']],
      body: dadosEleitor,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [10, 76, 83], textColor: 255, fontStyle: 'bold' },
      margin: { left: pdfGen.margin, right: pdfGen.margin }
    });

    yPos = pdfGen.doc.lastAutoTable.finalY + 8;
    const descricao = atendimento.descricao || '-';
    const resultado = atendimento.resultado || '-';

    pdfGen.doc.setFontSize(11);
    pdfGen.doc.setFont('helvetica', 'bold');
    pdfGen.doc.setTextColor(10, 76, 83);
    pdfGen.doc.text('DESCRICAO', pdfGen.margin, yPos);
    yPos += 5;

    pdfGen.doc.setFontSize(9);
    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(80, 80, 80);
    const linhasDescricao = pdfGen.doc.splitTextToSize(descricao, pdfGen.pageWidth - (pdfGen.margin * 2));
    pdfGen.doc.text(linhasDescricao, pdfGen.margin, yPos);
    yPos += (linhasDescricao.length * 4.5) + 6;

    pdfGen.doc.setFontSize(11);
    pdfGen.doc.setFont('helvetica', 'bold');
    pdfGen.doc.setTextColor(10, 76, 83);
    pdfGen.doc.text('RESULTADO / OBSERVACOES', pdfGen.margin, yPos);
    yPos += 5;

    pdfGen.doc.setFontSize(9);
    pdfGen.doc.setFont('helvetica', 'normal');
    pdfGen.doc.setTextColor(80, 80, 80);
    const linhasResultado = pdfGen.doc.splitTextToSize(resultado, pdfGen.pageWidth - (pdfGen.margin * 2));
    pdfGen.doc.text(linhasResultado, pdfGen.margin, yPos);
  };

  const renderFichaOftalmoMeiaPagina = async (pdfGen, atendimento, yBase) => {
    const x = 8;
    const w = pdfGen.pageWidth - 16;
    const h = 138;
    const y = yBase;
    const doc = pdfGen.doc;

    const eleitor = atendimento?.eleitores || {};
    const nomeMae = eleitor.nomeMae || eleitor.nomemae || '-';
    const endereco = eleitor.logradouro || eleitor.endereco || '-';
    const bairro = eleitor.bairro || '-';
    const cep = eleitor.cep || '-';
    const whatsapp = eleitor.celular || eleitor.telefone || '-';
    const protocolo = atendimento?.protocolo || `ATD-${atendimento?.id || 'SEM-ID'}`;
    const dataAtendimento = atendimento?.data_atendimento
      ? new Date(atendimento.data_atendimento).toLocaleDateString('pt-BR')
      : '__/__/____';
    const fundoFicha = await getFichaOftalmoBackground();

    doc.addImage(fundoFicha, 'PNG', x, y, w, h);

    const textFit = (valor, maxWidth) => {
      const texto = valor || '-';
      const linhas = doc.splitTextToSize(String(texto), maxWidth);
      return linhas[0] || '-';
    };

    doc.setTextColor(25, 25, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);

    // Cabecalho principal da ficha (sobreposicao no fundo fixo)
    doc.text(textFit(atendimento?.campanhas?.nome || '-', 96), x + 31, y + 13.1);
    doc.text(dataAtendimento, x + w - 24, y + 13.1);
    doc.text(textFit(getTipoAtendimentoTexto(atendimento), 150), x + 30, y + 22.1);
    doc.text(textFit(eleitor.nome || '-', 88), x + 18, y + 31.0);
    doc.text(textFit(nomeMae, 52), x + 134, y + 31.0);
    doc.text(textFit(endereco, 80), x + 24, y + 40.4);
    doc.text(textFit(bairro, 40), x + 122, y + 40.4);
    doc.text(textFit(cep, 24), x + 166, y + 40.4);
    doc.text(textFit(eleitor.rg || '-', 42), x + 17, y + 51.0);
    doc.text(textFit(whatsapp, 60), x + 128, y + 51.6);

    // Bloco inferior esquerdo
    doc.text(textFit(eleitor.nome || '-', 79), x + 20, y + 64.6);
    doc.text(textFit(whatsapp, 60), x + 31, y + 71.1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const tipoLenteTexto = String(atendimento?.resultado || '').toUpperCase();
    const marcar = (texto) => (tipoLenteTexto.includes(texto) ? 'X' : '');
    doc.text(marcar('UNIFOCAL'), x + 9.3, y + 87.8);
    doc.text(marcar('BIFOCAL'), x + 58.3, y + 87.8);
    doc.text(marcar('ANTIRREFLEXO'), x + 9.3, y + 96.2);
    doc.text(marcar('FILTRO AZUL'), x + 58.3, y + 96.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const obs = atendimento?.descricao || '-';
    const obsLinhas = doc.splitTextToSize(obs, 96).slice(0, 5);
    doc.text(obsLinhas, x + 4, y + 111);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Protocolo: ${protocolo}`, x + 4, y + h - 3.5);

    const qrDataUrl = await QRCode.toDataURL(montarTextoProtocolo(atendimento), {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 120
    });
    const qrSizeStatus = 16;
    const statusBoxX = x + w - 24.5;
    const statusBoxY = y + h - 21.5;
    const statusBoxW = 22;
    const statusBoxH = 21;
    const qrX = statusBoxX + ((statusBoxW - qrSizeStatus) / 2) + 0.8;
    const qrY = statusBoxY + ((statusBoxH - qrSizeStatus) / 2) + 1.0;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSizeStatus, qrSizeStatus);
  };

  const gerarFichasAtendimentoPDF = async (listaAtendimentos, nomeArquivo) => {
    if (!Array.isArray(listaAtendimentos) || listaAtendimentos.length === 0) {
      showWarning('Nao ha atendimentos para gerar a impressao em lote.');
      return;
    }

    const pdfGen = new PDFGenerator();
    pdfGen.initDoc();
    let paginaIniciada = false;
    let slotOftalmo = 0;

    const iniciarNovaPagina = () => {
      if (!paginaIniciada) {
        paginaIniciada = true;
        return;
      }
      pdfGen.doc.addPage();
    };

    for (let index = 0; index < listaAtendimentos.length; index += 1) {
      const atendimento = listaAtendimentos[index];
      if (isAtendimentoOftalmologista(atendimento)) {
        if (slotOftalmo === 0) {
          iniciarNovaPagina();
          await renderFichaOftalmoMeiaPagina(pdfGen, atendimento, 8);
          slotOftalmo = 1;
        } else {
          await renderFichaOftalmoMeiaPagina(pdfGen, atendimento, 151);
          slotOftalmo = 0;
        }
      } else {
        if (slotOftalmo === 1) {
          slotOftalmo = 0;
        }
        iniciarNovaPagina();
        await renderFichaPadraoA4(pdfGen, atendimento);
      }
    }

    pdfGen.addFooter();
    pdfGen.doc.save(`${nomeArquivo}.pdf`);
  };

  const handleImprimirFicha = async (atendimento) => {
    const slug = getNomeArquivoFicha(atendimento);
    await gerarFichasAtendimentoPDF([atendimento], `ficha-atendimento-${slug}`);
  };

  const handleImprimirFichasLote = async () => {
    if (atendimentosSelecionados.length === 0) {
      showError('Selecione ao menos um atendimento para imprimir em lote.');
      return;
    }

    const selecionados = atendimentosFiltrados.filter((item) =>
      atendimentosSelecionados.includes(item.id)
    );

    await gerarFichasAtendimentoPDF(
      selecionados,
      `fichas-atendimentos-${new Date().toISOString().split('T')[0]}`
    );
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
              type="button"
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
                IMPRIMIR LISTAGEM
              </button>
              <button
                onClick={handleImprimirFichasLote}
                disabled={atendimentosSelecionados.length === 0}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faPrint} />
                IMPRIMIR LOTE ({atendimentosSelecionados.length})
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
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={todosPaginadosSelecionados}
                        onChange={alternarSelecaoTodosPaginados}
                        aria-label="Selecionar todos da pagina"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Eleitor</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">RG</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Campanha</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atendimentosPaginados.map((atendimento, idx) => (
                    <tr key={atendimento.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 transition`}>
                      <td className="px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={atendimentosSelecionados.includes(atendimento.id)}
                          onChange={() => alternarSelecaoAtendimento(atendimento.id)}
                          aria-label={`Selecionar atendimento ${atendimento.id}`}
                        />
                      </td>
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
                            onClick={() => handleImprimirFicha(atendimento)}
                            className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                            title="Imprimir ficha"
                          >
                            <FontAwesomeIcon icon={faPrint} />
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
