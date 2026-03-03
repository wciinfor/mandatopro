import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave,
  faArrowLeft,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faHistory,
  faEdit,
  faEye,
  faUserMd,
  faHospital,
  faGavel
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function EditarAtendimento() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const ultimoIdCarregado = useRef(null);
  const [historicoNovos, setHistoricoNovos] = useState([]);

  const [formData, setFormData] = useState({
    tipoAtendimento: 'ACAO_SOCIAL',
    eleitorNome: '',
    eleitorCpf: '',
    campanhaNome: '',
    tipoEspecifico: '',
    statusAtendimento: 'AGENDADO',
    dataAtendimento: '',
    dataConclusao: '',
    descricao: '',
    observacoes: '',
    historico: [],
    
    // Campos específicos por tipo de atendimento
    // Oftalmologista
    oftalmologista: {
      odEsferico: '',
      odCilindrico: '',
      odEixo: '',
      odAdicao: '',
      odDNP: '',
      oeEsferico: '',
      oeCilindrico: '',
      oeEixo: '',
      oeAdicao: '',
      oeDNP: '',
      tipoLente: '', // UNIFOCAL, BIFOCAL, MULTIFOCAL, ANTI-REFLEXO, TRANSITIONS, POLI-C/AR, COR ESCOLHA, SUNSENSORS
      observacoesReceita: ''
    },
    
    // Médico
    medico: {
      especialidade: '',
      diagnostico: '',
      prescricao: '',
      medicamentos: '',
      posologia: '',
      orientacoes: '',
      retorno: ''
    },
    
    // Hospitalar
    hospitalar: {
      procedimento: '',
      hospital: '',
      dataAgendamento: '',
      horario: '',
      especialidade: '',
      medicoResponsavel: '',
      examesNecessarios: '',
      preparoProcedimento: '',
      acompanhante: ''
    },
    
    // Jurídico
    juridico: {
      area: '', // TRABALHISTA, CIVIL, FAMILIA, PREVIDENCIARIO, CRIMINAL
      tipoProcesso: '',
      numeroProcesso: '',
      vara: '',
      advogadoResponsavel: '',
      situacaoProcesso: '',
      proximaAudiencia: '',
      documentosNecessarios: ''
    }
  });

  const statusOptions = {
    'AGENDADO': { label: 'Agendado', icon: faClock, color: 'blue' },
    'REALIZADO': { label: 'Realizado', icon: faCheckCircle, color: 'green' },
    'CANCELADO': { label: 'Cancelado', icon: faTimesCircle, color: 'red' }
  };

  const mapTipoAtendimentoParaEspecifico = (tipoAtendimento) => {
    switch (tipoAtendimento) {
      case 'ATENDIMENTO_MEDICO':
        return 'MEDICO';
      case 'OFTALMOLOGISTA':
        return 'OFTALMOLOGISTA';
      case 'ATENDIMENTO_JURIDICO':
      case 'ORIENTACAO_JURIDICA':
        return 'JURIDICO';
      case 'HOSPITALAR':
        return 'HOSPITALAR';
      default:
        return '';
    }
  };

  const mapTipoEspecificoParaAtendimento = (tipoEspecifico) => {
    switch (tipoEspecifico) {
      case 'MEDICO':
        return 'ATENDIMENTO_MEDICO';
      case 'OFTALMOLOGISTA':
        return 'OFTALMOLOGISTA';
      case 'JURIDICO':
        return 'ORIENTACAO_JURIDICA';
      case 'HOSPITALAR':
        return 'HOSPITALAR';
      default:
        return '';
    }
  };

  const formatarDataHistorico = (dataIso) => {
    if (!dataIso) return '';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR');
  };

  useEffect(() => {
    setUsuario({ nome: 'Administrador' });
  }, []);

  useEffect(() => {
    if (!id || ultimoIdCarregado.current === id) return;
    ultimoIdCarregado.current = id;

    const carregarAtendimento = async () => {
      setCarregando(true);

      try {
        const response = await fetch(`/api/cadastros/atendimentos/${id}`);
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          const mensagem = errorPayload?.error
            ? `${errorPayload.error} (${response.status})`
            : `Erro ao carregar atendimento (${response.status})`;
          throw new Error(mensagem);
        }

        const data = await response.json();
        const dataAtendimento = data.data_atendimento
          ? new Date(data.data_atendimento).toISOString().split('T')[0]
          : '';
        const dataConclusao = data.data_conclusao
          ? new Date(data.data_conclusao).toISOString().split('T')[0]
          : '';

        const historicoNormalizado = Array.isArray(data.historico)
          ? data.historico.map((item) => ({
              data: item.data || formatarDataHistorico(item.created_at),
              usuario: item.usuario || item.usuario_nome || 'Sistema',
              status: item.status || 'AGENDADO',
              observacao: item.observacao || ''
            }))
          : [];

        setFormData(prev => ({
          ...prev,
          tipoAtendimento: data.tipo_atendimento || '',
          eleitorNome: data.eleitores?.nome || '',
          eleitorCpf: data.eleitores?.cpf || '',
          campanhaNome: data.campanhas?.nome || '',
          tipoEspecifico: mapTipoAtendimentoParaEspecifico(data.tipo_atendimento),
          statusAtendimento: data.status || 'AGENDADO',
          dataAtendimento,
          dataConclusao,
          descricao: data.descricao || '',
          observacoes: data.resultado || '',
          historico: historicoNormalizado
        }));
      } catch (error) {
        console.error('Erro ao carregar atendimento:', error);
        showError('Erro ao carregar atendimento. Tente novamente.');
      } finally {
        setCarregando(false);
      }
    };

    carregarAtendimento();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (novoStatus) => {
    const dataIso = new Date().toISOString();
    const dataAtual = new Date(dataIso).toLocaleString('pt-BR');
    const novoHistorico = {
      data: dataAtual,
      dataIso,
      usuario: usuario.nome,
      status: novoStatus,
      observacao: formData.observacoes || 'Status atualizado'
    };

    setFormData(prev => ({
      ...prev,
      statusAtendimento: novoStatus,
      historico: [...prev.historico, novoHistorico],
      dataConclusao: novoStatus === 'REALIZADO' ? new Date().toISOString().split('T')[0] : prev.dataConclusao
    }));

    setHistoricoNovos(prev => [...prev, novoHistorico]);

    showSuccess(`Status atualizado para: ${statusOptions[novoStatus].label}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const tipoAtendimentoAtual = formData.tipoAtendimento ||
        mapTipoEspecificoParaAtendimento(formData.tipoEspecifico);

      const response = await fetch(`/api/cadastros/atendimentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoAtendimento: tipoAtendimentoAtual,
          descricao: formData.descricao,
          resultado: formData.observacoes,
          status: formData.statusAtendimento,
          dataAtendimento: formData.dataAtendimento,
          dataConclusao: formData.dataConclusao,
          historicoNovos
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || 'Erro ao salvar atendimento');
      }

      setHistoricoNovos([]);
      showSuccess('Atendimento atualizado com sucesso!', () => {
        router.push('/cadastros/atendimentos');
      });
    } catch (error) {
      console.error('Erro ao atualizar atendimento:', error);
      showError(error.message || 'Erro ao salvar atendimento');
    }
  };

  if (!usuario || carregando) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  const statusAtual = statusOptions[formData.statusAtendimento] || statusOptions.AGENDADO;

  return (
    <Layout titulo="Editar Atendimento">
      <div className="p-4 lg:p-6">
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

        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Informação de ID e Status Atual */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm text-blue-700">
                    <strong>Atendimento:</strong> #{id}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Eleitor:</strong> {formData.eleitorNome}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Campanha:</strong> {formData.campanhaNome || 'Avulso'}
                  </p>
                </div>
                <div className={`p-4 bg-${statusAtual.color}-50 rounded-lg border-l-4 border-${statusAtual.color}-500`}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Status Atual:</p>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon 
                      icon={statusAtual.icon} 
                      className={`text-${statusAtual.color}-600 text-xl`}
                    />
                    <span className={`font-bold text-${statusAtual.color}-700`}>
                      {statusAtual.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Atualização de Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faEdit} className="text-orange-600" />
                ATUALIZAR STATUS
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {Object.entries(statusOptions).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusChange(key)}
                    disabled={formData.statusAtendimento === key}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.statusAtendimento === key
                        ? `border-${config.color}-500 bg-${config.color}-50 cursor-not-allowed opacity-60`
                        : `border-gray-300 hover:border-${config.color}-400 hover:bg-${config.color}-50`
                    }`}
                  >
                    <FontAwesomeIcon 
                      icon={config.icon} 
                      className={`text-${config.color}-600 text-2xl mb-2`}
                    />
                    <p className={`text-sm font-semibold text-${config.color}-700`}>
                      {config.label}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do Atendimento
                  </label>
                  <input
                    type="date"
                    name="dataAtendimento"
                    value={formData.dataAtendimento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Conclusão
                  </label>
                  <input
                    type="date"
                    name="dataConclusao"
                    value={formData.dataConclusao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    disabled={formData.statusAtendimento !== 'REALIZADO'}
                  />
                </div>
              </div>
            </div>

            {/* Tipo de Atendimento */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">TIPO DE SERVIÇO</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o tipo de serviço prestado
                </label>
                <select
                  name="tipoAtendimento"
                  value={formData.tipoAtendimento}
                  onChange={(e) => {
                    const novoTipoAtendimento = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      tipoAtendimento: novoTipoAtendimento,
                      tipoEspecifico: mapTipoAtendimentoParaEspecifico(novoTipoAtendimento)
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ATENDIMENTO_MEDICO">Atendimento Médico</option>
                  <option value="ATENDIMENTO_ODONTOLOGICO">Atendimento Odontológico</option>
                  <option value="CADASTRO_BENEFICIOS">Cadastro de Benefícios</option>
                  <option value="CURSOS_PROFISSIONALIZANTES">Cursos Profissionalizantes</option>
                  <option value="DISTRIBUICAO_ALIMENTOS">Distribuição de Alimentos</option>
                  <option value="EMISSAO_DOCUMENTOS">Emissão de Documentos</option>
                  <option value="ENCAMINHAMENTO_SOCIAL">Encaminhamento Social</option>
                  <option value="OFICINAS_CAPACITACAO">Oficinas de Capacitação</option>
                  <option value="OFTALMOLOGISTA">Oftalmologista</option>
                  <option value="ORIENTACAO_SAUDE">Orientação de Saúde</option>
                  <option value="ORIENTACAO_JURIDICA">Orientação Jurídica</option>
                  <option value="OUTROS">Outros</option>
                  <option value="HOSPITALAR">Procedimento Hospitalar</option>
                </select>
              </div>
            </div>

            {/* Descrição e Observações */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">DETALHES DO ATENDIMENTO</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Descrição do atendimento..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações / Progresso
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleInputChange}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Adicione observações sobre o andamento..."
                  />
                </div>
              </div>
            </div>

            {/* Dados Específicos do Serviço Prestado */}
            {formData.tipoEspecifico === 'OFTALMOLOGISTA' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faEye} className="text-blue-600" />
                  DADOS OFTALMOLÓGICOS
                </h3>
                
                {/* Tabela de Receita */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Receita Oftalmológica</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 p-2 text-left">Olho</th>
                          <th className="border border-gray-300 p-2">Esférico</th>
                          <th className="border border-gray-300 p-2">Cilíndrico</th>
                          <th className="border border-gray-300 p-2">Eixo</th>
                          <th className="border border-gray-300 p-2">Adição</th>
                          <th className="border border-gray-300 p-2">DNP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Olho Direito */}
                        <tr>
                          <td className="border border-gray-300 p-2 font-semibold bg-gray-50">OD</td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.odEsferico}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, odEsferico: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+/-0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.odCilindrico}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, odCilindrico: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+/-0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.odEixo}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, odEixo: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="0-180°"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.odAdicao}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, odAdicao: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.odDNP}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, odDNP: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="mm"
                            />
                          </td>
                        </tr>
                        
                        {/* Olho Esquerdo */}
                        <tr>
                          <td className="border border-gray-300 p-2 font-semibold bg-gray-50">OE</td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.oeEsferico}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, oeEsferico: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+/-0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.oeCilindrico}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, oeCilindrico: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+/-0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.oeEixo}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, oeEixo: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="0-180°"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.oeAdicao}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, oeAdicao: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="+0.00"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              type="text"
                              value={formData.oftalmologista.oeDNP}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                oftalmologista: { ...prev.oftalmologista, oeDNP: e.target.value }
                              }))}
                              className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder="mm"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tipo de Lente */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Lente</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['UNIFOCAL', 'BIFOCAL', 'MULTIFOCAL', 'ANTI-REFLEXO', 'TRANSITIONS', 'POLI-C/AR', 'COR ESCOLHA', 'SUNSENSORS'].map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 p-2 border border-gray-300 rounded cursor-pointer hover:bg-blue-50">
                        <input
                          type="radio"
                          name="tipoLente"
                          value={tipo}
                          checked={formData.oftalmologista.tipoLente === tipo}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            oftalmologista: { ...prev.oftalmologista, tipoLente: e.target.value }
                          }))}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-gray-700">{tipo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Observações da Receita */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações da Receita
                  </label>
                  <textarea
                    value={formData.oftalmologista.observacoesReceita}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      oftalmologista: { ...prev.oftalmologista, observacoesReceita: e.target.value }
                    }))}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Observações adicionais sobre a receita..."
                  />
                </div>
              </div>
            )}

            {/* Médico */}
            {formData.tipoEspecifico === 'MEDICO' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faUserMd} className="text-green-600" />
                  ATENDIMENTO MÉDICO
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Especialidade
                    </label>
                    <input
                      type="text"
                      value={formData.medico.especialidade}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        medico: { ...prev.medico, especialidade: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Ex: Cardiologia, Ortopedia..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Retorno
                    </label>
                    <input
                      type="date"
                      value={formData.medico.retorno}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        medico: { ...prev.medico, retorno: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diagnóstico
                    </label>
                    <textarea
                      value={formData.medico.diagnostico}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        medico: { ...prev.medico, diagnostico: e.target.value }
                      }))}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Diagnóstico médico..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prescrição / Receituário
                    </label>
                    <textarea
                      value={formData.medico.prescricao}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        medico: { ...prev.medico, prescricao: e.target.value }
                      }))}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Receituário médico..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Medicamentos
                      </label>
                      <textarea
                        value={formData.medico.medicamentos}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          medico: { ...prev.medico, medicamentos: e.target.value }
                        }))}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Lista de medicamentos prescritos..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Posologia
                      </label>
                      <textarea
                        value={formData.medico.posologia}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          medico: { ...prev.medico, posologia: e.target.value }
                        }))}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Modo de uso dos medicamentos..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Orientações Médicas
                    </label>
                    <textarea
                      value={formData.medico.orientacoes}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        medico: { ...prev.medico, orientacoes: e.target.value }
                      }))}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Orientações e cuidados especiais..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Hospitalar */}
            {formData.tipoEspecifico === 'HOSPITALAR' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faHospital} className="text-red-600" />
                  PROCEDIMENTO HOSPITALAR
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Procedimento
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalar.procedimento}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, procedimento: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Tipo de procedimento..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hospital / Clínica
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalar.hospital}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, hospital: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Nome do hospital..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Agendada
                    </label>
                    <input
                      type="date"
                      value={formData.hospitalar.dataAgendamento}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, dataAgendamento: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Horário
                    </label>
                    <input
                      type="time"
                      value={formData.hospitalar.horario}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, horario: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Especialidade
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalar.especialidade}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, especialidade: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Especialidade médica..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Médico Responsável
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalar.medicoResponsavel}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, medicoResponsavel: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Nome do médico..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Acompanhante
                    </label>
                    <input
                      type="text"
                      value={formData.hospitalar.acompanhante}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, acompanhante: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Nome do acompanhante..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exames Necessários
                    </label>
                    <textarea
                      value={formData.hospitalar.examesNecessarios}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, examesNecessarios: e.target.value }
                      }))}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Lista de exames necessários..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preparo para Procedimento
                    </label>
                    <textarea
                      value={formData.hospitalar.preparoProcedimento}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hospitalar: { ...prev.hospitalar, preparoProcedimento: e.target.value }
                      }))}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Instruções de preparo (jejum, medicações, etc)..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Jurídico */}
            {formData.tipoEspecifico === 'JURIDICO' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faGavel} className="text-purple-600" />
                  ATENDIMENTO JURÍDICO
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Área Jurídica
                    </label>
                    <select
                      value={formData.juridico.area}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, area: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="TRABALHISTA">Trabalhista</option>
                      <option value="CIVIL">Civil</option>
                      <option value="FAMILIA">Família</option>
                      <option value="PREVIDENCIARIO">Previdenciário</option>
                      <option value="CRIMINAL">Criminal</option>
                      <option value="CONSUMIDOR">Direito do Consumidor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Processo
                    </label>
                    <input
                      type="text"
                      value={formData.juridico.tipoProcesso}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, tipoProcesso: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ex: Ação Trabalhista, Divórcio..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número do Processo
                    </label>
                    <input
                      type="text"
                      value={formData.juridico.numeroProcesso}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, numeroProcesso: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="0000000-00.0000.0.00.0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vara / Comarca
                    </label>
                    <input
                      type="text"
                      value={formData.juridico.vara}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, vara: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Vara e comarca..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Advogado Responsável
                    </label>
                    <input
                      type="text"
                      value={formData.juridico.advogadoResponsavel}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, advogadoResponsavel: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Nome do advogado e OAB..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Próxima Audiência
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.juridico.proximaAudiencia}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, proximaAudiencia: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Situação do Processo
                    </label>
                    <textarea
                      value={formData.juridico.situacaoProcesso}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, situacaoProcesso: e.target.value }
                      }))}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Situação atual do processo..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Documentos Necessários
                    </label>
                    <textarea
                      value={formData.juridico.documentosNecessarios}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        juridico: { ...prev.juridico, documentosNecessarios: e.target.value }
                      }))}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Lista de documentos necessários..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Histórico de Atualizações */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faHistory} className="text-gray-600" />
                HISTÓRICO DE ATUALIZAÇÕES
              </h3>
              
              <div className="space-y-3">
                {formData.historico && formData.historico.length > 0 ? (
                  formData.historico.map((item, index) => (
                    <div key={index} className="flex gap-4 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                      <div className="flex-shrink-0">
                        <FontAwesomeIcon 
                          icon={faClock} 
                          className="text-gray-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            {statusOptions[item.status]?.label || item.status}
                          </span>
                          <span className="text-xs text-gray-500">{item.data}</span>
                        </div>
                        <p className="text-sm text-gray-600">{item.observacao}</p>
                        <p className="text-xs text-gray-500 mt-1">Por: {item.usuario}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum histórico disponível</p>
                )}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex gap-4 justify-between flex-wrap">
                <button
                  type="button"
                  onClick={() => router.push('/cadastros/atendimentos')}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Voltar
                </button>

                <button
                  type="submit"
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faSave} />
                  Salvar Alterações
                </button>
              </div>
            </div>
          </form>
        </div>
    </Layout>
  );
}
