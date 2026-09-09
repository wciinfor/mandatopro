import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faExclamationTriangle,
  faSpinner,
  faCheckSquare,
  faSquare,
  faPaperPlane,
  faRedo,
  faInfoCircle,
  faUserCheck,
  faBullhorn
} from '@fortawesome/free-solid-svg-icons';

export default function CentralReenvioFalhasPage() {
  const router = useRouter();

  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(null);

  // Navegação: null = Lista de Grupos | grupo = Visão detalhada de uma Campanha Original
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);

  // Na visão detalhada: Aba / Filtro Ativo ('elegiveis' | 'espera' | 'andamento' | 'bloqueados')
  const [abaAtiva, setAbaAtiva] = useState('elegiveis');

  // Seleção de Destinatários na campanha atual
  const [selecionados, setSelecionados] = useState(new Set());
  // Exclusões manuais temporárias da lista (IDs dos itens descartados do lote)
  const [removidosManualmente, setRemovidosManualmente] = useState(new Set());

  // Form para Nova Campanha Derivada
  const [nomeCampanha, setNomeCampanha] = useState('');
  const [templateNome, setTemplateNome] = useState('');
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const carregarGruposCampanhas = async () => {
    setLoading(true);
    setErroCarregamento(null);
    try {
      const res = await fetch('/api/comunicacao-oficial/falhas/reenvio-131049');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || 'Falha ao buscar grupos de reenvio Meta 131049.');
      }
      const data = await res.json();
      const listaGrupos = data.grupos || [];
      setGrupos(listaGrupos);
    } catch (err) {
      console.error('Erro ao carregar grupos 131049:', err);
      setErroCarregamento(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarGruposCampanhas();
  }, []);

  // Seleção de uma Campanha Original para visualizar a lista
  const handleAbrirGrupo = (grupo) => {
    setGrupoSelecionado(grupo);
    setAbaAtiva('elegiveis');
    setRemovidosManualmente(new Set());
    setNomeCampanha(`Reenvio - ${grupo.nome_campanha}`);
    setTemplateNome(grupo.template_id || 'modelo_institucional01');

    // Filtra elegíveis que não foram removidos manualmente
    const elegiveis = (grupo.destinatarios || []).filter(item => item.pode_selecionar);
    setSelecionados(new Set(elegiveis.map(item => item.item_id)));
  };

  const handleVoltarGrupos = () => {
    setGrupoSelecionado(null);
    setSelecionados(new Set());
    setRemovidosManualmente(new Set());
    setFeedback(null);
  };

  // Exclusão manual de um destinatário da lista de reenvio (não altera histórico)
  const handleRemoverDestinatario = (itemId) => {
    const novoRemovidos = new Set(removidosManualmente);
    novoRemovidos.add(itemId);
    setRemovidosManualmente(novoRemovidos);

    const novoSelecionados = new Set(selecionados);
    novoSelecionados.delete(itemId);
    setSelecionados(novoSelecionados);
  };

  // Filtragem dos destinatários do grupo ativo descontando remoções manuais
  const destinatariosAtivos = grupoSelecionado
    ? (grupoSelecionado.destinatarios || []).filter(item => !removidosManualmente.has(item.item_id))
    : [];

  const elegiveisAgora = destinatariosAtivos.filter(item => item.pode_selecionar);
  const emEspera = destinatariosAtivos.filter(item => !item.pode_selecionar && !item.ja_reenviado && !item.atende_janela);
  const emAndamento = destinatariosAtivos.filter(item => item.status_elegibilidade === 'Reenvio em andamento');
  const bloqueadosConcluidos = destinatariosAtivos.filter(item =>
    item.status_elegibilidade === 'Concluído com sucesso' ||
    item.status_elegibilidade === 'Bloqueado definitivamente' ||
    item.status_elegibilidade === 'Máximo de tentativas atingido' ||
    item.status_elegibilidade === 'Requer análise'
  );

  const listaExibida =
    abaAtiva === 'elegiveis' ? elegiveisAgora :
    abaAtiva === 'espera' ? emEspera :
    abaAtiva === 'andamento' ? emAndamento : bloqueadosConcluidos;

  const toggleSelecionarTudoElegiveis = () => {
    if (selecionados.size === elegiveisAgora.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(elegiveisAgora.map(item => item.item_id)));
    }
  };

  const toggleItem = (item) => {
    if (!item.pode_selecionar) return;
    const novoSet = new Set(selecionados);
    if (novoSet.has(item.item_id)) {
      novoSet.delete(item.item_id);
    } else {
      novoSet.add(item.item_id);
    }
    setSelecionados(novoSet);
  };

  const handleCriarReenvio = async () => {
    if (selecionados.size === 0 || criandoCampanha || !grupoSelecionado) return;

    if (!nomeCampanha.trim()) {
      setFeedback({ tipo: 'erro', texto: 'Informe o nome para a nova campanha de reenvio.' });
      return;
    }

    setCriandoCampanha(true);
    setFeedback(null);

    try {
      const payload = {
        campaign_origem_id: grupoSelecionado.campaign_id,
        nome_campanha: nomeCampanha.trim(),
        template_nome: templateNome,
        item_ids: Array.from(selecionados),
        contatos_removidos: Array.from(removidosManualmente)
      };

      const res = await fetch('/api/comunicacao-oficial/falhas/reenvio-131049', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Erro ao criar a campanha de reenvio.');
      }

      setFeedback({
        tipo: 'sucesso',
        texto: `Campanha de reenvio "${data.campanha.nome}" criada com sucesso contendo ${data.total_processados} destinatários na fila!`
      });

      setTimeout(() => {
        router.push(`/comunicacao-oficial/campanhas/${data.campanha.id}`);
      }, 1500);
    } catch (err) {
      console.error('Erro ao criar reenvio:', err);
      setFeedback({ tipo: 'erro', texto: err.message });
      setCriandoCampanha(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout titulo="Central de Grupos de Reenvio — Meta 131049">
        <div className="space-y-6">

          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm gap-4">
            <button
              onClick={() => grupoSelecionado ? handleVoltarGrupos() : router.push('/comunicacao-oficial/campanhas')}
              className="text-gray-500 hover:text-teal-600 font-bold flex items-center gap-1.5 text-xs self-start sm:self-auto cursor-pointer"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              {grupoSelecionado ? 'Voltar para Lista de Campanhas' : 'Voltar para Comunicações'}
            </button>

            <div className="flex items-center gap-2">
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600" />
                Agrupamento por Campanha Original (Anti-Mistura)
              </span>
            </div>
          </div>

          {/* Banner Explicativo da Causa do Erro e Política de Agrupamento */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-blue-950 text-xs space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 text-sm" />
              <span>Gestão de Reenvios Agrupados por Campanha</span>
            </div>
            <p className="leading-relaxed text-blue-800">
              Os destinatários são mantidos rigorosamente isolados pela <strong>campanha original de origem</strong>. Selecione um grupo para revisar a lista, remover manualmente destinatários indesejados e disparar o lote de reenvio de forma independente e segura.
            </p>
          </div>

          {/* Feedback de Operação */}
          {feedback && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold ${
              feedback.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {feedback.texto}
            </div>
          )}

          {/* Estado de Carregamento Global */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-teal-600 mb-3" />
              <p className="text-sm">Agrupando falhas Meta 131049 por campanha original...</p>
            </div>
          ) : erroCarregamento ? (
            <div className="bg-white rounded-2xl p-6 text-center text-rose-600 border border-rose-100 max-w-md mx-auto">
              <p className="text-sm font-bold">{erroCarregamento}</p>
            </div>
          ) : !grupoSelecionado ? (

            /* ─── NÍVEL 1: VISÃO GERAL DE GRUPOS POR CAMPANHA ORIGINAL ─── */
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                Campanhas com Falhas Meta 131049 ({grupos.length} Grupos Encontrados)
              </h4>

              {grupos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {grupos.map((grp) => (
                    <div
                      key={grp.campaign_id}
                      className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200">
                            ID #{grp.campaign_id}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(grp.data_campanha).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-gray-800 line-clamp-2">
                          {grp.nome_campanha}
                        </h3>

                        <div className="text-[11px] text-gray-500 font-mono">
                          Template: <strong className="text-teal-700">{grp.template_id}</strong>
                        </div>
                      </div>

                      {/* Métricas do Grupo */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-100 text-center">
                        <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                          <span className="block text-sm font-extrabold text-emerald-700">{grp.total_elegiveis_agora}</span>
                          <span className="text-[9px] font-bold text-emerald-800 uppercase">Elegíveis</span>
                        </div>
                        <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100">
                          <span className="block text-sm font-extrabold text-amber-700">{grp.total_aguardando_janela}</span>
                          <span className="text-[9px] font-bold text-amber-800 uppercase">Em Espera</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-200/60">
                          <span className="block text-sm font-extrabold text-gray-700">{grp.total_bloqueados_concluidos}</span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">Bloqueados</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAbrirGrupo(grp)}
                        className="w-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <FontAwesomeIcon icon={faBullhorn} />
                        Gerenciar Reenvio deste Grupo
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
                  Nenhuma campanha original com falha Meta 131049 foi encontrada no seu gabinete.
                </div>
              )}
            </div>

          ) : (

            /* ─── NÍVEL 2: DETALHES E SELEÇÃO DE UMA CAMPANHA ESPECÍFICA ─── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Tabela de Destinatários da Campanha Selecionada */}
              <div className="bg-white rounded-2xl border border-gray-100 lg:col-span-2 overflow-hidden shadow-sm flex flex-col">

                {/* Dados da Campanha Origem */}
                <div className="p-4 bg-teal-900 text-white flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-teal-200 tracking-wider block">Campanha Original Selecionada</span>
                    <h3 className="font-bold text-sm text-white">{grupoSelecionado.nome_campanha} (ID #{grupoSelecionado.campaign_id})</h3>
                  </div>
                  {removidosManualmente.size > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-rose-400">
                      {removidosManualmente.size} Removidos da Lista
                    </span>
                  )}
                </div>

                {/* Abas de Navegação Interna */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-1.5 text-[11px] font-bold overflow-x-auto">
                  <button
                    onClick={() => setAbaAtiva('elegiveis')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                      abaAtiva === 'elegiveis'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
                    }`}
                  >
                    <span>Elegíveis Agora</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                      abaAtiva === 'elegiveis' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {elegiveisAgora.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAbaAtiva('espera')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                      abaAtiva === 'espera'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
                    }`}
                  >
                    <span>Aguardando Janela (48h/72h)</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                      abaAtiva === 'espera' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {emEspera.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAbaAtiva('andamento')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                      abaAtiva === 'andamento'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
                    }`}
                  >
                    <span>Em Andamento</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                      abaAtiva === 'andamento' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {emAndamento.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAbaAtiva('bloqueados')}
                    className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                      abaAtiva === 'bloqueados'
                        ? 'bg-gray-700 text-white shadow-2xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
                    }`}
                  >
                    <span>Concluídos / Bloqueados</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-extrabold ${
                      abaAtiva === 'bloqueados' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {bloqueadosConcluidos.length}
                    </span>
                  </button>
                </div>

                {/* Sub-cabeçalho de Seleção */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white text-xs">
                  <div>
                    <h5 className="font-bold text-gray-800">
                      {abaAtiva === 'elegiveis' && 'Destinatários Prontos para Reenvio deste Grupo'}
                      {abaAtiva === 'espera' && 'Destinatários Aguardando Janela de Tempo'}
                      {abaAtiva === 'andamento' && 'Reenvio em Processamento no Motor'}
                      {abaAtiva === 'bloqueados' && 'Destinatários Finalizados ou Bloqueados'}
                    </h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Você pode desmarcar a seleção ou excluir um contato da lista deste lote sem alterar o banco original.
                    </p>
                  </div>

                  {abaAtiva === 'elegiveis' && elegiveisAgora.length > 0 && (
                    <button
                      onClick={toggleSelecionarTudoElegiveis}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1.5 border border-teal-200 bg-white px-3 py-1.5 rounded-lg shadow-2xs transition"
                    >
                      <FontAwesomeIcon icon={selecionados.size === elegiveisAgora.length ? faCheckSquare : faSquare} />
                      {selecionados.size === elegiveisAgora.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  )}
                </div>

                {/* Tabela de Destinatários do Grupo */}
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                        <th className="p-4 w-10 text-center">Sel.</th>
                        <th className="p-4">Contato / Telefone</th>
                        <th className="p-4">Data da Falha</th>
                        <th className="p-4">Elegível Em</th>
                        <th className="p-4 text-center">Status / Tentativa</th>
                        <th className="p-4 text-center w-16">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {listaExibida.length > 0 ? (
                        listaExibida.map((item) => {
                          const isSel = selecionados.has(item.item_id);
                          return (
                            <tr
                              key={item.item_id}
                              className={`transition ${
                                item.pode_selecionar
                                  ? 'hover:bg-gray-50/50 ' + (isSel ? 'bg-teal-50/40' : '')
                                  : 'opacity-75 bg-gray-50/30'
                              }`}
                            >
                              <td className="p-4 text-center cursor-pointer" onClick={() => toggleItem(item)}>
                                {item.pode_selecionar ? (
                                  <FontAwesomeIcon
                                    icon={isSel ? faCheckSquare : faSquare}
                                    className={isSel ? 'text-teal-600 text-sm' : 'text-gray-300 text-sm'}
                                  />
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="p-4 cursor-pointer" onClick={() => toggleItem(item)}>
                                <strong className="block font-bold text-gray-800">{item.nome}</strong>
                                <span className="font-mono text-[11px] text-gray-500">{item.telefone}</span>
                              </td>
                              <td className="p-4 text-gray-500 text-[11px]">
                                {new Date(item.data_falha).toLocaleString('pt-BR')}
                              </td>
                              <td className="p-4 text-gray-700 text-[11px] font-semibold">
                                {item.elegivel_em ? new Date(item.elegivel_em).toLocaleString('pt-BR') : '—'}
                              </td>
                              <td className="p-4 text-center">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-block ${
                                  item.status_elegibilidade === 'Concluído com sucesso' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                  item.status_elegibilidade === 'Reenvio em andamento' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                  item.status_elegibilidade.includes('Elegível') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                  item.status_elegibilidade.includes('Aguardando') ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  item.status_elegibilidade === 'Requer análise' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                  'bg-gray-100 text-gray-700 border-gray-200'
                                }`}>
                                  {item.status_elegibilidade} ({item.num_tentativas_validas}/2)
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoverDestinatario(item.item_id)}
                                  title="Remover deste lote (não afeta o histórico original)"
                                  className="text-gray-400 hover:text-rose-600 p-1 rounded-lg transition"
                                >
                                  ❌
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-gray-400">
                            Nenhum destinatário nesta categoria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form de Criação Manual da Nova Campanha Derivada */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Parâmetros do Novo Lote</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selecionados.size} Selecionados
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                        Nome da Campanha Derivada
                      </label>
                      <input
                        type="text"
                        value={nomeCampanha}
                        onChange={(e) => setNomeCampanha(e.target.value)}
                        placeholder="Ex: Reenvio Ação Social - Engajamento"
                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 text-xs font-semibold text-gray-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                        Template Homologado
                      </label>
                      <input
                        type="text"
                        value={templateNome}
                        onChange={(e) => setTemplateNome(e.target.value)}
                        placeholder="Ex: modelo_institucional01"
                        className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none font-mono focus:border-teal-500 text-xs text-teal-700 font-bold"
                      />
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl space-y-2 text-[11px] text-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Campanha Origem</span>
                        <strong className="text-teal-700 font-bold">ID #{grupoSelecionado.campaign_id}</strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Modo de Criação</span>
                        <strong className="text-amber-700 font-bold">Manual sob Demanda</strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Motor de Disparos</span>
                        <strong className="text-emerald-700 font-bold">Oficial MandatoPRO</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <button
                    type="button"
                    onClick={handleCriarReenvio}
                    disabled={selecionados.size === 0 || criandoCampanha}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {criandoCampanha ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Criando Reenvio...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} />
                        Criar Lote de Reenvio ({selecionados.size} Elegíveis)
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </Layout>
    </ProtectedRoute>
  );
}



