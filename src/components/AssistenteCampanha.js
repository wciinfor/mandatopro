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
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  
  const [publicoSelecionado, setPublicoSelecionado] = useState(null);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [variaveis, setVariaveis] = useState({});
  
  const [agendado, setAgendado] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');

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

  const getErrosEtapa = () => {
    if (step === 1 && !nome.trim()) return 'Insira o nome da campanha.';
    if (step === 2 && !publicoSelecionado) return 'Selecione um público destinatário.';
    
    if (step === 3) {
      if (!templateSelecionado) return 'Selecione um template.';
      if (templateSelecionado.status !== 'APPROVED') return 'O template selecionado precisa estar APROVADO pela Meta.';
    }

    if (step === 4) {
      const variaveisVazias = Object.values(variaveis).some(v => !v.trim());
      if (variaveisVazias) return 'Preencha todas as variáveis obrigatórias do template.';
    }

    if (step === 6 && agendado && !dataAgendamento) return 'Selecione data e hora para o agendamento.';
    
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
      publico: publicoSelecionado.nome,
      template: templateSelecionado.nome,
      status: agendado ? 'agendado' : 'rascunho',
      agendamento: agendado ? dataAgendamento : null,
      total_destinatarios: publicoSelecionado.quantidade_contatos,
      enviadas: 0,
      entregues: 0,
      lidas: 0,
      falhas: 0
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      
      {/* Coluna do Formulário do Assistente */}
      <div className="space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Etapa {step} de 6</span>
              <h3 className="font-bold text-gray-800 text-lg">
                {step === 1 && 'Informações da Campanha'}
                {step === 2 && 'Selecionar Público'}
                {step === 3 && 'Selecionar Template'}
                {step === 4 && 'Configurar Variáveis'}
                {step === 5 && 'Revisão da Campanha'}
                {step === 6 && 'Configurar Agendamento'}
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
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Campanha</label>
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

          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-700">Selecione o Público Alvo</label>
              {PUBLICOS_MOCK.map(pub => (
                <div
                  key={pub.id}
                  onClick={() => setPublicoSelecionado(pub)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    publicoSelecionado?.id === pub.id
                      ? 'border-teal-500 bg-teal-50/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-gray-800">{pub.nome}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Destinatários: {pub.quantidade_contatos}</p>
                  </div>
                  {publicoSelecionado?.id === pub.id && <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600" />}
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
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

          {step === 4 && (
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

          {step === 5 && (
            <div className="space-y-4 text-xs text-gray-600">
              <p className="font-semibold text-sm text-gray-800 mb-2">Resumo da Configuração:</p>
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-2">
                <p><strong>Nome:</strong> {nome}</p>
                <p><strong>Canal:</strong> {canal === 'whatsapp' ? 'WhatsApp Business Cloud API' : canal}</p>
                <p><strong>Público Destino:</strong> {publicoSelecionado?.nome} ({publicoSelecionado?.quantidade_contatos} contatos)</p>
                <p><strong>Template Meta:</strong> {templateSelecionado?.nome}</p>
                <p><strong>Status de Aprovação:</strong> Aprovado</p>
              </div>
            </div>
          )}

          {step === 6 && (
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
          
          {step < 6 ? (
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
