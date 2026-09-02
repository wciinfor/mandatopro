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
  faTrashAlt
} from '@fortawesome/free-solid-svg-icons';
import { PublicoCard } from '@/components/PublicoCard';

export default function PublicosOficiaisPage() {
  const [publicos, setPublicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');

  // Estados dos filtros de segmentação exibidos no topo
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroFaixaEtaria, setFiltroFaixaEtaria] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  // Estado do Modal de Criação de Público
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoCanal, setNovoCanal] = useState('whatsapp');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState(null);

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

  // Criar novo público persistindo as regras de segmentação
  const handleSalvarPublico = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setErroModal('O nome do público é obrigatório.');
      return;
    }

    setSalvando(true);
    setErroModal(null);

    const filtrosAtivos = {};
    if (filtroTag.trim()) filtrosAtivos.tags = filtroTag.trim();
    if (filtroCidade.trim()) filtrosAtivos.cidade = filtroCidade.trim();
    if (filtroBairro.trim()) filtrosAtivos.bairro = filtroBairro.trim();
    if (filtroSexo) filtrosAtivos.sexo = filtroSexo;
    if (filtroFaixaEtaria) filtrosAtivos.faixa_etaria = filtroFaixaEtaria;
    if (filtroLideranca) filtrosAtivos.lideranca = filtroLideranca;
    if (filtroSituacao) filtrosAtivos.situacao = filtroSituacao;

    const regrasPayload = {
      origem: 'eleitores',
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

      // Limpar formulário e fechar modal
      setNovoNome('');
      setNovaDescricao('');
      setModalCriarAberto(false);

      // Recarrega listagem com contagem atualizada
      await carregarPublicosReais();
    } catch (err) {
      console.error('[PublicosPage] Erro ao criar público:', err);
      setErroModal(err.message || 'Erro ao criar público.');
    } finally {
      setSalvando(false);
    }
  };

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
                Defina públicos reutilizáveis e dinâmicos para suas campanhas de marketing oficial.
              </p>
            </div>
            <div>
              <button
                onClick={() => {
                  setErroModal(null);
                  setModalCriarAberto(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} />
                Criar Público
              </button>
            </div>
          </div>

          {/* Filtros de Segmentação do Topo */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
                <h4 className="font-bold text-sm text-gray-800">Filtros de Segmentação da Base</h4>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Os filtros ativos abaixo serão vinculados ao criar um público</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tags</label>
                <input
                  type="text"
                  value={filtroTag}
                  onChange={(e) => setFiltroTag(e.target.value)}
                  placeholder="Ex: saúde"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cidade</label>
                <input
                  type="text"
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Ex: Belém"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bairro</label>
                <input
                  type="text"
                  value={filtroBairro}
                  onChange={(e) => setFiltroBairro(e.target.value)}
                  placeholder="Ex: Centro"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sexo</label>
                <select
                  value={filtroSexo}
                  onChange={(e) => setFiltroSexo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Faixa Etária</label>
                <select
                  value={filtroFaixaEtaria}
                  onChange={(e) => setFiltroFaixaEtaria(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todas</option>
                  <option value="16-24">16-24 anos</option>
                  <option value="25-45">25-45 anos</option>
                  <option value="46+">46+ anos</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Liderança</label>
                <select
                  value={filtroLideranca}
                  onChange={(e) => setFiltroLideranca(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="yes">Apenas Lideranças</option>
                  <option value="no">Sem Liderança</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situação</label>
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="regular">Regular</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Barra de Busca */}
          <div className="relative w-full md:w-80">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar público..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
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
              <p className="text-xs text-gray-400 mt-1">Clique em &ldquo;Criar Público&rdquo; para salvar uma segmentação reutilizável.</p>
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

          {/* Modal de Criação de Público */}
          {modalCriarAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-teal-50 text-teal-600 rounded-lg text-sm">
                      <FontAwesomeIcon icon={faUsers} />
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm">Criar Novo Público</h3>
                  </div>
                  <button
                    onClick={() => setModalCriarAberto(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <form onSubmit={handleSalvarPublico} className="p-5 space-y-4 text-xs">
                  {erroModal && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                      {erroModal}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Nome do Público <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Ex: Lideranças - Bairro Centro"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Descrição</label>
                    <textarea
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      placeholder="Breve descrição da finalidade desta audiência..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Canal</label>
                    <select
                      value={novoCanal}
                      onChange={(e) => setNovoCanal(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 focus:outline-none"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="instagram">Instagram Direct</option>
                    </select>
                  </div>

                  {/* Resumo dos filtros capturados da tela */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-500 space-y-1">
                    <p className="font-bold text-gray-700">Filtros vinculados a esta audiência:</p>
                    <p>• Origem: <strong>Eleitores da Base</strong></p>
                    {filtroCidade && <p>• Cidade: <strong>{filtroCidade}</strong></p>}
                    {filtroBairro && <p>• Bairro: <strong>{filtroBairro}</strong></p>}
                    {filtroTag && <p>• Tag: <strong>{filtroTag}</strong></p>}
                    {filtroSexo && <p>• Sexo: <strong>{filtroSexo === 'M' ? 'Masculino' : 'Feminino'}</strong></p>}
                    {filtroFaixaEtaria && <p>• Faixa Etária: <strong>{filtroFaixaEtaria}</strong></p>}
                    {filtroLideranca && <p>• Liderança: <strong>{filtroLideranca === 'yes' ? 'Apenas Lideranças' : 'Sem Liderança'}</strong></p>}
                    {filtroSituacao && <p>• Situação: <strong>{filtroSituacao}</strong></p>}
                    {!filtroCidade && !filtroBairro && !filtroTag && !filtroSexo && !filtroFaixaEtaria && !filtroLideranca && !filtroSituacao && (
                      <p className="text-gray-400 italic">Nenhum filtro restritivo aplicado (Base total de eleitores).</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setModalCriarAberto(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvando}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {salvando ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          Salvando...
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

