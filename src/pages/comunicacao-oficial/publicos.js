import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faPlus,
  faFilter,
  faSearch,
  faInbox,
  faSpinner,
  faTimes,
  faCheckCircle,
  faExclamationTriangle,
  faTrashAlt,
  faSlidersH,
  faUserCheck,
  faDatabase,
  faInfoCircle,
  faUserPlus,
  faPhone,
  faMapMarkerAlt,
  faListCheck
} from '@fortawesome/free-solid-svg-icons';
import { PublicoCard } from '@/components/PublicoCard';

export default function PublicosOficiaisPage() {
  const [publicos, setPublicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');

  // Estado do Modal de Criação de Público
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoCanal, setNovoCanal] = useState('whatsapp');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState(null);

  // Estados dos filtros de segmentação DENTRO do Modal
  const [modalOrigem, setModalOrigem] = useState('eleitores');
  const [modoSelecao, setModoSelecao] = useState('filtros'); // 'filtros' | 'selecionados'
  const [modalCidade, setModalCidade] = useState('');
  const [modalBairro, setModalBairro] = useState('');
  const [modalTag, setModalTag] = useState('');
  const [modalSituacao, setModalSituacao] = useState('');

  // Estados para Seleção Individual de Eleitores
  const [termoBuscaEleitor, setTermoBuscaEleitor] = useState('');
  const [buscandoEleitores, setBuscandoEleitores] = useState(false);
  const [resultadosBuscaEleitores, setResultadosBuscaEleitores] = useState([]);
  const [eleitoresSelecionados, setEleitoresSelecionados] = useState([]); // [{ id, nome, telefone, celular, whatsapp, cidade, bairro }]

  // Estado da prévia em tempo real de contatos qualificados no modal
  const [previaContagem, setPreviaContagem] = useState(null);
  const [calculandoPrevia, setCalculandoPrevia] = useState(false);

  // Estado do Modal de Confirmação de Exclusão
  const [publicoParaExcluir, setPublicoParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // Carregar públicos reais da API
  const carregarPublicosReais = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch('/api/comunicacao-oficial/publicos');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Falha ao obter lista de públicos.');
      }
      const data = await res.json();
      setPublicos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PublicosPage] Erro ao carregar públicos:', err);
      setErro(err.message || 'Erro ao carregar públicos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPublicosReais();
  }, []);

  // Busca de Eleitores com debounce para a seleção individual
  useEffect(() => {
    if (!modalCriarAberto || modalOrigem !== 'eleitores' || modoSelecao !== 'selecionados') {
      setResultadosBuscaEleitores([]);
      return;
    }

    const termo = termoBuscaEleitor.trim();
    if (termo.length < 2) {
      setResultadosBuscaEleitores([]);
      setBuscandoEleitores(false);
      return;
    }

    let active = true;
    setBuscandoEleitores(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cadastros/eleitores/buscar?q=${encodeURIComponent(termo)}`);
        if (!res.ok) throw new Error('Falha ao buscar eleitores.');
        const data = await res.json();
        if (active) {
          setResultadosBuscaEleitores(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          console.warn('[PublicosPage] Erro ao buscar eleitores:', err.message);
          setResultadosBuscaEleitores([]);
        }
      } finally {
        if (active) setBuscandoEleitores(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [termoBuscaEleitor, modalCriarAberto, modalOrigem, modoSelecao]);

  // Prévia reativa com debounce ao alterar os filtros ou a lista de selecionados
  useEffect(() => {
    if (!modalCriarAberto) return;

    // Se estiver no modo selecionados e não tiver nenhum eleitor selecionado
    if (modalOrigem === 'eleitores' && modoSelecao === 'selecionados') {
      if (eleitoresSelecionados.length === 0) {
        setPreviaContagem(0);
        setCalculandoPrevia(false);
        return;
      }
    }

    let active = true;
    setCalculandoPrevia(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          origem: modalOrigem,
          countOnly: 'true'
        });

        if (modalOrigem === 'eleitores' && modoSelecao === 'selecionados') {
          const ids = eleitoresSelecionados.map(e => e.id).join(',');
          params.append('eleitorIds', ids);
        } else {
          if (modalCidade.trim()) params.append('cidade', modalCidade.trim());
          if (modalBairro.trim()) params.append('bairro', modalBairro.trim());
          if (modalTag.trim()) params.append('search', modalTag.trim());
          if (modalSituacao) params.append('status', modalSituacao);
        }

        const res = await fetch(`/api/disparos/contatos/preview?${params.toString()}`);
        if (!res.ok) throw new Error('Falha ao calcular prévia de contatos.');
        const payload = await res.json();

        if (active) {
          setPreviaContagem(payload?.resumo?.total ?? 0);
        }
      } catch (err) {
        if (active) {
          console.warn('[PublicosPage] Erro ao calcular prévia:', err.message);
          setPreviaContagem(null);
        }
      } finally {
        if (active) setCalculandoPrevia(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    modalCriarAberto,
    modalOrigem,
    modoSelecao,
    eleitoresSelecionados,
    modalCidade,
    modalBairro,
    modalTag,
    modalSituacao
  ]);

  // Recalcular contatos de um público via API
  const handleRecalcular = async (id) => {
    try {
      await carregarPublicosReais();
    } catch (err) {
      console.error('Erro ao recalcular:', err);
    }
  };

  // Abrir modal estilizado de exclusão
  const handleSolicitarExclusao = (id, nome) => {
    setPublicoParaExcluir({ id, nome });
  };

  // Confirmar exclusão real
  const handleConfirmarExclusao = async () => {
    if (!publicoParaExcluir) return;

    setExcluindo(true);
    try {
      const res = await fetch(`/api/comunicacao-oficial/publicos?id=${encodeURIComponent(publicoParaExcluir.id)}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Falha ao excluir o público.');
      }

      setPublicos(prev => prev.filter(p => p.id !== publicoParaExcluir.id));
      setPublicoParaExcluir(null);
    } catch (err) {
      console.error('[PublicosPage] Erro ao excluir público:', err);
      alert(`Erro: ${err.message}`);
    } finally {
      setExcluindo(false);
    }
  };

  // Resetar formulário ao abrir modal
  const handleAbrirCriarPublico = () => {
    setNovoNome('');
    setNovaDescricao('');
    setNovoCanal('whatsapp');
    setModalOrigem('eleitores');
    setModoSelecao('filtros');
    setModalCidade('');
    setModalBairro('');
    setModalTag('');
    setModalSituacao('');
    setTermoBuscaEleitor('');
    setResultadosBuscaEleitores([]);
    setEleitoresSelecionados([]);
    setErroModal(null);
    setPreviaContagem(null);
    setModalCriarAberto(true);
  };

  // Adicionar eleitor à lista de selecionados
  const handleAdicionarEleitor = (eleitor) => {
    if (!eleitor || !eleitor.id) return;
    if (eleitoresSelecionados.some(e => e.id === eleitor.id)) {
      return; // Já selecionado
    }
    setEleitoresSelecionados(prev => [...prev, eleitor]);
  };

  // Remover eleitor da lista de selecionados
  const handleRemoverEleitor = (id) => {
    setEleitoresSelecionados(prev => prev.filter(e => e.id !== id));
  };

  // Criar novo público persistindo as regras de segmentação definidas no modal
  const handleSalvarPublico = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setErroModal('O nome do público é obrigatório.');
      return;
    }

    if (modalOrigem === 'eleitores' && modoSelecao === 'selecionados' && eleitoresSelecionados.length === 0) {
      setErroModal('Selecione ao menos um eleitor para salvar esta audiência.');
      return;
    }

    setSalvando(true);
    setErroModal(null);

    let filtrosAtivos = {
      origem: modalOrigem
    };

    if (modalOrigem === 'eleitores' && modoSelecao === 'selecionados') {
      filtrosAtivos.modo = 'selecionados';
      filtrosAtivos.eleitor_ids = eleitoresSelecionados.map(e => e.id);
    } else {
      filtrosAtivos.modo = 'filtros';
      if (modalCidade.trim()) filtrosAtivos.cidade = modalCidade.trim();
      if (modalBairro.trim()) filtrosAtivos.bairro = modalBairro.trim();
      if (modalTag.trim()) filtrosAtivos.search = modalTag.trim();
      if (modalSituacao) filtrosAtivos.status = modalSituacao;
    }

    const regrasPayload = {
      origem: modalOrigem,
      canal: novoCanal,
      descricao: novaDescricao.trim(),
      filtros: filtrosAtivos
    };

    try {
      const res = await fetch('/api/comunicacao-oficial/publicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNome.trim(),
          descricao: novaDescricao.trim(),
          canal: novoCanal,
          regras: regrasPayload
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Falha ao registrar novo público.');
      }

      setModalCriarAberto(false);
      await carregarPublicosReais();
    } catch (err) {
      console.error('[PublicosPage] Erro ao criar público:', err);
      setErroModal(err.message || 'Erro ao criar público.');
    } finally {
      setSalvando(false);
    }
  };

  const temFiltroRestritivo = modoSelecao === 'selecionados' 
    ? eleitoresSelecionados.length > 0
    : Boolean(
        modalCidade.trim() ||
        modalBairro.trim() ||
        modalTag.trim() ||
        modalSituacao ||
        modalOrigem !== 'eleitores'
      );

  const filtrarPublicos = publicos.filter((p) =>
    (p.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (p.descricao || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <Layout titulo="Públicos & Audiências - WhatsApp Cloud API Oficial">
        <div className="space-y-6">
          
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Audiências & Segmentações</h3>
              <p className="text-sm text-gray-500 mt-1">
                Crie públicos dinâmicos e segmentações personalizadas para utilizar em seus disparos e campanhas.
              </p>
            </div>
            <div>
              <button
                onClick={handleAbrirCriarPublico}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} />
                Criar Público
              </button>
            </div>
          </div>

          {/* Barra de Busca de Públicos Existentes */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3 text-gray-400 text-xs" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar público por nome ou descrição..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {publicos.length} {publicos.length === 1 ? 'público cadastrado' : 'públicos cadastrados'}
            </span>
          </div>

          {/* Feedback de Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{erro}</span>
            </div>
          )}

          {/* Listagem de Cards / Loading / Vazio */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100 flex flex-col items-center justify-center gap-3">
              <FontAwesomeIcon icon={faSpinner} className="text-2xl text-teal-600 animate-spin" />
              <p className="text-xs font-medium">Carregando audiências e calculando contatos reais...</p>
            </div>
          ) : filtrarPublicos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtrarPublicos.map((pub) => (
                <PublicoCard
                  key={pub.id}
                  publico={pub}
                  onSync={handleRecalcular}
                  onDelete={handleSolicitarExclusao}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-700">Nenhum público cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Clique em &ldquo;Criar Público&rdquo; para construir uma segmentação reutilizável.</p>
            </div>
          )}

          {/* Modal Estilizado de Confirmação de Exclusão */}
          {publicoParaExcluir && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faTrashAlt} className="text-lg" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Excluir Público</h3>
                    <p className="text-[11px] text-gray-400">Esta ação não poderá ser desfeita</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Tem certeza que deseja excluir a audiência <strong className="text-gray-900 font-bold">&ldquo;{publicoParaExcluir.nome}&rdquo;</strong>?
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => setPublicoParaExcluir(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={handleConfirmarExclusao}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-rose-200 cursor-pointer"
                  >
                    {excluindo ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTrashAlt} className="text-xs" />
                        <span>Sim, Excluir</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Construtor de Audiência (Criar Novo Público) */}
          {modalCriarAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
                
                {/* Topo do Modal */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-teal-50 text-teal-600 rounded-lg text-sm">
                      <FontAwesomeIcon icon={faUsers} />
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Construtor de Audiência & Público</h3>
                      <p className="text-[11px] text-gray-400">Configure os parâmetros e veja a quantidade estimada em tempo real</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalCriarAberto(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <form onSubmit={handleSalvarPublico} className="p-6 space-y-5 text-xs">
                  {erroModal && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <span>{erroModal}</span>
                    </div>
                  )}

                  {/* Bloco 1: Identificação */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faSlidersH} className="text-teal-600" />
                      1. Identificação do Público
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-gray-700 mb-1">
                          Nome da Audiência / Público <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          placeholder="Ex: Lideranças - Bairro Centro / Eleitores Selecionados"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium text-xs"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Descrição (Opcional)</label>
                        <input
                          type="text"
                          value={novaDescricao}
                          onChange={(e) => setNovaDescricao(e.target.value)}
                          placeholder="Ex: Contatos para disparos sobre infraestrutura"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Canal de Comunicação</label>
                        <select
                          value={novoCanal}
                          onChange={(e) => setNovoCanal(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none text-xs"
                        >
                          <option value="whatsapp">WhatsApp Business Oficial</option>
                          <option value="instagram">Instagram Direct</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Segmentação de Contatos */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
                      2. Parâmetros de Segmentação da Base
                    </h4>

                    {/* Escopo da Origem */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">Origem dos Dados</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setModalOrigem('eleitores');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition flex items-center justify-center gap-2 cursor-pointer ${
                            modalOrigem === 'eleitores'
                              ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-bold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={faUsers} className={modalOrigem === 'eleitores' ? 'text-teal-600' : 'text-gray-400'} />
                          <span>Eleitores</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setModalOrigem('liderancas');
                            setModoSelecao('filtros');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition flex items-center justify-center gap-2 cursor-pointer ${
                            modalOrigem === 'liderancas'
                              ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-bold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={faUserCheck} className={modalOrigem === 'liderancas' ? 'text-teal-600' : 'text-gray-400'} />
                          <span>Lideranças</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setModalOrigem('funcionarios');
                            setModoSelecao('filtros');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition flex items-center justify-center gap-2 cursor-pointer ${
                            modalOrigem === 'funcionarios'
                              ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-bold shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={faDatabase} className={modalOrigem === 'funcionarios' ? 'text-teal-600' : 'text-gray-400'} />
                          <span>Gabinete / Equipe</span>
                        </button>
                      </div>
                    </div>

                    {/* Alternância de Modo (Filtros em Massa vs Seleção Individual) quando Origem = Eleitores */}
                    {modalOrigem === 'eleitores' && (
                      <div className="pt-2">
                        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                          <button
                            type="button"
                            onClick={() => setModoSelecao('filtros')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              modoSelecao === 'filtros'
                                ? 'bg-white text-teal-800 shadow-xs'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <FontAwesomeIcon icon={faSlidersH} className="text-xs" />
                            <span>Segmentação por Filtros</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setModoSelecao('selecionados')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              modoSelecao === 'selecionados'
                                ? 'bg-white text-teal-800 shadow-xs'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <FontAwesomeIcon icon={faListCheck} className="text-xs" />
                            <span>Seleção Individual de Eleitores</span>
                            {eleitoresSelecionados.length > 0 && (
                              <span className="bg-teal-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                                {eleitoresSelecionados.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MODO 1: Filtros Geográficos e Categóricos */}
                    {(modalOrigem !== 'eleitores' || modoSelecao === 'filtros') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cidade</label>
                          <input
                            type="text"
                            value={modalCidade}
                            onChange={(e) => setModalCidade(e.target.value)}
                            placeholder="Ex: Belém"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bairro</label>
                          <input
                            type="text"
                            value={modalBairro}
                            onChange={(e) => setModalBairro(e.target.value)}
                            placeholder="Ex: Centro"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tags / Busca</label>
                          <input
                            type="text"
                            value={modalTag}
                            onChange={(e) => setModalTag(e.target.value)}
                            placeholder="Ex: saúde, educação"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situação / Status</label>
                          <select
                            value={modalSituacao}
                            onChange={(e) => setModalSituacao(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs focus:outline-none"
                          >
                            <option value="">Todos os status</option>
                            <option value="ATIVO">Ativos / Regulares</option>
                            <option value="PENDENTE">Pendentes</option>
                            <option value="INATIVO">Inativos</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* MODO 2: Seleção Individual de Eleitores */}
                    {modalOrigem === 'eleitores' && modoSelecao === 'selecionados' && (
                      <div className="space-y-3 pt-1">
                        {/* Campo de Busca por Nome */}
                        <div className="relative">
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Pesquisar Eleitor por Nome ou CPF
                          </label>
                          <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3 text-gray-400 text-xs" />
                            <input
                              type="text"
                              value={termoBuscaEleitor}
                              onChange={(e) => setTermoBuscaEleitor(e.target.value)}
                              placeholder="Digite ao menos 2 letras do nome para buscar..."
                              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            />
                            {buscandoEleitores && (
                              <FontAwesomeIcon icon={faSpinner} className="absolute right-3 top-3 text-teal-600 animate-spin text-xs" />
                            )}
                          </div>
                        </div>

                        {/* Resultados da Busca */}
                        {termoBuscaEleitor.trim().length >= 2 && (
                          <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-h-48 overflow-y-auto divide-y divide-gray-100">
                            {buscandoEleitores ? (
                              <div className="p-3 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-teal-600" />
                                <span>Buscando eleitores na base...</span>
                              </div>
                            ) : resultadosBuscaEleitores.length > 0 ? (
                              resultadosBuscaEleitores.map((eleitor) => {
                                const jaSelecionado = eleitoresSelecionados.some(e => e.id === eleitor.id);
                                const telefone = eleitor.celular || eleitor.whatsapp || eleitor.telefone || 'Sem telefone';
                                const localidade = [eleitor.bairro, eleitor.cidade || eleitor.municipio].filter(Boolean).join(' - ');

                                return (
                                  <div
                                    key={eleitor.id}
                                    className="p-2.5 flex items-center justify-between hover:bg-teal-50/40 transition gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-800 text-xs truncate">{eleitor.nome}</p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                        <span className="flex items-center gap-1">
                                          <FontAwesomeIcon icon={faPhone} className="text-[9px]" />
                                          {telefone}
                                        </span>
                                        {localidade && (
                                          <span className="flex items-center gap-1">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-[9px]" />
                                            {localidade}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={jaSelecionado}
                                      onClick={() => handleAdicionarEleitor(eleitor)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 cursor-pointer ${
                                        jaSelecionado
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                                      }`}
                                    >
                                      <FontAwesomeIcon icon={jaSelecionado ? faCheckCircle : faUserPlus} className="text-[10px]" />
                                      <span>{jaSelecionado ? 'Adicionado' : 'Adicionar'}</span>
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="p-3 text-center text-gray-400 text-xs">
                                Nenhum eleitor encontrado para &ldquo;{termoBuscaEleitor}&rdquo;
                              </div>
                            )}
                          </div>
                        )}

                        {/* Seção de Eleitores Selecionados */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-gray-700">
                              Eleitores Selecionados ({eleitoresSelecionados.length})
                            </span>
                            {eleitoresSelecionados.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setEleitoresSelecionados([])}
                                className="text-[10px] text-rose-600 hover:underline font-medium cursor-pointer"
                              >
                                Limpar seleção
                              </button>
                            )}
                          </div>

                          {eleitoresSelecionados.length > 0 ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5">
                              {eleitoresSelecionados.map((eleitor) => {
                                const tel = eleitor.celular || eleitor.whatsapp || eleitor.telefone || '';
                                return (
                                  <div
                                    key={eleitor.id}
                                    className="bg-white px-2.5 py-1.5 rounded-lg border border-gray-200/80 flex items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                        {eleitor.nome?.charAt(0) || 'E'}
                                      </span>
                                      <div className="truncate">
                                        <span className="font-semibold text-gray-800 truncate">{eleitor.nome}</span>
                                        {tel && <span className="text-[10px] text-gray-400 ml-1.5">({tel})</span>}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoverEleitor(eleitor.id)}
                                      className="text-gray-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                                      title="Remover"
                                    >
                                      <FontAwesomeIcon icon={faTimes} className="text-xs" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-[11px]">
                              Nenhum eleitor selecionado. Busque pelo nome acima e clique em &ldquo;Adicionar&rdquo;.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bloco 3: Painel de Prévia Reativa */}
                  <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 text-xs flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faUsers} className="text-teal-600" />
                        Prévia em Tempo Real da Audiência
                      </span>
                      {calculandoPrevia && (
                        <span className="text-[11px] text-teal-600 flex items-center gap-1">
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
                          Calculando...
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-2xl font-black text-teal-900">
                        {previaContagem !== null ? Number(previaContagem).toLocaleString('pt-BR') : '—'}
                      </span>
                      <span className="text-xs text-gray-600 font-medium">contatos qualificados com WhatsApp encontrados</span>
                    </div>

                    {modoSelecao === 'filtros' && !temFiltroRestritivo && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5 mt-2">
                        <FontAwesomeIcon icon={faInfoCircle} className="text-amber-600 shrink-0" />
                        <span>Atenção: nenhum filtro restritivo aplicado. Esta audiência incluirá toda a base de {modalOrigem}.</span>
                      </div>
                    )}

                    {modalOrigem === 'eleitores' && modoSelecao === 'selecionados' && eleitoresSelecionados.length === 0 && (
                      <div className="text-[11px] text-gray-500 bg-gray-100/80 border border-gray-200 rounded-lg p-2 flex items-center gap-1.5 mt-2">
                        <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 shrink-0" />
                        <span>Nenhum eleitor selecionado. Adicione contatos individualmente para calcular a prévia.</span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Modal com Ações */}
                  <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => setModalCriarAberto(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition cursor-pointer text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvando || calculandoPrevia || (modalOrigem === 'eleitores' && modoSelecao === 'selecionados' && eleitoresSelecionados.length === 0)}
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-sm cursor-pointer text-xs"
                    >
                      {salvando ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          Salvando Audiência...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCheckCircle} />
                          Salvar Público
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
