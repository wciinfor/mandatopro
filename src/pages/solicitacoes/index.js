import { useState, useEffect, useCallback } from 'react';


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


import {


  faExclamationTriangle, faSearch, faPlus, faCheckCircle, faBan, faFileAlt,


  faUser, faMapMarkerAlt, faCalendarAlt, faTimes, faSpinner, faPaperPlane,


  faChevronLeft, faChevronRight, faInbox, faFilter


} from '@fortawesome/free-solid-svg-icons';


import Layout from '@/components/Layout';


import ProtectedRoute from '@/components/ProtectedRoute';


import Modal from '@/components/Modal';


import useModal from '@/hooks/useModal';


import { MODULES } from '@/utils/permissions';





// â”€â”€ Configurações de Status e Prioridade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


const STATUS_CONFIG = {


  NOVO:     { label: 'Novo',     bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-500'   },


  RECEBIDO: { label: 'Recebido', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' },


  ATENDIDO: { label: 'Atendido', bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-500'  },


  RECUSADO: { label: 'Recusado', bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-500'    },


};





const PRIORIDADE_CONFIG = {


  URGENTE:  { label: 'Urgente', bg: 'bg-red-500',    text: 'text-white' },


  ALTA:     { label: 'Alta',    bg: 'bg-orange-500', text: 'text-white' },


  'MÉDIA':    { label: 'Média',   bg: 'bg-yellow-500', text: 'text-white' },


  BAIXA:    { label: 'Baixa',   bg: 'bg-green-500',  text: 'text-white' },


};





const CATEGORIAS = [


  'Educação', 'Saúde', 'Infraestrutura', 'Meio Ambiente',


  'Esporte e Lazer', 'Assistência Social', 'Outros',


];





const ITENS_POR_PAGINA = 15;





// â”€â”€ Helpers de Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


function StatusBadge({ status }) {


  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOVO;


  return (


    <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>


      {cfg.label}


    </span>


  );


}





function PrioridadeBadge({ prioridade }) {


  const cfg = PRIORIDADE_CONFIG[prioridade] || PRIORIDADE_CONFIG['MÉDIA'];


  return (


    <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>


      {cfg.label}


    </span>


  );


}





// â”€â”€ Componente principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export default function Solicitacoes() {


  const { modalState, closeModal, showSuccess, showError, showConfirm } = useModal();





  // â”€â”€ Estado principal â”€â”€


  const [solicitacoes, setSolicitacoes] = useState([]);


  const [totais, setTotais] = useState({ total: 0, NOVO: 0, RECEBIDO: 0, ATENDIDO: 0, RECUSADO: 0 });


  const [loading, setLoading] = useState(true);


  const [totalRegistros, setTotalRegistros] = useState(0);


  const [pagina, setPagina] = useState(1);





  // â”€â”€ Filtros â”€â”€


  const [busca, setBusca] = useState('');


  const [statusFiltro, setStatusFiltro] = useState('');


  const [prioridadeFiltro, setPrioridadeFiltro] = useState('');


  const [categoriaFiltro, setCategoriaFiltro] = useState('');





  // â”€â”€ Modal Nova Solicitação â”€â”€


  const [showNova, setShowNova] = useState(false);


  const [salvando, setSalvando] = useState(false);


  const [formNova, setFormNova] = useState({


    titulo: '', descricao: '', solicitante: '', tipo_solicitante: 'LIDERANCA',


    categoria: '', prioridade: 'MÉDIA', municipio: '', bairro: '',


  });





  // â”€â”€ Modal Gerenciar â”€â”€


  const [solAtiva, setSolAtiva] = useState(null);


  const [obsGerenciar, setObsGerenciar] = useState('');


  const [atualizando, setAtualizando] = useState(false);





  // â”€â”€ Carregar dados â”€â”€


  const getUsuario = () => {


    if (typeof window === 'undefined') return null;


    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; }


  };

  const podeCriar = ['ADMINISTRADOR', 'LIDERANCA'].includes(getUsuario()?.nivel);





  const carregarSolicitacoes = useCallback(async () => {


    try {


      setLoading(true);


      const params = new URLSearchParams({


        limit: String(ITENS_POR_PAGINA),


        offset: String((pagina - 1) * ITENS_POR_PAGINA),


      });


      if (busca) params.set('search', busca);


      if (statusFiltro) params.set('status', statusFiltro);


      if (prioridadeFiltro) params.set('prioridade', prioridadeFiltro);


      if (categoriaFiltro) params.set('categoria', categoriaFiltro);





      const res = await fetch(`/api/solicitacoes?${params}`, {


        headers: { usuario: JSON.stringify(getUsuario()) },


      });


      const json = await res.json();


      if (!res.ok) throw new Error(json.message);


      setSolicitacoes(json.data || []);


      setTotalRegistros(json.total || 0);


      setTotais(json.totais || { total: 0, NOVO: 0, RECEBIDO: 0, ATENDIDO: 0, RECUSADO: 0 });


    } catch (err) {


      showError('Erro ao carregar solicitações: ' + err.message);


    } finally {


      setLoading(false);


    }


  }, [pagina, busca, statusFiltro, prioridadeFiltro, categoriaFiltro]);





  useEffect(() => { carregarSolicitacoes(); }, [carregarSolicitacoes]);





  // Reseta paginação ao mudar filtros


  useEffect(() => { setPagina(1); }, [busca, statusFiltro, prioridadeFiltro, categoriaFiltro]);





  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / ITENS_POR_PAGINA));





  // â”€â”€ Criar solicitação â”€â”€


  const handleCriar = async () => {


    if (!formNova.titulo || !formNova.solicitante) {


      showError('Título e Solicitante são obrigatórios.');


      return;


    }


    try {


      setSalvando(true);


      const res = await fetch('/api/solicitacoes', {


        method: 'POST',


        headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(getUsuario()) },


        body: JSON.stringify(formNova),


      });


      const json = await res.json();


      if (!res.ok) throw new Error(json.message);


      showSuccess('Solicitação criada com sucesso!');


      setShowNova(false);


      setFormNova({ titulo: '', descricao: '', solicitante: '', tipo_solicitante: 'LIDERANCA', categoria: '', prioridade: 'MÉDIA', municipio: '', bairro: '' });


      carregarSolicitacoes();


    } catch (err) {


      showError('Erro ao criar: ' + err.message);


    } finally {


      setSalvando(false);


    }


  };





  // â”€â”€ Alterar status â”€â”€


  const alterarStatus = async (id, novoStatus) => {


    try {


      setAtualizando(true);


      const res = await fetch(`/api/solicitacoes/${id}`, {


        method: 'PUT',


        headers: { 'Content-Type': 'application/json', usuario: JSON.stringify(getUsuario()) },


        body: JSON.stringify({ status: novoStatus, observacoes: obsGerenciar || undefined }),


      });


      const json = await res.json();


      if (!res.ok) throw new Error(json.message);


      showSuccess(`Status atualizado para "${STATUS_CONFIG[novoStatus]?.label}"!`);


      setSolAtiva(null);


      setObsGerenciar('');


      carregarSolicitacoes();


    } catch (err) {


      showError('Erro ao atualizar: ' + err.message);


    } finally {


      setAtualizando(false);


    }


  };





  const abrirGerenciar = (sol) => { setSolAtiva(sol); setObsGerenciar(sol.observacoes || ''); };





  return (


    <ProtectedRoute module={MODULES.SOLICITACOES}>


      <Layout titulo="Solicitações">


        {/* Modal feedback */}


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





        {/* â”€â”€ Cards de totais â”€â”€ */}


        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">


          {[


            { key: '', label: 'Total',    val: totais.total,    cor: 'border-gray-400',   bg: 'bg-gray-100',    icon: faFileAlt,            icor: 'text-gray-600'   },


            { key: 'NOVO',     label: 'Novos',    val: totais.NOVO,     cor: 'border-blue-400',   bg: 'bg-blue-100',    icon: faInbox,              icor: 'text-blue-600'   },


            { key: 'RECEBIDO', label: 'Recebidos',val: totais.RECEBIDO, cor: 'border-yellow-400', bg: 'bg-yellow-100',  icon: faCalendarAlt,        icor: 'text-yellow-600' },


            { key: 'ATENDIDO', label: 'Atendidos',val: totais.ATENDIDO, cor: 'border-green-400',  bg: 'bg-green-100',   icon: faCheckCircle,        icor: 'text-green-600'  },


            { key: 'RECUSADO', label: 'Recusados',val: totais.RECUSADO, cor: 'border-red-400',    bg: 'bg-red-100',     icon: faBan,                icor: 'text-red-600'    },


          ].map(({ key, label, val, cor, bg, icon, icor }) => (


            <div


              key={key}


              onClick={() => setStatusFiltro(prev => prev === key ? '' : key)}


              className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${cor} ${statusFiltro === key && key !== '' ? 'ring-2 ring-offset-1 ring-teal-400' : ''}`}


            >


              <div className="flex items-center gap-3">


                <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>


                  <FontAwesomeIcon icon={icon} className={`${icor} text-xl`} />


                </div>


                <div>


                  <div className="text-2xl font-bold text-gray-800">{val}</div>


                  <div className="text-sm text-gray-600">{label}</div>


                </div>


              </div>


            </div>


          ))}


        </div>





        {/* â”€â”€ Filtros e ação â”€â”€ */}


        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">


          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">


            <div className="lg:col-span-2 relative">


              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />


              <input


                type="text"


                placeholder="Buscar por título, solicitante ou protocolo..."


                value={busca}


                onChange={e => setBusca(e.target.value)}


                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"


              />


            </div>


            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}


              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">


              <option value="">Todas Categorias</option>


              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}


            </select>


            <select value={prioridadeFiltro} onChange={e => setPrioridadeFiltro(e.target.value)}


              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">


              <option value="">Todas Prioridades</option>


              <option value="URGENTE">Urgente</option>


              <option value="ALTA">Alta</option>


              <option value="MÉDIA">Média</option>


              <option value="BAIXA">Baixa</option>


            </select>


            {podeCriar && (
            <button onClick={() => setShowNova(true)}


              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 font-semibold">


              <FontAwesomeIcon icon={faPlus} /> Nova Solicitação


            </button>
            )}


          </div>





          {(statusFiltro || prioridadeFiltro || categoriaFiltro) && (


            <div className="mt-3 flex flex-wrap items-center gap-2">


              <span className="text-sm text-gray-500">Filtros ativos:</span>


              {statusFiltro && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{STATUS_CONFIG[statusFiltro]?.label}</span>}


              {prioridadeFiltro && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">{prioridadeFiltro}</span>}


              {categoriaFiltro && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">{categoriaFiltro}</span>}


              <button onClick={() => { setStatusFiltro(''); setPrioridadeFiltro(''); setCategoriaFiltro(''); }}


                className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">


                <FontAwesomeIcon icon={faTimes} /> Limpar


              </button>


            </div>


          )}


        </div>





        {/* â”€â”€ Tabela â”€â”€ */}


        <div className="bg-white rounded-lg shadow-sm overflow-hidden">


          {loading ? (


            <div className="flex items-center justify-center py-20">


              <FontAwesomeIcon icon={faSpinner} className="text-teal-600 text-3xl animate-spin" />


            </div>


          ) : (


            <div className="overflow-x-auto">


              <table className="w-full">


                <thead className="bg-gray-50 border-b">


                  <tr>


                    {['Protocolo / Título', 'Solicitante', 'Categoria', 'Local', 'Prioridade', 'Status', 'Data', 'Ações'].map(h => (


                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>


                    ))}


                  </tr>


                </thead>


                <tbody className="divide-y divide-gray-200">


                  {solicitacoes.length === 0 ? (


                    <tr>


                      <td colSpan={8} className="px-6 py-16 text-center">


                        <div className="flex flex-col items-center gap-3 text-gray-400">


                          <FontAwesomeIcon icon={faExclamationTriangle} className="text-5xl" />


                          <p className="text-lg">Nenhuma solicitação encontrada</p>


                        </div>


                      </td>


                    </tr>


                  ) : solicitacoes.map(sol => (


                    <tr key={sol.id} className="hover:bg-gray-50">


                      <td className="px-4 py-3">


                        <div className="text-sm font-semibold text-gray-800">{sol.protocolo}</div>


                        <div className="text-xs text-gray-500 max-w-xs truncate">{sol.titulo}</div>


                      </td>


                      <td className="px-4 py-3">


                        <div className="text-sm text-gray-800 flex items-center gap-1">


                          <FontAwesomeIcon icon={faUser} className="text-gray-400 text-xs" />


                          {sol.solicitante}


                        </div>


                        <div className="text-xs text-gray-500">{sol.tipo_solicitante}</div>


                      </td>


                      <td className="px-4 py-3 text-sm text-gray-700">{sol.categoria || '—'}</td>


                      <td className="px-4 py-3">


                        <div className="text-sm text-gray-800 flex items-center gap-1">


                          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-400 text-xs" />


                          {sol.municipio || '—'}


                        </div>


                        <div className="text-xs text-gray-500">{sol.bairro}</div>


                      </td>


                      <td className="px-4 py-3 whitespace-nowrap">


                        <PrioridadeBadge prioridade={sol.prioridade} />


                      </td>


                      <td className="px-4 py-3 whitespace-nowrap">


                        <StatusBadge status={sol.status} />


                      </td>


                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">


                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-1 text-gray-400" />


                        {sol.data_abertura ? new Date(sol.data_abertura).toLocaleDateString('pt-BR') : '—'}


                      </td>


                      <td className="px-4 py-3 whitespace-nowrap text-right">


                        <button


                          onClick={() => abrirGerenciar(sol)}


                          className="px-3 py-1 bg-teal-600 text-white text-xs rounded hover:bg-teal-700 font-semibold"


                        >


                          Gerenciar


                        </button>


                      </td>


                    </tr>


                  ))}


                </tbody>


              </table>


            </div>


          )}





          {/* Paginação */}


          {!loading && totalPaginas > 1 && (


            <div className="px-6 py-4 border-t flex items-center justify-between text-sm text-gray-600">


              <span>Página {pagina} de {totalPaginas} — {totalRegistros} registros</span>


              <div className="flex gap-2">


                <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}


                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40">


                  <FontAwesomeIcon icon={faChevronLeft} />


                </button>


                <button disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}


                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-40">


                  <FontAwesomeIcon icon={faChevronRight} />


                </button>


              </div>


            </div>


          )}


        </div>





        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


            MODAL — NOVA SOLICITAÇÃO


        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}


        {showNova && (


          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">


            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">


              <div className="flex items-center justify-between px-6 py-4 border-b">


                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">


                  <FontAwesomeIcon icon={faPaperPlane} className="text-teal-600" />


                  Nova Solicitação


                </h2>


                <button onClick={() => setShowNova(false)} className="text-gray-400 hover:text-gray-600">


                  <FontAwesomeIcon icon={faTimes} />


                </button>


              </div>





              <div className="p-6 space-y-4">


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


                  <div className="md:col-span-2">


                    <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>


                    <input type="text" value={formNova.titulo}


                      onChange={e => setFormNova(p => ({ ...p, titulo: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"


                      placeholder="Descreva brevemente a demanda" />


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Solicitante *</label>


                    <input type="text" value={formNova.solicitante}


                      onChange={e => setFormNova(p => ({ ...p, solicitante: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"


                      placeholder="Nome do líder / morador" />


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Solicitante</label>


                    <select value={formNova.tipo_solicitante}


                      onChange={e => setFormNova(p => ({ ...p, tipo_solicitante: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">


                      <option value="LIDERANCA">Liderança Regional</option>


                      <option value="MORADOR">Morador</option>


                      <option value="FUNCIONARIO">Funcionário</option>


                    </select>


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>


                    <select value={formNova.categoria}


                      onChange={e => setFormNova(p => ({ ...p, categoria: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">


                      <option value="">Selecione...</option>


                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}


                    </select>


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>


                    <select value={formNova.prioridade}


                      onChange={e => setFormNova(p => ({ ...p, prioridade: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">


                      <option value="URGENTE">Urgente</option>


                      <option value="ALTA">Alta</option>


                      <option value="MÉDIA">Média</option>


                      <option value="BAIXA">Baixa</option>


                    </select>


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Município</label>


                    <input type="text" value={formNova.municipio}


                      onChange={e => setFormNova(p => ({ ...p, municipio: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />


                  </div>





                  <div>


                    <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>


                    <input type="text" value={formNova.bairro}


                      onChange={e => setFormNova(p => ({ ...p, bairro: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />


                  </div>





                  <div className="md:col-span-2">


                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição detalhada</label>


                    <textarea rows={4} value={formNova.descricao}


                      onChange={e => setFormNova(p => ({ ...p, descricao: e.target.value }))}


                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"


                      placeholder="Detalhe a demanda do líder regional..." />


                  </div>


                </div>


              </div>





              <div className="px-6 py-4 border-t flex justify-end gap-3">


                <button onClick={() => setShowNova(false)}


                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">


                  Cancelar


                </button>


                <button onClick={handleCriar} disabled={salvando}


                  className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold flex items-center gap-2 disabled:opacity-60">


                  {salvando ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : <FontAwesomeIcon icon={faPaperPlane} />}


                  Registrar


                </button>


              </div>


            </div>


          </div>


        )}





        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


            MODAL — GERENCIAR SOLICITAÇÃO


        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}


        {solAtiva && (


          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">


            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">


              <div className="flex items-center justify-between px-6 py-4 border-b">


                <h2 className="text-lg font-bold text-gray-800">Gerenciar Solicitação</h2>


                <button onClick={() => setSolAtiva(null)} className="text-gray-400 hover:text-gray-600">


                  <FontAwesomeIcon icon={faTimes} />


                </button>


              </div>





              <div className="p-6 space-y-4">


                {/* Detalhes resumidos */}


                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">


                  <div className="flex items-start gap-2">


                    <span className="font-semibold text-gray-600 w-24 shrink-0">Protocolo:</span>


                    <span className="text-gray-800 font-mono">{solAtiva.protocolo}</span>


                  </div>


                  <div className="flex items-start gap-2">


                    <span className="font-semibold text-gray-600 w-24 shrink-0">Título:</span>


                    <span className="text-gray-800">{solAtiva.titulo}</span>


                  </div>


                  <div className="flex items-start gap-2">


                    <span className="font-semibold text-gray-600 w-24 shrink-0">Solicitante:</span>


                    <span className="text-gray-800">{solAtiva.solicitante}</span>


                  </div>


                  <div className="flex items-center gap-3 pt-1">


                    <PrioridadeBadge prioridade={solAtiva.prioridade} />


                    <StatusBadge status={solAtiva.status} />


                  </div>


                  {solAtiva.descricao && (


                    <p className="text-gray-600 text-xs mt-2 border-t pt-2">{solAtiva.descricao}</p>


                  )}


                </div>





                {/* Observações */}


                <div>


                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações / Resposta</label>


                  <textarea rows={3} value={obsGerenciar} onChange={e => setObsGerenciar(e.target.value)}


                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 resize-none text-sm"


                    placeholder="Adicione um comentário sobre o atendimento..." />


                </div>





                {/* Botões de ação por status */}


                <div className="space-y-2">


                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alterar status para:</p>


                  <div className="grid grid-cols-2 gap-2">


                    {solAtiva.status !== 'RECEBIDO' && (


                      <button onClick={() => alterarStatus(solAtiva.id, 'RECEBIDO')} disabled={atualizando}


                        className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 font-semibold disabled:opacity-60">


                        Marcar como Recebido


                      </button>


                    )}


                    {solAtiva.status !== 'ATENDIDO' && (


                      <button onClick={() => alterarStatus(solAtiva.id, 'ATENDIDO')} disabled={atualizando}


                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">


                        <FontAwesomeIcon icon={faCheckCircle} /> Atendido


                      </button>


                    )}


                    {solAtiva.status !== 'RECUSADO' && (


                      <button onClick={() => alterarStatus(solAtiva.id, 'RECUSADO')} disabled={atualizando}


                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-60">


                        <FontAwesomeIcon icon={faBan} /> Recusar


                      </button>


                    )}


                    {solAtiva.status !== 'NOVO' && (


                      <button onClick={() => alterarStatus(solAtiva.id, 'NOVO')} disabled={atualizando}


                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 font-semibold disabled:opacity-60">


                        Reabrir (Novo)


                      </button>


                    )}


                  </div>


                  {atualizando && (


                    <div className="text-center text-teal-600 text-sm flex items-center justify-center gap-2">


                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Salvando...


                    </div>


                  )}


                </div>


              </div>


            </div>


          </div>


        )}


      </Layout>


    </ProtectedRoute>


  );


}





