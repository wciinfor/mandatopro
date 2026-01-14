import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSearch, faCheckCircle, 
  faHourglassHalf, faTimesCircle, faClock, faMapMarkedAlt, faBell, faUserTie, faHandshake, faStethoscope,
  faEye, faHospital, faFileAlt, faGavel, faEnvelope, faPhone
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import BuscaEleitor from '@/components/BuscaEleitor';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function NovoAtendimento() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);

  // Estado do formulário
  const [formData, setFormData] = useState({
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
    statusAtendimento: 'NAO_REALIZADO', // NAO_REALIZADO, EM_PROCESSO, REALIZADO
    dataAtendimento: '',
    dataConclusao: '',
    
    // Observações e Descrição
    descricao: '',
    observacoes: '',
    
    // Notificações
    notificarEleitor: true,
    modoNotificacao: 'WHATSAPP' // EMAIL, SMS, WHATSAPP
  });

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

  const buscarEleitor = async () => {
    if (!formData.eleitorCpf) {
      alert('Digite o CPF do eleitor');
      return;
    }
    
    // Aqui você implementará a busca no Supabase
    alert('Funcionalidade de busca será implementada com Supabase');
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
    
    console.log('Dados do atendimento:', formData);
    
    // Enviar notificação se habilitado
    if (formData.notificarEleitor && formData.eleitorCelular) {
      const mensagem = `Olá ${formData.eleitorNome}! Seu atendimento foi registrado. Status: ${formData.statusAtendimento}. Acompanhe o progresso pelo sistema.`;
      
      await enviarNotificacao(formData.modoNotificacao, mensagem);
    }
    
    // Aqui você implementará a integração com Supabase
    alert('Atendimento cadastrado com sucesso!');
  };

  const atualizarStatus = async (novoStatus) => {
    setFormData(prev => ({ ...prev, statusAtendimento: novoStatus }));
    
    // Notificar eleitor sobre mudança de status
    if (formData.notificarEleitor) {
      const statusTexto = {
        'NAO_REALIZADO': 'Aguardando início',
        'EM_PROCESSO': 'Em andamento',
        'REALIZADO': 'Concluído'
      };
      
      const mensagem = `Atualização do seu atendimento: Status alterado para ${statusTexto[novoStatus]}`;
      await enviarNotificacao(formData.modoNotificacao, mensagem);
    }
  };

  return (
    <Layout titulo="Novo Atendimento">
      {/* Busca de Eleitor */}
      <BuscaEleitor 
        onSelecionarEleitor={handleSelecionarEleitor}
        eleitorSelecionado={eleitorSelecionado}
      />

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
            {/* Status do Atendimento - Badge no Topo */}
            <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => atualizarStatus('NAO_REALIZADO')}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    formData.statusAtendimento === 'NAO_REALIZADO'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <FontAwesomeIcon icon={faTimesCircle} />
                  Não Realizado
                </button>
                <button
                  type="button"
                  onClick={() => atualizarStatus('EM_PROCESSO')}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    formData.statusAtendimento === 'EM_PROCESSO'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  <FontAwesomeIcon icon={faHourglassHalf} />
                  Em Processo
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

            {/* Tipo de Atendimento */}
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

            {/* Ação Social */}
            {formData.tipoAtendimento === 'ACAO_SOCIAL' && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faHandshake} className="text-teal-600" />
                  AÇÃO SOCIAL
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Liderança Responsável <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="liderancaResponsavel"
                      value={formData.liderancaResponsavel}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

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
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Serviços Oferecidos
                  </label>
                  <textarea
                    name="servicosOferecidos"
                    value={formData.servicosOferecidos}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Descreva os serviços oferecidos na ação social..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Tipo Específico - Atendimento Médico/Oftalmologista/Hospitalar */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Atendimento Médico
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoEspecifico: 'MEDICO' }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.tipoEspecifico === 'MEDICO'
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-300 hover:border-teal-400'
                      }`}
                    >
                      <FontAwesomeIcon icon={faStethoscope} className="text-2xl text-teal-600 mb-2" />
                      <div className="font-semibold">Atendimento Médico</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoEspecifico: 'OFTALMOLOGISTA' }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.tipoEspecifico === 'OFTALMOLOGISTA'
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-300 hover:border-teal-400'
                      }`}
                    >
                      <FontAwesomeIcon icon={faEye} className="text-2xl text-teal-600 mb-2" />
                      <div className="font-semibold">Oftamologista</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tipoEspecifico: 'HOSPITALAR' }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.tipoEspecifico === 'HOSPITALAR'
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-gray-300 hover:border-teal-400'
                      }`}
                    >
                      <FontAwesomeIcon icon={faHospital} className="text-2xl text-teal-600 mb-2" />
                      <div className="font-semibold">Procedimento Hospitalar</div>
                    </button>
                  </div>
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF do Eleitor <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="eleitorCpf"
                      value={formData.eleitorCpf}
                      onChange={handleInputChange}
                      required
                      placeholder="000.000.000-00"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={buscarEleitor}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      <FontAwesomeIcon icon={faSearch} />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome do Eleitor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="eleitorNome"
                    value={formData.eleitorNome}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="eleitorEmail"
                    value={formData.eleitorEmail}
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                    onChange={handleInputChange}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                Salvar Atendimento
              </button>
            </div>
          </form>
        </Layout>
      );
    }
