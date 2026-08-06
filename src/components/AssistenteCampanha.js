import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowLeft, faCheckCircle, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { TemplateVisualizerCard } from '@/components/TemplateVisualizerCard';

// Mocks locais para validação do assistente
const PUBLICOS_MOCK = [
  { id: 'pub-1', nome: 'Lideranças Centro', quantidade_contatos: 38 },
  { id: 'pub-2', nome: 'Jovens Eleitores (16-24)', quantidade_contatos: 850 }
];

const TEMPLATES_MOCK = [
  {
    id: 'tmpl-1',
    nome: 'convite_gabinete_bairro',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    status: 'APPROVED',
    canal: 'whatsapp',
    ultima_sincronizacao: new Date().toISOString(),
    componentes: [
      { type: 'HEADER', format: 'TEXT', text: '📢 Convite Especial' },
      { type: 'BODY', text: 'Olá {{1}},\n\nGostaríamos de convidar você e sua família para o nosso Gabinete Itinerante neste sábado, às 10h, na Praça Principal do bairro {{2}}.\n\nContamos com a sua presença!' },
      { type: 'FOOTER', text: 'Mandato Proativo - Canal Oficial' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver Localização' }] }
    ]
  },
  {
    id: 'tmpl-2',
    nome: 'atualizacao_solicitacao_status',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    status: 'PENDING', // Bloqueado por não estar aprovado
    canal: 'whatsapp',
    ultima_sincronizacao: new Date().toISOString(),
    componentes: [
      { type: 'BODY', text: 'Olá {{1}},\n\nInformamos que a sua solicitação nº {{2}} mudou de status para: *{{3}}*.' }
    ]
  }
];

export default function AssistenteCampanha({ onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [origemDestinatarios, setOrigemDestinatarios] = useState('campanha_politica');
  const [campanhasCRM, setCampanhasCRM] = useState([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const [pesquisaCampanha, setPesquisaCampanha] = useState('');
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);

  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  
  const [publicoSelecionado, setPublicoSelecionado] = useState(null);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [variaveis, setVariaveis] = useState({});
  
  const [agendado, setAgendado] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');

  const [destinatarios, setDestinatarios] = useState([]);
  const [resumoDestinatarios, setResumoDestinatarios] = useState(null);
  const [carregandoDestinatarios, setCarregandoDestinatarios] = useState(false);

  // Estados dos filtros locais do público
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroPossuiWhatsApp, setFiltroPossuiWhatsApp] = useState('all');

  // Filtros locais aplicados em memória sobre a base de destinatários carregada
  const destinatariosFiltrados = destinatarios.filter(d => {
    const matchBairro = !filtroBairro || (d.bairro && d.bairro.toLowerCase().includes(filtroBairro.toLowerCase()));
    const matchSexo = !filtroSexo || (d.sexo && d.sexo.toUpperCase() === filtroSexo.toUpperCase());
    const matchSituacao = !filtroSituacao || (d.situacao && d.situacao.toLowerCase().includes(filtroSituacao.toLowerCase()));
    const matchLideranca = !filtroLideranca || (d.lideranca_id && String(d.lideranca_id) === String(filtroLideranca));
    
    let matchWhatsApp = true;
    if (filtroPossuiWhatsApp === 'sim') {
      matchWhatsApp = d.status_telefone === 'valido';
    } else if (filtroPossuiWhatsApp === 'nao') {
      matchWhatsApp = d.status_telefone !== 'valido';
    }

    return matchBairro && matchSexo && matchSituacao && matchLideranca && matchWhatsApp;
  });

  const totalExcluidos = destinatarios.length - destinatariosFiltrados.length;

  const carregarCampanhasCRM = async () => {
    setCarregandoCampanhas(true);
    try {
      const res = await fetch('/api/cadastros/campanhas/ativas');
      if (res.ok) {
        const data = await res.json();
        setCampanhasCRM(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas ativas do CRM:', err);
    } finally {
      setCarregandoCampanhas(false);
    }
  };

  const carregarDestinatariosCampanha = async (campanhaId) => {
    setCarregandoDestinatarios(true);
    try {
      const res = await fetch(`/api/comunicacao-oficial/campanhas/${campanhaId}/destinatarios`);
      if (res.ok) {
        const payload = await res.json();
        setDestinatarios(payload.destinatarios || []);
        setResumoDestinatarios(payload.resumo || null);
      }
    } catch (err) {
      console.error('Erro ao carregar destinatários da campanha:', err);
    } finally {
      setCarregandoDestinatarios(false);
    }
  };

  useEffect(() => {
    carregarCampanhasCRM();
  }, []);

  useEffect(() => {
    if (campanhaSelecionada?.id) {
      carregarDestinatariosCampanha(campanhaSelecionada.id);
    } else {
      setDestinatarios([]);
      setResumoDestinatarios(null);
    }
  }, [campanhaSelecionada]);

  // Identifica variáveis presentes no template de forma dinâmica (procura por {{N}})
  useEffect(() => {
    if (templateSelecionado) {
      const body = templateSelecionado.componentes.find(c => c.type === 'BODY')?.text || '';
      const matches = body.match(/\{\{\d+\}\}/g) || [];
      const keys = [...new Set(matches.map(m => m.replace(/[\{\}]/g, '')))];
      
      const defaultVars = {};
      keys.forEach(k => {
        defaultVars[k] = '';
      });
      setVariaveis(defaultVars);
    } else {
      setVariaveis({});
    }
  }, [templateSelecionado]);

  // Gera uma versão do template com os valores das variáveis inseridos para visualização em tempo real
  const getTemplateComVariaveis = () => {
    if (!templateSelecionado) return null;
    
    return {
      ...templateSelecionado,
      componentes: templateSelecionado.componentes.map(comp => {
        if (comp.type === 'BODY') {
          let text = comp.text;
          Object.entries(variaveis).forEach(([key, val]) => {
            text = text.replace(`{{${key}}}`, val || `[Variável ${key}]`);
          });
          return { ...comp, text };
        }
        return comp;
      })
    };
  };

  // Ajusta dinamicamente a numeração máxima de etapas de acordo com o fluxo escolhido
  const totalSteps = origemDestinatarios === 'campanha_politica' ? 8 : 7;

  // Lógica de mapeamento de etapas sequenciais para evitar if complexos no render
  const getErrosEtapa = () => {
    if (step === 1) return null;
    
    if (origemDestinatarios === 'campanha_politica') {
      if (step === 2 && !campanhaSelecionada) return 'Selecione uma Campanha Política do CRM.';
      if (step === 3 && !nome.trim()) return 'Insira o nome do disparo.';
      if (step === 4 && destinatarios.length === 0) return 'A campanha selecionada não possui destinatários válidos.';
      if (step === 5) {
        if (!templateSelecionado) return 'Selecione um template.';
        if (templateSelecionado.status !== 'APPROVED') return 'O template selecionado precisa estar APROVADO pela Meta.';
      }
      if (step === 6) {
        const variaveisVazias = Object.values(variaveis).some(v => !v.trim());
        if (variaveisVazias) return 'Preencha todas as variáveis obrigatórias do template.';
      }
      if (step === 8 && agendado && !dataAgendamento) return 'Selecione data e hora para o agendamento.';
    } else {
      // Fluxo CSV
      if (step === 2 && !nome.trim()) return 'Insira o nome do disparo.';
      // Passo 3 é o Upload do CSV que nesta etapa é simulado
      if (step === 4) {
        if (!templateSelecionado) return 'Selecione um template.';
        if (templateSelecionado.status !== 'APPROVED') return 'O template selecionado precisa estar APROVADO pela Meta.';
      }
      if (step === 5) {
        const variaveisVazias = Object.values(variaveis).some(v => !v.trim());
        if (variaveisVazias) return 'Preencha todas as variáveis obrigatórias do template.';
      }
      if (step === 7 && agendado && !dataAgendamento) return 'Selecione data e hora para o agendamento.';
    }
    
    return null;
  };

  const erroAtual = getErrosEtapa();

  const handleProximo = () => {
    if (erroAtual) return;
    setStep(prev => prev + 1);
  };

  const handleSalvar = () => {
    if (erroAtual) return;
    onSave({
      nome,
      canal,
      origemDestinatarios,
      publico: origemDestinatarios === 'campanha_politica' 
        ? `${campanhaSelecionada.nome} - Público Filtrado`
        : 'Upload de Lista CSV',
      template: templateSelecionado.nome,
      status: agendado ? 'agendado' : 'rascunho',
      agendamento: agendado ? dataAgendamento : null,
      total_destinatarios: origemDestinatarios === 'campanha_politica' ? destinatariosFiltrados.length : 0,
      campaign_id: campanhaSelecionada?.id || null,
      destinatarios: origemDestinatarios === 'campanha_politica' ? destinatariosFiltrados : [],
      enviadas: 0,
      entregues: 0,
      lidas: 0,
      falhas: 0
    });
  };

  // Filtra campanhas com base no termo digitado
  const campanhasFiltradas = campanhasCRM.filter(c =>
    c.nome.toLowerCase().includes(pesquisaCampanha.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      
      {/* Coluna do Formulário do Assistente */}
      <div className="space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Etapa {step} de {totalSteps}</span>
              <h3 className="font-bold text-gray-800 text-lg">
                {step === 1 && 'Origem dos Destinatários'}
                
                {/* Títulos do fluxo com Campanha */}
                {origemDestinatarios === 'campanha_politica' && (
                  <>
                    {step === 2 && 'Selecionar Campanha do CRM'}
                    {step === 3 && 'Informações do Disparo'}
                    {step === 4 && 'Selecionar Público'}
                    {step === 5 && 'Selecionar Template'}
                    {step === 6 && 'Configurar Variáveis'}
                    {step === 7 && 'Revisão da Comunicação'}
                    {step === 8 && 'Configurar Agendamento'}
                  </>
                )}

                {/* Títulos do fluxo com CSV */}
                {origemDestinatarios === 'csv' && (
                  <>
                    {step === 2 && 'Informações do Disparo'}
                    {step === 3 && 'Importar arquivo CSV'}
                    {step === 4 && 'Selecionar Template'}
                    {step === 5 && 'Configurar Variáveis'}
                    {step === 6 && 'Revisão da Comunicação'}
                    {step === 7 && 'Configurar Agendamento'}
                  </>
                )}
              </h3>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xs">Cancelar</button>
          </div>

          {/* Erros de Validação da Etapa */}
          {erroAtual && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg font-medium">
              ⚠️ {erroAtual}
            </div>
          )}

          {/* CONTEÚDO DAS ETAPAS */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Selecione a origem dos contatos para envio:</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-teal-400 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="origemDestinatarios"
                    value="campanha_politica"
                    checked={origemDestinatarios === 'campanha_politica'}
                    onChange={() => setOrigemDestinatarios('campanha_politica')}
                    className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <div>
                    <p className="font-bold text-xs text-gray-800">Campanha Política</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Destinar o envio a um grupo ou público de eleitores cadastrado.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-teal-400 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="origemDestinatarios"
                    value="csv"
                    checked={origemDestinatarios === 'csv'}
                    onChange={() => setOrigemDestinatarios('csv')}
                    className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <div>
                    <p className="font-bold text-xs text-gray-800">Importar arquivo CSV</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Fazer upload de planilha externa com novos contatos.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && origemDestinatarios === 'campanha_politica' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Selecione uma Campanha Política do CRM</label>
              <input
                type="text"
                value={pesquisaCampanha}
                onChange={(e) => setPesquisaCampanha(e.target.value)}
                placeholder="Pesquisar campanha por nome..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 mb-2"
              />
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {carregandoCampanhas ? (
                  <p className="text-center py-4 text-xs text-gray-400">Carregando campanhas...</p>
                ) : campanhasFiltradas.length > 0 ? (
                  campanhasFiltradas.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setCampanhaSelecionada(c)}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                        campanhaSelecionada?.id === c.id
                          ? 'border-teal-500 bg-teal-50/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-gray-800">{c.nome}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Status: {c.status} · Data: {new Date(c.data_campanha).toLocaleDateString('pt-BR')}</p>
                      </div>
                      {campanhaSelecionada?.id === c.id && <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600" />}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-xs text-gray-400">Nenhuma campanha ativa localizada.</p>
                )}
              </div>
            </div>
          )}

          {/* Nome e Canal de Disparo */}
          {((step === 2 && origemDestinatarios === 'csv') || (step === 3 && origemDestinatarios === 'campanha_politica')) && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Disparo / Comunicação</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Informativo Geral IPTU"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Canal de Disparo</label>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm focus:outline-none"
                >
                  <option value="whatsapp">WhatsApp Business Oficial (Meta)</option>
                </select>
              </div>
            </div>
          )}

          {/* Resumo dos Destinatários no fluxo de Campanha com Filtros locais */}
          {step === 4 && origemDestinatarios === 'campanha_politica' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Filtros Opcionais de Segmentação</label>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bairro</label>
                  <input
                    type="text"
                    value={filtroBairro}
                    onChange={(e) => setFiltroBairro(e.target.value)}
                    placeholder="Filtrar por bairro..."
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sexo</label>
                  <select
                    value={filtroSexo}
                    onChange={(e) => setFiltroSexo(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situação</label>
                  <input
                    type="text"
                    value={filtroSituacao}
                    onChange={(e) => setFiltroSituacao(e.target.value)}
                    placeholder="Ex: Regular"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">WhatsApp</label>
                  <select
                    value={filtroPossuiWhatsApp}
                    onChange={(e) => setFiltroPossuiWhatsApp(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="sim">Apenas com WhatsApp</option>
                    <option value="nao">Sem WhatsApp válido</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 mt-3">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Painel de Conferência de Destinatários</label>
                {carregandoDestinatarios ? (
                  <p className="text-center py-4 text-xs text-gray-400">Filtrando contatos...</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block">Total Carregado</span>
                      <p className="text-lg font-bold text-gray-800 mt-0.5">{destinatarios.length}</p>
                    </div>
                    <div className="bg-teal-50 border border-teal-100 p-3 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-teal-600 block">Aptos para Envio</span>
                      <p className="text-lg font-bold text-teal-800 mt-0.5">{destinatariosFiltrados.length}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-rose-600 block">Excluídos Filtro</span>
                      <p className="text-lg font-bold text-rose-800 mt-0.5">{totalExcluidos}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Importar arquivo CSV */}
          {step === 3 && origemDestinatarios === 'csv' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Fazer Upload de arquivo CSV</label>
              <div className="border-2 border-dashed border-gray-200 hover:border-teal-400 rounded-xl p-8 text-center cursor-pointer transition">
                <p className="text-sm font-semibold text-gray-700">Arraste ou clique para selecionar arquivo</p>
                <p className="text-[10px] text-gray-400 mt-1">Formato suportado: .csv (máximo 5MB)</p>
              </div>
            </div>
          )}

          {/* Selecionar Template */}
          {((step === 4 && origemDestinatarios === 'csv') || (step === 5 && origemDestinatarios === 'campanha_politica')) && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-700">Selecione o Template Oficial</label>
              {TEMPLATES_MOCK.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => setTemplateSelecionado(tmpl)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    templateSelecionado?.id === tmpl.id
                      ? 'border-teal-500 bg-teal-50/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-gray-800">{tmpl.nome}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Idioma: {tmpl.idioma} · Status: <span className={tmpl.status === 'APPROVED' ? 'text-green-600 font-bold' : 'text-amber-600'}>{tmpl.status}</span></p>
                  </div>
                  {templateSelecionado?.id === tmpl.id && <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600" />}
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Preencha as Variáveis do Template</label>
              {Object.keys(variaveis).map(varKey => (
                <div key={varKey}>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Variável {`{{${varKey}}}`}</label>
                  <input
                    type="text"
                    value={variaveis[varKey]}
                    onChange={(e) => setVariaveis({ ...variaveis, [varKey]: e.target.value })}
                    placeholder={`Valor para {{${varKey}}}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 text-xs text-gray-600">
              <p className="font-semibold text-sm text-gray-800 mb-2">Resumo da Configuração:</p>
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-2">
                <p><strong>Nome:</strong> {nome}</p>
                <p><strong>Canal:</strong> {canal === 'whatsapp' ? 'WhatsApp Business Cloud API' : canal}</p>
                <p><strong>Origem contatos:</strong> {origemDestinatarios === 'campanha_politica' ? 'Campanha Política' : 'Importação CSV'}</p>
                <p><strong>Público Destino:</strong> {origemDestinatarios === 'campanha_politica' ? (publicoSelecionado?.nome || 'Não selecionado') : 'Upload de Lista CSV'}</p>
                <p><strong>Template Meta:</strong> {templateSelecionado?.nome || 'Nenhum selecionado'}</p>
                <p><strong>Status de Aprovação:</strong> Aprovado</p>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="agendadoCheck"
                  checked={agendado}
                  onChange={(e) => setAgendado(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="agendadoCheck" className="text-xs font-semibold text-gray-700">Agendar disparo para depois?</label>
              </div>

              {agendado && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Data e Hora de Disparo</label>
                  <input
                    type="datetime-local"
                    value={dataAgendamento}
                    onChange={(e) => setDataAgendamento(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de Ações do Assistente */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
          <button
            disabled={step === 1}
            onClick={() => setStep(prev => prev - 1)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            <FontAwesomeIcon icon={faArrowLeft} /> Voltar
          </button>
          
          {step < 7 ? (
            <button
              onClick={handleProximo}
              disabled={Boolean(erroAtual)}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              Próximo <FontAwesomeIcon icon={faArrowRight} />
            </button>
          ) : (
            <button
              onClick={handleSalvar}
              disabled={Boolean(erroAtual)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              Finalizar Criação <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          )}
        </div>
      </div>

      {/* Coluna da Prévia em Tempo Real */}
      <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Prévia em Tempo Real (WhatsApp)</h4>
          {templateSelecionado ? (
            <TemplateVisualizerCard template={getTemplateComVariaveis()} />
          ) : (
            <div className="text-center py-20 text-gray-400 text-xs">
              Selecione um template oficial para visualizar a prévia do balão.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
