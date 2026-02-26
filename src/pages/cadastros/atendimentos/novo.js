import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faCheckCircle, 
  faHourglassHalf, faTimesCircle, faClock, faMapMarkedAlt, faBell, faUserTie, faHandshake,
  faFileAlt, faGavel, faEnvelope, faPhone
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import BuscaEleitor from '@/components/BuscaEleitor';
import BuscaCampanha from '@/components/BuscaCampanha';
import BuscaLideranca from '@/components/BuscaLideranca';
import BuscaDinamica from '@/components/BuscaDinamica';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function NovoAtendimento() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [salvando, setSalvando] = useState(false);
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);
  const [liderancaSelecionada, setLiderancaSelecionada] = useState(null);
  const [servicosCampanha, setServicosCampanha] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);

  const initialFormData = {
    // Ação Social
    tipoAtendimento: 'ACAO_SOCIAL',
    liderancaResponsavel: '',
    localidadeAtendida: '',
    servicosOferecidos: '',
    
    // Dados do Eleitor
    eleitorCpf: '',
    eleitorNome: '',
    eleitorEmail: '',
    eleitorCelular: '',
    
    // Tipo específico de atendimento
    tipoEspecifico: '', // MEDICO, OFTAMOLOGISTA, HOSPITALAR, JURIDICO, OUTROS
    
    // Emissão de Documentos
    descricaoDocumento: '',
    encaminhamento: '',
    
    // Atendimento Jurídico
    tipoAtendimentoJuridico: '',
    agendamento: '',
    
    // Status e Acompanhamento
    statusAtendimento: 'AGENDADO', // AGENDADO, REALIZADO, CANCELADO
    dataAtendimento: '',
    dataConclusao: '',
    
    // Observações e Descrição
    descricao: '',
    observacoes: '',
    
    // Notificações
    notificarEleitor: false,
    modoNotificacao: 'WHATSAPP' // EMAIL, SMS, WHATSAPP
  };

  // Estado do formulário
  const [formData, setFormData] = useState(initialFormData);

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    router.push('/login');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    
    if (eleitor) {
      // Preencher automaticamente os dados do eleitor no atendimento
      setFormData(prev => ({
        ...prev,
        eleitorCpf: eleitor.cpf || '',
        eleitorNome: eleitor.nome || '',
        eleitorEmail: eleitor.email || '',
        eleitorCelular: eleitor.celular || ''
      }));
    } else {
      // Limpar dados do eleitor
      setFormData(prev => ({
        ...prev,
        eleitorCpf: '',
        eleitorNome: '',
        eleitorEmail: '',
        eleitorCelular: ''
      }));
    }
  };

  const handleSelecionarCampanha = (campanha) => {
    setCampanhaSelecionada(campanha);
    setLiderancaSelecionada(null); // Limpar liderança anterior
    setServicosSelecionados([]); // Limpar serviços selecionados
    
    if (campanha) {
      // Se atendimento avulso, não preencher dados da campanha
      if (campanha.id === 'AVULSO') {
        setServicosCampanha([]);
        setFormData(prev => ({
          ...prev,
          localidadeAtendida: '',
          dataAtendimento: ''
        }));
      } else {
        // Preencher automaticamente os dados da campanha
        const servicos = campanha.campanhas_servicos?.map(s => s.categorias_servicos?.nome).filter(Boolean) || [];
        setServicosCampanha(servicos);
        
        // Preencher localidade
        setFormData(prev => ({
          ...prev,
          localidadeAtendida: campanha.local || '',
          dataAtendimento: campanha.data_campanha || ''
        }));
        
        // Selecionar liderança com MAIOR hierarquia
        if (campanha.campanhas_liderancas && campanha.campanhas_liderancas.length > 0) {
          // Define a ordem de prioridade: SUPERVISOR > COORDENADOR > APOIO
          const hierarquia = { 'SUPERVISOR': 3, 'COORDENADOR': 2, 'APOIO': 1 };
          
          // Encontrar a liderança com maior hierarquia
          const liderancaComMaiorHierarquia = campanha.campanhas_liderancas.reduce((maior, atual) => {
            const hierarquiaAtual = hierarquia[atual.papel] || 0;
            const hierarquiaMaior = hierarquia[maior.papel] || 0;
            return hierarquiaAtual > hierarquiaMaior ? atual : maior;
          });
          
          const liderancaSelecionadaFinal = {
            id: liderancaComMaiorHierarquia.lideranca_id,
            nome: liderancaComMaiorHierarquia.liderancas?.nome || '',
            telefone: liderancaComMaiorHierarquia.liderancas?.telefone || '',
            influencia: liderancaComMaiorHierarquia.liderancas?.influencia || '',
            area_atuacao: liderancaComMaiorHierarquia.liderancas?.area_atuacao || '',
            papel: liderancaComMaiorHierarquia.papel || ''
          };
          
          setLiderancaSelecionada(liderancaSelecionadaFinal);
          setFormData(prev => ({
            ...prev,
            liderancaResponsavel: liderancaSelecionadaFinal.nome || ''
          }));
        }
      }
    } else {
      setServicosCampanha([]);
      setServicosSelecionados([]);
      setFormData(prev => ({
        ...prev,
        localidadeAtendida: '',
        liderancaResponsavel: '',
        dataAtendimento: ''
      }));
    }
  };

  const toggleServicoCampanha = (servico) => {
    setServicosSelecionados(prev => {
      if (prev.includes(servico)) {
        return prev.filter(item => item !== servico);
      }
      return [...prev, servico];
    });
  };

  const handleSelecionarLideranca = (lideranca) => {
    setLiderancaSelecionada(lideranca);
    if (lideranca) {
      setFormData(prev => ({
        ...prev,
        liderancaResponsavel: lideranca.nome || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        liderancaResponsavel: ''
      }));
    }
  };

  const enviarNotificacao = async (tipo, mensagem) => {
    try {
      const response = await fetch('/api/enviar-notificacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eleitorEmail: formData.eleitorEmail,
          eleitorCelular: formData.eleitorCelular,
          tipo: tipo, // EMAIL, SMS, WHATSAPP
          mensagem: mensagem
        })
      });

      if (response.ok) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      return false;
    }
  };

  const gerarPDF = (tipo) => {
    const pdfGen = new PDFGenerator();
    let doc;
    
    switch (tipo) {
      case 'MEDICO':
        doc = pdfGen.gerarNotaAtendimentoMedico(formData);
        doc.save(`Nota_Atendimento_Medico_${formData.eleitorNome || 'eleitor'}_${Date.now()}.pdf`);
        break;
        
      case 'OFTAMOLOGISTA':
        doc = pdfGen.gerarNotaAtendimentoOftamologista(formData);
        doc.save(`Nota_Atendimento_Oftalmologista_${formData.eleitorNome || 'eleitor'}_${Date.now()}.pdf`);
        break;
        
      case 'HOSPITALAR':
        doc = pdfGen.gerarNotaAtendimentoHospitalar(formData);
        doc.save(`Nota_Procedimento_Hospitalar_${formData.eleitorNome || 'eleitor'}_${Date.now()}.pdf`);
        break;
        
      case 'RELATORIO':
      default:
        doc = pdfGen.gerarRelatorioAtendimento(formData);
        doc.save(`Relatorio_Atendimento_${formData.eleitorNome || 'eleitor'}_${Date.now()}.pdf`);
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (salvando) {
      return;
    }
    
    if (!eleitorSelecionado?.id) {
      showWarning('Selecione um eleitor antes de salvar');
      return;
    }

    const payload = {
      eleitorId: eleitorSelecionado.id,
      tipoAtendimento: formData.tipoAtendimento,
      assunto: formData.tipoEspecifico || formData.tipoAtendimentoJuridico || '',
      descricao: formData.descricao || formData.servicosOferecidos || '',
      resultado: formData.observacoes || '',
      status: formData.statusAtendimento,
      dataAtendimento: formData.dataAtendimento || null,
      servicosSelecionados
    };
    
    // Enviar notificação se habilitado
    if (formData.notificarEleitor && formData.eleitorCelular) {
      const mensagem = `Olá ${formData.eleitorNome}! Seu atendimento foi registrado. Status: ${formData.statusAtendimento}. Acompanhe o progresso pelo sistema.`;
      
      await enviarNotificacao(formData.modoNotificacao, mensagem);
    }
    
    try {
      setSalvando(true);
      const response = await fetch('/api/cadastros/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar atendimento');
      }

      showSuccess('Atendimento cadastrado com sucesso!', () => {
        setFormData(initialFormData);
        setEleitorSelecionado(null);
        setCampanhaSelecionada(null);
        setLiderancaSelecionada(null);
        setServicosCampanha([]);
        setServicosSelecionados([]);
        router.push('/cadastros/atendimentos');
      });
    } catch (error) {
      showError('Erro ao salvar atendimento: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const atualizarStatus = async (novoStatus) => {
    setFormData(prev => ({ ...prev, statusAtendimento: novoStatus }));
    
    // Notificar eleitor sobre mudança de status
    if (formData.notificarEleitor) {
      const statusTexto = {
        'AGENDADO': 'Agendado',
        'REALIZADO': 'Concluído',
        'CANCELADO': 'Cancelado'
      };
      
      const mensagem = `Atualização do seu atendimento: Status alterado para ${statusTexto[novoStatus]}`;
      await enviarNotificacao(formData.modoNotificacao, mensagem);
    }
  };

  return (
    <Layout titulo="Novo Atendimento">
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

      {/* Busca de Eleitor */}
      <BuscaEleitor 
        onSelecionarEleitor={handleSelecionarEleitor}
        eleitorSelecionado={eleitorSelecionado}
      />

      {/* Busca de Campanha - após seleção do eleitor */}
      {eleitorSelecionado && (
        <BuscaCampanha 
          onSelecionarCampanha={handleSelecionarCampanha}
          campanhaSelecionada={campanhaSelecionada}
        />
      )}

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
            {/* Status do Atendimento - Badge no Topo */}
            <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => atualizarStatus('AGENDADO')}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    formData.statusAtendimento === 'AGENDADO'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <FontAwesomeIcon icon={faClock} />
                  Agendado
                </button>
                <button
                  type="button"
                  onClick={() => atualizarStatus('CANCELADO')}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    formData.statusAtendimento === 'CANCELADO'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <FontAwesomeIcon icon={faTimesCircle} />
                  Cancelado
                </button>
                <button
                  type="button"
                  onClick={() => atualizarStatus('REALIZADO')}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    formData.statusAtendimento === 'REALIZADO'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Realizado
                </button>
              </div>
            </div>

            {/* Tipo de Atendimento - Oculto se campanha existente selecionada */}
            {(!campanhaSelecionada || campanhaSelecionada.id === 'AVULSO') && (
              <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border-l-4 border-teal-600">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Tipo de Atendimento</h3>
                <select
                  name="tipoAtendimento"
                  value={formData.tipoAtendimento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-semibold"
                >
                  <option value="ACAO_SOCIAL">Ação Social</option>
                  <option value="EMISSAO_DOCUMENTOS">Emissão de Documentos</option>
                  <option value="ATENDIMENTO_JURIDICO">Atendimento Jurídico</option>
                  <option value="OUTROS">Outros Atendimentos</option>
                </select>
              </div>
            )}

            {/* Ação Social */}
            {formData.tipoAtendimento === 'ACAO_SOCIAL' && campanhaSelecionada && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faHandshake} className="text-teal-600" />
                  AÇÃO SOCIAL
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Liderança Responsável */}
                  <div>
                    {campanhaSelecionada?.id === 'AVULSO' ? (
                      <BuscaLideranca
                        onSelecionarLideranca={handleSelecionarLideranca}
                        liderancaSelecionada={liderancaSelecionada}
                        label="Liderança Responsável"
                      />
                    ) : (
                      <>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Liderança Responsável <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 space-y-1">
                          {formData.liderancaResponsavel ? (
                            <>
                              <div className="font-semibold">{formData.liderancaResponsavel}</div>
                              <div className="text-sm text-gray-600">
                                <span className="inline-block bg-teal-100 text-teal-700 px-2 py-1 rounded text-xs font-semibold">
                                  {liderancaSelecionada?.papel || 'APOIO'}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-500">Sem liderança vinculada</div>
                          )}
                        </div>
                        {formData.liderancaResponsavel ? (
                          <p className="text-xs text-gray-500 mt-1">✓ Selecionada automaticamente (maior hierarquia)</p>
                        ) : (
                          <p className="text-xs text-yellow-600 mt-1">⚠️ Campanha sem liderança cadastrada</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Localidade Atendida - Preenchida automaticamente ou editable */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Localidade Atendida <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="localidadeAtendida"
                      value={formData.localidadeAtendida}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder={campanhaSelecionada?.id === 'AVULSO' ? 'Informar localidade...' : ''}
                    />
                    {campanhaSelecionada?.id !== 'AVULSO' && (
                      <p className="text-xs text-gray-500 mt-1">✓ Preenchido automaticamente da campanha</p>
                    )}
                  </div>
                </div>

                {/* Serviços da Campanha */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Serviços Oferecidos {campanhaSelecionada?.id === 'AVULSO' ? '(Selecione os serviços)' : '(Da campanha)'}
                  </label>
                  
                  {campanhaSelecionada?.id === 'AVULSO' ? (
                    // Atendimento Avulso - Mostrar todos os serviços disponíveis
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                      <p className="text-sm text-gray-700 mb-3">
                        💡 Atendimento avulso - Selecione os serviços oferecidos ou crie um personalizado
                      </p>
                      <textarea
                        name="servicosOferecidos"
                        value={formData.servicosOferecidos}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Descreva os serviços oferecidos neste atendimento avulso..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ) : servicosCampanha.length > 0 ? (
                    // Serviços da campanha selecionada
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {servicosCampanha.map((servico, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border border-green-200">
                            <input
                              type="checkbox"
                              id={`servico-${idx}`}
                              checked={servicosSelecionados.includes(servico)}
                              onChange={() => toggleServicoCampanha(servico)}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <label htmlFor={`servico-${idx}`} className="text-sm text-gray-700 cursor-pointer">
                              {servico}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
                      ⚠️ Esta campanha não possui serviços cadastrados. Descreva os serviços abaixo:
                      <textarea
                        name="servicosOferecidos"
                        value={formData.servicosOferecidos}
                        onChange={handleInputChange}
                        rows="2"
                        placeholder="Descreva os serviços oferecidos..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mt-2"
                      />
                    </div>
                  )}
                </div>


              </div>
            )}

            {/* Emissão de Documentos */}
            {formData.tipoAtendimento === 'EMISSAO_DOCUMENTOS' && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faFileAlt} className="text-teal-600" />
                  EMISSÃO DE DOCUMENTOS
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Descrição do Documento
                    </label>
                    <textarea
                      name="descricaoDocumento"
                      value={formData.descricaoDocumento}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Descreva o documento solicitado..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Encaminhamento
                    </label>
                    <textarea
                      name="encaminhamento"
                      value={formData.encaminhamento}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Para onde o documento será encaminhado..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Atendimento Jurídico */}
            {formData.tipoAtendimento === 'ATENDIMENTO_JURIDICO' && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faGavel} className="text-teal-600" />
                  ATENDIMENTO JURÍDICO
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de Atendimento
                    </label>
                    <input
                      type="text"
                      name="tipoAtendimentoJuridico"
                      value={formData.tipoAtendimentoJuridico}
                      onChange={handleInputChange}
                      placeholder="Ex: Consultoria, Processo, Orientação"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Agendamento
                    </label>
                    <input
                      type="datetime-local"
                      name="agendamento"
                      value={formData.agendamento}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dados do Eleitor */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4">DADOS DO ELEITOR</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF do Eleitor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="eleitorCpf"
                    value={formData.eleitorCpf}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome do Eleitor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="eleitorNome"
                    value={formData.eleitorNome}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="eleitorEmail"
                    value={formData.eleitorEmail}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-green-500" />
                    Celular / WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="eleitorCelular"
                    value={formData.eleitorCelular}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Descrição e Observações */}
            <div className="border-t pt-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Descrição do Atendimento
                  </label>
                  <textarea
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Descreva detalhadamente o atendimento..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Observações adicionais..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4">DATAS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data do Atendimento
                  </label>
                  <input
                    type="date"
                    name="dataAtendimento"
                    value={formData.dataAtendimento}
                    onChange={handleInputChange}
                    disabled={campanhaSelecionada?.id && campanhaSelecionada.id !== 'AVULSO'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 ${
                      campanhaSelecionada?.id && campanhaSelecionada.id !== 'AVULSO'
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                        : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Conclusão
                  </label>
                  <input
                    type="date"
                    name="dataConclusao"
                    value={formData.dataConclusao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Configurações de Notificação */}
            <div className="border-t pt-6 mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faBell} />
                NOTIFICAÇÕES AUTOMÁTICAS
              </h3>
              
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="notificarEleitor"
                    checked={formData.notificarEleitor}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-teal-600"
                  />
                  <span className="font-semibold text-gray-700">
                    Notificar eleitor sobre atualizações do atendimento
                  </span>
                </label>
              </div>

              {formData.notificarEleitor && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Modo de Notificação
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="EMAIL"
                        checked={formData.modoNotificacao === 'EMAIL'}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <FontAwesomeIcon icon={faEnvelope} className="text-blue-600" />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="SMS"
                        checked={formData.modoNotificacao === 'SMS'}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <FontAwesomeIcon icon={faPhone} className="text-green-600" />
                      <span>SMS</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="WHATSAPP"
                        checked={formData.modoNotificacao === 'WHATSAPP'}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <FontAwesomeIcon icon={faWhatsapp} className="text-green-500" />
                      <span>WhatsApp</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-between">
              <button
                type="button"
                onClick={() => router.push('/cadastros/atendimentos')}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                {salvando ? 'Salvando...' : 'Salvar Atendimento'}
              </button>
            </div>
          </form>
        </Layout>
      );
    }
