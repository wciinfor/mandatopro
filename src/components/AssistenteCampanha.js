import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faArrowLeft,
  faCheckCircle,
  faPaperPlane,
  faSpinner,
  faUsers,
  faUserCheck,
  faUserTimes,
  faDatabase,
  faExclamationTriangle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { TemplateVisualizerCard } from '@/components/TemplateVisualizerCard';

export default function AssistenteCampanha({ onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [origemDestinatarios, setOrigemDestinatarios] = useState('campanha_politica');
  const [campanhasCRM, setCampanhasCRM] = useState([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const [pesquisaCampanha, setPesquisaCampanha] = useState('');
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);

  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [erroAlerta, setErroAlerta] = useState(null);
  
  const [publicoSelecionado, setPublicoSelecionado] = useState(null);
  const [templateSelecionado, setTemplateSelecionado] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [erroTemplates, setErroTemplates] = useState(null);
  const [variaveis, setVariaveis] = useState({});
  
  const [agendado, setAgendado] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');

  const [destinatarios, setDestinatarios] = useState([]);
  const [resumoDestinatarios, setResumoDestinatarios] = useState(null);
  const [carregandoDestinatarios, setCarregandoDestinatarios] = useState(false);

  // Estados dos filtros da Base MandatoPRO
  const [mandatoOrigem, setMandatoOrigem] = useState('eleitores');
  const [mandatoCampanhaId, setMandatoCampanhaId] = useState('');
  const [mandatoPresencaCampanha, setMandatoPresencaCampanha] = useState('');
  
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroPossuiWhatsApp, setFiltroPossuiWhatsApp] = useState('sim');
  const [mandatoLimite, setMandatoLimite] = useState(1000);

  const [contatosReais, setContatosReais] = useState([]);
  const [resumoBackend, setResumoBackend] = useState({ total: 0, validos: 0, invalidos: 0, duplicados: 0 });
  const [carregandoContatos, setCarregandoContatos] = useState(false);
  const [erroContatos, setErroContatos] = useState(null);

  const [contaOficial, setContaOficial] = useState(null);
  const [carregandoContaOficial, setCarregandoContaOficial] = useState(false);

  // Carrega configuração da conta oficial de WhatsApp ativa no tenant (YCloud / Meta)
  const carregarContaOficial = async () => {
    setCarregandoContaOficial(true);
    try {
      const res = await fetch('/api/whatsapp-business/config');
      if (res.ok) {
        const data = await res.json();
        setContaOficial(data);
      }
    } catch (err) {
      console.warn('Aviso ao consultar conta WhatsApp oficial:', err?.message);
    } finally {
      setCarregandoContaOficial(false);
    }
  };

  // Carrega templates aprovados reais via API oficial da conta WhatsApp ativa (YCloud / Meta)
  const carregarTemplatesReais = async () => {
    setCarregandoTemplates(true);
    setErroTemplates(null);
    try {
      const res = await fetch('/api/whatsapp-business/templates');
      if (!res.ok) {
        throw new Error('Falha ao consultar templates da conta WhatsApp ativa.');
      }
      const data = await res.json();
      const lista = (data.templates || data.data || (Array.isArray(data) ? data : []))
        .filter(t => String(t.status || '').toUpperCase() === 'APPROVED');
      setTemplates(lista);
      if (templateSelecionado && !lista.some(t => (t.id === templateSelecionado.id || t.nome === templateSelecionado.nome))) {
        setTemplateSelecionado(null);
      }
    } catch (err) {
      console.error('Erro ao carregar templates oficiais:', err);
      setErroTemplates(err.message || 'Erro ao carregar templates homologados.');
      setTemplates([]);
    } finally {
      setCarregandoTemplates(false);
    }
  };

  useEffect(() => {
    carregarContaOficial();
    carregarTemplatesReais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega a lista de campanhas para o select através da API real existente
  const carregarCampanhasCRM = async () => {
    setCarregandoCampanhas(true);
    try {
      const res = await fetch('/api/disparos/contatos/campanhas?limit=200');
      if (res.ok) {
        const payload = await res.json();
        setCampanhasCRM(payload.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas para disparo:', err);
    } finally {
      setCarregandoCampanhas(false);
    }
  };

  useEffect(() => {
    carregarCampanhasCRM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza contatos e resumo com debouncing via GET /api/disparos/contatos/preview
  useEffect(() => {
    if (origemDestinatarios !== 'campanha_politica') return;

    let active = true;
    setCarregandoContatos(true);
    setErroContatos(null);

    const timer = setTimeout(async () => {
      try {
        const baseParams = {
          origem: mandatoOrigem,
          cidade: filtroCidade,
          bairro: filtroBairro,
          status: filtroSituacao,
          limit: String(mandatoLimite),
          campanhaId: mandatoCampanhaId,
          presencaCampanha: mandatoPresencaCampanha
        };

        // 1. Busca os contatos da lista para o preview
        const paramsPreview = new URLSearchParams(baseParams);
        const res = await fetch(`/api/disparos/contatos/preview?${paramsPreview.toString()}`);
        if (!res.ok) throw new Error('Falha ao calcular contatos da base.');
        const payload = await res.json();

        // 2. Busca também a contagem exata otimizada via countOnly=true
        const paramsCount = new URLSearchParams({ ...baseParams, countOnly: 'true' });
        const resCount = await fetch(`/api/disparos/contatos/preview?${paramsCount.toString()}`);
        const payloadCount = resCount.ok ? await resCount.json() : null;

        if (active) {
          const lista = payload.data || [];
          setContatosReais(lista);
          setResumoBackend({
            total: payloadCount?.resumo?.total ?? payload.resumo?.total ?? lista.length,
            validos: payload.resumo?.validos ?? lista.filter(c => c.valido).length,
            invalidos: payload.resumo?.invalidos ?? lista.filter(c => !c.valido).length,
            duplicados: payload.resumo?.duplicados ?? lista.filter(c => c.duplicado).length
          });
        }
      } catch (err) {
        if (active) {
          console.error('Erro ao buscar preview de contatos:', err);
          setErroContatos(err.message);
        }
      } finally {
        if (active) setCarregandoContatos(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [origemDestinatarios, mandatoOrigem, mandatoCampanhaId, mandatoPresencaCampanha, filtroCidade, filtroBairro, filtroSituacao, mandatoLimite]);

  // Alinhamento direto dos contatos retornados pela API oficial (apenas com c.valido === true)
  const destinatariosFiltrados = contatosReais.filter(c => c.valido === true);
  
  // Computa o detalhamento exato dos registros excluídos com base na amostragem real e no resumo do backend
  const detalhesExcluidos = (() => {
    let semTelefone = 0;
    let invalidos = 0;
    let duplicados = 0;

    contatosReais.forEach(c => {
      if (!c.valido) {
        if (c.duplicado || c.motivoInvalido === 'Telefone duplicado') {
          duplicados++;
        } else if (!c.telefoneOriginal || c.motivoInvalido === 'Telefone ausente ou incompleto') {
          semTelefone++;
        } else {
          invalidos++;
        }
      }
    });

    const totalCalculadoPelaAmostra = semTelefone + invalidos + duplicados;
    const totalEncontrados = Number.isFinite(Number(resumoBackend.total)) && Number(resumoBackend.total) > 0
      ? Number(resumoBackend.total)
      : contatosReais.length;

    const totalExcluidos = Math.max(totalEncontrados - destinatariosFiltrados.length, totalCalculadoPelaAmostra);

    return {
      totalEncontrados,
      semTelefone,
      invalidos,
      duplicados,
      totalExcluidos
    };
  })();

  // Identifica variáveis presentes no template de forma dinâmica (procura por {{N}} no BODY e HEADER)
  useEffect(() => {
    if (templateSelecionado && Array.isArray(templateSelecionado.componentes)) {
      const bodyComp = templateSelecionado.componentes.find(c => String(c.type || '').toUpperCase() === 'BODY');
      const headerComp = templateSelecionado.componentes.find(c => String(c.type || '').toUpperCase() === 'HEADER');
      const textToScan = `${headerComp?.text || ''} ${bodyComp?.text || ''}`;

      const matches = textToScan.match(/\{\{\d+\}\}/g) || [];
      const keys = [...new Set(matches.map(m => m.replace(/[\{\}]/g, '')))].sort((a, b) => Number(a) - Number(b));

      const nomesServicos = Array.isArray(campanhaSelecionada?.campanhas_servicos)
        ? campanhaSelecionada.campanhas_servicos
            .map(cs => cs?.categorias_servicos?.nome || cs?.nome_servico)
            .filter(Boolean)
        : [];
      const beneficioPrincipal = nomesServicos.length > 0
        ? nomesServicos.join(', ')
        : (campanhaSelecionada?.descricao || campanhaSelecionada?.nome || '{beneficio}');

      const beneficioSugerido = beneficioPrincipal;
      const dataEntregaSugerida = campanhaSelecionada?.data_entrega || '{data_entrega}';
      const localEntregaSugerido = campanhaSelecionada?.local_entrega || '{local_entrega}';

      setVariaveis(prev => {
        const nextVars = {};
        keys.forEach(k => {
          if (prev[k] !== undefined && prev[k] !== '') {
            nextVars[k] = prev[k];
          } else if (k === '1') {
            nextVars[k] = '{nome}';
          } else if (k === '2') {
            nextVars[k] = campanhaSelecionada ? beneficioSugerido : '';
          } else if (k === '3') {
            nextVars[k] = campanhaSelecionada ? dataEntregaSugerida : '';
          } else if (k === '4') {
            nextVars[k] = campanhaSelecionada ? localEntregaSugerido : '';
          } else {
            nextVars[k] = '';
          }
        });
        return nextVars;
      });
    } else {
      setVariaveis({});
    }
  }, [templateSelecionado, campanhaSelecionada]);

  // Gera uma versão do template com os valores das variáveis inseridos para visualização em tempo real
  const getTemplateComVariaveis = () => {
    if (!templateSelecionado) return null;

    const exemploNome = destinatariosFiltrados[0]?.nome || 'João da Silva';
    const exemploCidade = destinatariosFiltrados[0]?.cidade || destinatariosFiltrados[0]?.municipio || 'Belém';
    const exemploBairro = destinatariosFiltrados[0]?.bairro || 'Centro';
    const nomesServicosExemplo = Array.isArray(campanhaSelecionada?.campanhas_servicos)
      ? campanhaSelecionada.campanhas_servicos
          .map(cs => cs?.categorias_servicos?.nome || cs?.nome_servico)
          .filter(Boolean)
      : [];
    const exemploBeneficio = nomesServicosExemplo.length > 0
      ? nomesServicosExemplo.join(', ')
      : (campanhaSelecionada?.descricao || campanhaSelecionada?.nome || 'Ação Social');
    const exemploDataEntrega = campanhaSelecionada?.data_entrega || '10/10/2026 às 09:00';
    const exemploLocalEntrega = campanhaSelecionada?.local_entrega || 'Sede Central';

    return {
      ...templateSelecionado,
      componentes: (templateSelecionado.componentes || []).map(comp => {
        const typeUpper = String(comp.type || '').toUpperCase();
        if (typeUpper === 'BODY' || typeUpper === 'HEADER') {
          let text = comp.text || '';
          Object.entries(variaveis).forEach(([key, val]) => {
            const rawVal = String(val || '').trim();
            let valorExibicao = rawVal;
            if (valorExibicao) {
              valorExibicao = valorExibicao
                .replace(/\{nome\}/gi, exemploNome)
                .replace(/\{cidade\}/gi, exemploCidade)
                .replace(/\{bairro\}/gi, exemploBairro)
                .replace(/\{beneficio\}/gi, exemploBeneficio)
                .replace(/\{data_entrega\}/gi, exemploDataEntrega)
                .replace(/\{local_entrega\}/gi, exemploLocalEntrega);
            } else {
              valorExibicao = `[Variável {{${key}}}]`;
            }
            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), valorExibicao);
          });
          return { ...comp, text };
        }
        return comp;
      })
    };
  };

  // Total de 7 etapas estruturadas no fluxo oficial
  const totalSteps = 7;

  // Lógica de mapeamento de etapas sequenciais para validação guiada
  const getErrosEtapa = () => {
    if (step === 1) return null;
    
    if (origemDestinatarios === 'campanha_politica') {
      if (step === 2 && !nome.trim()) return 'Insira o nome do disparo.';
      if (step === 3) {
        if (carregandoContatos) return 'Aguarde o cálculo e validação dos contatos da base.';
        if (destinatariosFiltrados.length === 0) return 'A base selecionada não retornou destinatários aptos para envio.';
      }
      if (step === 4) {
        if (!templateSelecionado) return 'Selecione um template oficial homologado.';
        if (String(templateSelecionado.status || '').toUpperCase() !== 'APPROVED') return 'O template selecionado precisa estar no status APROVADO.';
      }
      if (step === 5) {
        const chaves = Object.keys(variaveis).sort((a, b) => Number(a) - Number(b));
        for (const k of chaves) {
          if (!String(variaveis[k] || '').trim()) {
            return `Preencha a variável obrigatória {{${k}}} do template.`;
          }
        }
      }
      if (step >= 6) {
        if (destinatariosFiltrados.length === 0) return 'A lista não possui destinatários aptos para disparo.';
        if (!templateSelecionado || String(templateSelecionado.status || '').toUpperCase() !== 'APPROVED') {
          return 'Selecione um template oficial homologado e aprovado.';
        }
        const chaves = Object.keys(variaveis).sort((a, b) => Number(a) - Number(b));
        for (const k of chaves) {
          if (!String(variaveis[k] || '').trim()) {
            return `Preencha a variável obrigatória {{${k}}} do template.`;
          }
        }
      }
      if (step === 7 && agendado && !dataAgendamento) return 'Selecione data e hora para o agendamento.';
    } else {
      // Fluxo CSV
      if (step === 2 && !nome.trim()) return 'Insira o nome do disparo.';
      if (step === 4) {
        if (!templateSelecionado) return 'Selecione um template oficial homologado.';
        if (String(templateSelecionado.status || '').toUpperCase() !== 'APPROVED') return 'O template selecionado precisa estar no status APROVADO.';
      }
      if (step === 5) {
        const chaves = Object.keys(variaveis).sort((a, b) => Number(a) - Number(b));
        for (const k of chaves) {
          if (!String(variaveis[k] || '').trim()) {
            return `Preencha a variável obrigatória {{${k}}} do template.`;
          }
        }
      }
      if (step === 7 && agendado && !dataAgendamento) return 'Selecione data e hora para o agendamento.';
    }
    
    return null;
  };

  const erroAtual = getErrosEtapa();

  const handleProximo = () => {
    const erro = getErrosEtapa();
    if (erro) {
      setErroAlerta(erro);
      return;
    }
    setErroAlerta(null);
    setStep(prev => prev + 1);
  };

  const handleSalvar = () => {
    const erro = getErrosEtapa();
    if (erro) {
      setErroAlerta(erro);
      return;
    }

    const listaFinal = origemDestinatarios === 'campanha_politica'
      ? destinatariosFiltrados.map(c => ({
          id: c.origemId || c.id,
          nome: c.nome || 'Contato',
          telefone_limpo: c.telefoneNormalizado || c.phone,
          telefone_original: c.telefoneOriginal || c.phone
        }))
      : [];

    onSave({
      nome,
      canal,
      origemDestinatarios,
      publico: origemDestinatarios === 'campanha_politica' 
        ? `Base ${mandatoOrigem.toUpperCase()} - ${destinatariosFiltrados.length} contatos`
        : 'Upload de Lista CSV',
      template: templateSelecionado.nome,
      template_id: templateSelecionado.id || templateSelecionado.nome,
      idioma: templateSelecionado.idioma || 'pt_BR',
      variaveis: variaveis,
      status: agendado ? 'agendado' : 'rascunho',
      agendamento: agendado ? dataAgendamento : null,
      total_destinatarios: origemDestinatarios === 'campanha_politica' ? destinatariosFiltrados.length : 0,
      campaign_id: mandatoCampanhaId || null,
      destinatarios: listaFinal,
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
                
                {/* Títulos do fluxo com Campanha / Base MandatoPRO */}
                {origemDestinatarios === 'campanha_politica' && (
                  <>
                    {step === 2 && 'Informações do Disparo'}
                    {step === 3 && 'Selecionar Público da Base MandatoPRO'}
                    {step === 4 && 'Selecionar Template'}
                    {step === 5 && 'Configurar Variáveis'}
                    {step === 6 && 'Revisão da Comunicação'}
                    {step === 7 && 'Configurar Agendamento'}
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
          {erroAlerta && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg font-medium">
              ⚠️ {erroAlerta}
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
                    onChange={() => {
                      setOrigemDestinatarios('campanha_politica');
                      setErroAlerta(null);
                    }}
                    className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <div>
                    <p className="font-bold text-xs text-gray-800">Base de Dados</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Destinar o envio a um grupo ou público de eleitores cadastrado.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-teal-400 cursor-pointer transition select-none">
                  <input
                    type="radio"
                    name="origemDestinatarios"
                    value="csv"
                    checked={origemDestinatarios === 'csv'}
                    onChange={() => {
                      setOrigemDestinatarios('csv');
                      setErroAlerta(null);
                    }}
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

          {/* Informações do Disparo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nome do Disparo / Comunicação <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (erroAlerta) setErroAlerta(null);
                  }}
                  placeholder="Ex: Informativo Geral / Ação de Atendimento"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Digite um nome descritivo ou selecione uma campanha do CRM abaixo para preencher automaticamente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Canal de Disparo</label>
                <select
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-sm focus:outline-none"
                >
                  <option value="whatsapp">
                    {(() => {
                      const prov = String(contaOficial?.provider || '').toUpperCase();
                      if (prov === 'WABLAST') return 'WhatsApp Business Oficial (WaBlast)';
                      if (prov === 'YCLOUD') return 'WhatsApp Business Oficial (YCloud)';
                      if (prov === 'META') return 'WhatsApp Business Oficial (Meta Cloud API)';
                      return 'WhatsApp Business Oficial (YCloud / Meta / WaBlast)';
                    })()}
                  </option>
                </select>
              </div>

              {/* Seleção de Campanha do CRM (opcional para preencher nome e vincular) */}
              {origemDestinatarios === 'campanha_politica' && (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700">
                      Vincular a uma Campanha / Ação do CRM <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    {campanhaSelecionada && (
                      <button
                        type="button"
                        onClick={() => {
                          setCampanhaSelecionada(null);
                          setMandatoCampanhaId('');
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Limpar Vínculo
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={pesquisaCampanha}
                    onChange={(e) => setPesquisaCampanha(e.target.value)}
                    placeholder="Pesquisar campanha do CRM..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {carregandoCampanhas ? (
                      <p className="text-center py-4 text-xs text-gray-400">Carregando campanhas...</p>
                    ) : campanhasFiltradas.length > 0 ? (
                      campanhasFiltradas.map(c => {
                        const isSelected = campanhaSelecionada?.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              if (isSelected) {
                                setCampanhaSelecionada(null);
                                setMandatoCampanhaId('');
                              } else {
                                setCampanhaSelecionada(c);
                                setMandatoCampanhaId(c.id);
                                if (!nome.trim() || campanhasCRM.some(prev => prev.nome === nome)) {
                                  setNome(c.nome);
                                }
                              }
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50/20 shadow-xs'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-gray-800">{c.nome}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Status: {c.status} {c.data_campanha ? `· Data: ${new Date(c.data_campanha).toLocaleDateString('pt-BR')}` : ''}
                              </p>
                            </div>
                            {isSelected && <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600 text-sm" />}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-4 text-xs text-gray-400">Nenhuma campanha cadastrada no CRM.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumo dos Destinatários na Base do MandatoPRO com Filtros Reais */}
          {step === 3 && origemDestinatarios === 'campanha_politica' && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-700">Filtros da Base do MandatoPRO</label>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Origem</label>
                  <select
                    value={mandatoOrigem}
                    onChange={(e) => setMandatoOrigem(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none"
                  >
                    <option value="eleitores">Eleitores</option>
                    <option value="liderancas">Lideranças</option>
                    <option value="funcionarios">Funcionários</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Campanha</label>
                  <select
                    value={mandatoCampanhaId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setMandatoCampanhaId(newId);
                      setCampanhaSelecionada(campanhasCRM.find(c => c.id === newId) || null);
                    }}
                    disabled={mandatoOrigem !== 'eleitores'}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Todas as campanhas</option>
                    {campanhasCRM.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Presença</label>
                  <select
                    value={mandatoPresencaCampanha}
                    onChange={(e) => setMandatoPresencaCampanha(e.target.value)}
                    disabled={mandatoOrigem !== 'eleitores' || !mandatoCampanhaId}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Todos</option>
                    <option value="presentes">Presentes na campanha</option>
                    <option value="ausentes">Ausentes na campanha</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Limite Máximo</label>
                  <input
                    type="number"
                    value={mandatoLimite}
                    onChange={(e) => setMandatoLimite(e.target.value)}
                    min="1"
                    max="50000"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cidade</label>
                  <input
                    type="text"
                    value={filtroCidade}
                    onChange={(e) => setFiltroCidade(e.target.value)}
                    placeholder="Filtrar por cidade..."
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none"
                  />
                </div>

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
              </div>

              <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    Amostra de Destinatários Aptos
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {destinatariosFiltrados.length} contato(s) no total
                  </span>
                </div>

                {carregandoContatos ? (
                  <div className="py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-teal-600" />
                    <span>Filtrando e validando base...</span>
                  </div>
                ) : destinatariosFiltrados.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {destinatariosFiltrados.slice(0, 5).map((contato, idx) => (
                      <div
                        key={contato.id || idx}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between text-[11px]"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-gray-800 truncate">{contato.nome || 'Sem Nome'}</p>
                          <p className="text-[10px] text-gray-400">
                            {contato.cidade || contato.municipio || 'Cidade não informada'} {contato.bairro ? `· ${contato.bairro}` : ''}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 shrink-0">
                          {contato.telefoneNormalizado || contato.phone || contato.telefone}
                        </span>
                      </div>
                    ))}
                    {destinatariosFiltrados.length > 5 && (
                      <p className="text-center text-[10px] text-gray-400 pt-1">
                        + {destinatariosFiltrados.length - 5} contatos aptos adicionais serão incluídos no disparo.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                    Nenhum destinatário apto com os filtros selecionados.
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

          {/* Selecionar Template Oficial */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">Selecione o Template Oficial Homologado</label>
                <button
                  type="button"
                  onClick={carregarTemplatesReais}
                  disabled={carregandoTemplates}
                  className="text-teal-600 hover:text-teal-800 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                  title="Atualizar lista de templates da conta"
                >
                  <FontAwesomeIcon icon={faSpinner} className={carregandoTemplates ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>

              {carregandoTemplates ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-teal-600 text-2xl" />
                  <p className="text-xs text-gray-500 font-medium">Carregando templates homologados da conta WhatsApp...</p>
                </div>
              ) : erroTemplates ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-2">
                  <p className="font-semibold">⚠️ Erro ao consultar templates oficiais:</p>
                  <p className="text-[11px]">{erroTemplates}</p>
                  <button
                    type="button"
                    onClick={carregarTemplatesReais}
                    className="bg-rose-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs hover:bg-rose-700 transition"
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : templates.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {templates.map(tmpl => {
                    const isSelected = (templateSelecionado?.id && templateSelecionado.id === tmpl.id) || 
                                       (templateSelecionado?.nome && templateSelecionado.nome === tmpl.nome);
                    return (
                      <div
                        key={tmpl.id || tmpl.nome}
                        onClick={() => setTemplateSelecionado(tmpl)}
                        className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/20 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs text-gray-800">{tmpl.nome}</p>
                          <p className="text-[10px] text-gray-400">
                            Idioma: <strong className="text-gray-600">{tmpl.idioma || 'pt_BR'}</strong> · Categoria: <strong className="text-gray-600">{tmpl.categoria || 'MARKETING'}</strong> · Status: <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">APROVADO</span>
                          </p>
                        </div>
                        {isSelected && <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600 text-base" />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Nenhum template oficial aprovado encontrado.</p>
                  <p className="text-[11px] text-gray-400">
                    Certifique-se de que a conta WhatsApp ativa (YCloud / Meta) possui templates no status APROVADO.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Preencha as Variáveis do Template Oficial</label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Configure os parâmetros obrigatórios em ordem numérica estrita. Use tags dinâmicas para personalizar cada envio.
                </p>
              </div>

              {Object.keys(variaveis).length > 0 ? (
                <div className="space-y-3.5">
                  {Object.keys(variaveis)
                    .sort((a, b) => Number(a) - Number(b))
                    .map(varKey => (
                      <div key={varKey} className="p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-gray-700">
                            Variável <span className="font-mono text-teal-700">{`{{${varKey}}}`}</span> <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-gray-400 font-medium">Parâmetro #{varKey}</span>
                        </div>

                        <input
                          type="text"
                          value={variaveis[varKey] || ''}
                          onChange={(e) => {
                            setVariaveis({ ...variaveis, [varKey]: e.target.value });
                            if (erroAlerta) setErroAlerta(null);
                          }}
                          placeholder={`Digite o texto fixo ou use {nome}`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                        />

                        {/* Botões de atalho para tags dinâmicas */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-gray-400 font-semibold">Inserir tag:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} {nome}` : '{nome}' });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold rounded border border-teal-200 transition"
                          >
                            + Nome do Contato
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              const nomesServicosTag = Array.isArray(campanhaSelecionada?.campanhas_servicos)
                                ? campanhaSelecionada.campanhas_servicos
                                    .map(cs => cs?.categorias_servicos?.nome || cs?.nome_servico)
                                    .filter(Boolean)
                                : [];
                              const valorTag = nomesServicosTag.length > 0
                                ? nomesServicosTag.join(', ')
                                : (campanhaSelecionada?.descricao || campanhaSelecionada?.nome || '{beneficio}');
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} ${valorTag}` : valorTag });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold rounded border border-teal-200 transition"
                          >
                            + Benefício / Ação
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              const valorTag = campanhaSelecionada?.data_entrega || '{data_entrega}';
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} ${valorTag}` : valorTag });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold rounded border border-teal-200 transition"
                          >
                            + Data Entrega
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              const valorTag = campanhaSelecionada?.local_entrega || '{local_entrega}';
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} ${valorTag}` : valorTag });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold rounded border border-teal-200 transition"
                          >
                            + Local Entrega
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} {cidade}` : '{cidade}' });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold rounded border border-gray-200 transition"
                          >
                            + Cidade
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const atual = variaveis[varKey] || '';
                              setVariaveis({ ...variaveis, [varKey]: atual ? `${atual} {bairro}` : '{bairro}' });
                              if (erroAlerta) setErroAlerta(null);
                            }}
                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold rounded border border-gray-200 transition"
                          >
                            + Bairro
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                  <p className="text-xs font-semibold text-gray-700">Este template é estático</p>
                  <p className="text-[11px] text-gray-400">
                    O template oficial selecionado não possui variáveis dinâmicas. O texto aprovado será transmitido na íntegra.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <h4 className="font-bold text-sm text-gray-800">Resumo Final da Comunicação</h4>
                  <p className="text-[11px] text-gray-400">Confira todos os parâmetros antes de avançar para o agendamento/criação.</p>
                </div>
                <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  Pronto para Enfileirar
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-200/70 p-4 rounded-xl space-y-3">
                {/* Dados Principais */}
                <div className="grid grid-cols-2 gap-3 border-b border-gray-200/60 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Nome do Disparo</span>
                    <p className="font-extrabold text-xs text-gray-800 mt-0.5">{nome}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Ação / CRM Vinculado</span>
                    <p className="font-extrabold text-xs text-gray-800 mt-0.5">
                      {campanhaSelecionada ? campanhaSelecionada.nome : 'Nenhuma (Base Avulsa)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Provedor Oficial Ativo</span>
                    <p className="font-extrabold text-xs text-teal-700 mt-0.5 flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheckCircle} /> {(() => {
                        const prov = String(contaOficial?.provider || '').toUpperCase();
                        if (prov === 'WABLAST') return 'WaBlast Oficial';
                        if (prov === 'YCLOUD') return 'YCloud Oficial';
                        if (prov === 'META') return 'Meta Cloud API Oficial';
                        return 'WhatsApp Oficial';
                      })()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Número de Origem</span>
                    <p className="font-extrabold text-xs text-gray-800 mt-0.5 font-mono">
                      {contaOficial?.displayPhoneNumber || contaOficial?.wablastDetails?.phoneNumber || 'Número Configurado'}
                    </p>
                  </div>
                </div>

                {/* Template e Idioma */}
                <div className="grid grid-cols-2 gap-3 border-b border-gray-200/60 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Template Oficial</span>
                    <p className="font-extrabold text-xs text-gray-800 mt-0.5">{templateSelecionado?.nome || 'Não selecionado'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Idioma & Categoria</span>
                    <p className="font-extrabold text-xs text-gray-800 mt-0.5">
                      {templateSelecionado?.idioma || 'pt_BR'} · {templateSelecionado?.categoria || 'MARKETING'}
                    </p>
                  </div>
                </div>

                {/* Volumetria e Elegibilidade */}
                <div className="border-b border-gray-200/60 pb-3 space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Volumetria e Elegibilidade da Base</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Total Encontrados</span>
                      <p className="text-sm font-extrabold text-gray-800 mt-0.5">{detalhesExcluidos.totalEncontrados}</p>
                    </div>
                    <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-[9px] font-bold text-amber-700 uppercase block">Não Elegíveis</span>
                      <p className="text-sm font-extrabold text-amber-800 mt-0.5">{detalhesExcluidos.totalExcluidos}</p>
                      <span className="text-[9px] text-amber-600 block mt-0.5">
                        {detalhesExcluidos.duplicados} dup · {detalhesExcluidos.semTelefone} s/tel · {detalhesExcluidos.invalidos} inv
                      </span>
                    </div>
                    <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-300">
                      <span className="text-[9px] font-bold text-emerald-700 uppercase block">Destinatários Aptos</span>
                      <p className="text-sm font-extrabold text-emerald-800 mt-0.5">{destinatariosFiltrados.length}</p>
                      <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">100% validados</span>
                    </div>
                  </div>
                </div>

                {/* Resumo das Variáveis */}
                {Object.keys(variaveis).length > 0 ? (
                  <div className="space-y-1">
                    <strong className="block text-gray-700 text-[11px]">Variáveis Configuradas:</strong>
                    <div className="grid grid-cols-2 gap-1.5 pl-1 font-mono text-[11px] text-gray-600">
                      {Object.keys(variaveis).sort((a, b) => Number(a) - Number(b)).map(k => (
                        <div key={k} className="bg-white px-2 py-1 rounded border border-gray-200 truncate">
                          <strong className="text-teal-700">{`{{${k}}}`}</strong> &rarr; {variaveis[k]}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">Template sem variáveis dinâmicas.</p>
                )}

                {/* Banner de Garantia de Integridade */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-2.5 text-[11px] text-teal-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600" />
                    <span>Garantia de Enfileiramento Seguro</span>
                  </div>
                  <p className="text-[10px] text-teal-700 leading-normal">
                    Somente os <strong>{destinatariosFiltrados.length} destinatários aptos</strong> serão gravados na fila oficial. Nenhum contato inválido, duplicado ou sem telefone chegará à base de transmissão.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-1">
                  Agendamento e Enfileiramento
                </h4>
                <p className="text-[11px] text-gray-400">
                  Defina se a transmissão deve ser agendada para uma data específica ou salva imediatamente na fila.
                </p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="agendadoCheck"
                    checked={agendado}
                    onChange={(e) => setAgendado(e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                  />
                  <label htmlFor="agendadoCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                    Agendar disparo para uma data/hora futura?
                  </label>
                </div>

                {agendado && (
                  <div className="pt-2 border-t border-gray-200/60">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Data e Hora do Disparo Programado</label>
                    <input
                      type="datetime-local"
                      value={dataAgendamento}
                      onChange={(e) => setDataAgendamento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Informação Operacional Importante */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-amber-600" />
                  <span>Aviso de Operação e Disparo</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Ao clicar em <strong>"Finalizar Criação"</strong>, os {destinatariosFiltrados.length} destinatários aptos serão salvos na fila oficial. O envio <strong>não ocorre de forma automática</strong>; o disparo real somente terá início quando o operador clicar no botão <strong>"Iniciar Disparo"</strong> na tela de detalhes da transmissão.
                </p>
              </div>
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
          
          {step < totalSteps ? (
            <button
              onClick={handleProximo}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              Próximo <FontAwesomeIcon icon={faArrowRight} />
            </button>
          ) : (
            <button
              onClick={handleSalvar}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              Finalizar Criação <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          )}
        </div>
      </div>

      {/* Coluna Direita: Resumo da Base Selecionada (Etapa 2/3) ou Prévia do Template (Etapas 4+) */}
      <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100 flex flex-col justify-between">
        <div>
          {step <= 3 && origemDestinatarios === 'campanha_politica' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
                <div>
                  <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
                    Resumo da Base Selecionada
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {campanhaSelecionada ? `Ação: ${campanhaSelecionada.nome}` : 'Base MandatoPRO'}
                  </p>
                </div>
                {campanhaSelecionada && (
                  <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                    CRM Vinculado
                  </span>
                )}
              </div>

              {carregandoContatos ? (
                <div className="p-12 text-center space-y-3">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-teal-600 text-3xl" />
                  <p className="text-xs text-gray-500 font-medium">
                    Auditando contatos vinculados e calculando elegibilidade...
                  </p>
                </div>
              ) : erroContatos ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>Erro ao consultar contatos da campanha</span>
                  </div>
                  <p className="text-[11px]">{erroContatos}</p>
                </div>
              ) : (campanhaSelecionada || step === 3) ? (
                <div className="space-y-3">
                  {/* Cards Principais: Total e Elegíveis */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200/80 p-3.5 rounded-xl shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400">
                        <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                        <span>Total de Registros</span>
                      </div>
                      <p className="text-2xl font-extrabold text-gray-800 mt-1">
                        {detalhesExcluidos.totalEncontrados}
                      </p>
                      <span className="text-[10px] text-gray-400 block mt-0.5">vinculados à campanha</span>
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl shadow-2xs">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-700">
                        <FontAwesomeIcon icon={faUserCheck} className="text-emerald-600" />
                        <span>Registros Elegíveis</span>
                      </div>
                      <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                        {destinatariosFiltrados.length}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">com WhatsApp válido</span>
                    </div>
                  </div>

                  {/* Detalhamento dos Registros Não Elegíveis */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-amber-900 font-bold text-xs">
                      <div className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faUserTimes} className="text-amber-600" />
                        <span>Registros Não Elegíveis</span>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                        {detalhesExcluidos.totalExcluidos}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-amber-200/60 pt-2 text-[11px] text-amber-900">
                      <div className="bg-white/80 p-2 rounded-lg border border-amber-100/80">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Duplicados</span>
                        <p className="font-extrabold text-xs text-gray-800 mt-0.5">{detalhesExcluidos.duplicados}</p>
                      </div>

                      <div className="bg-white/80 p-2 rounded-lg border border-amber-100/80">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Sem Telefone</span>
                        <p className="font-extrabold text-xs text-gray-800 mt-0.5">{detalhesExcluidos.semTelefone}</p>
                      </div>

                      <div className="bg-white/80 p-2 rounded-lg border border-amber-100/80">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">Inválidos</span>
                        <p className="font-extrabold text-xs text-gray-800 mt-0.5">{detalhesExcluidos.invalidos}</p>
                      </div>
                    </div>
                  </div>

                  {/* Destaque Final: Total Aptos ao Disparo */}
                  <div className="bg-white border-2 border-teal-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Final de Destinatários Aptos</span>
                      <p className="text-xl font-extrabold text-teal-800 mt-0.5">
                        {destinatariosFiltrados.length} <span className="text-xs font-normal text-gray-500">contatos prontos</span>
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-sm font-bold border border-teal-200">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto text-xl">
                    <FontAwesomeIcon icon={faDatabase} />
                  </div>
                  <p className="text-xs font-semibold text-gray-600">Nenhuma campanha selecionada</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Selecione uma campanha ou ação do CRM ao lado para auditar os eleitores vinculados e verificar os contatos elegíveis.
                  </p>
                </div>
              )}
            </div>
          ) : (
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
          )}
        </div>
      </div>

    </div>
  );
}
