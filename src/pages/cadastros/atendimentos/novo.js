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
  
  // Modo: 'buscar' (eleitor existente) ou 'registrar' (novo eleitor)
  const [modoEleitor, setModoEleitor] = useState('buscar');
  
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState(null);
  const [liderancaSelecionada, setLiderancaSelecionada] = useState(null);
  const [servicosCampanha, setServicosCampanha] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);

  const initialFormData = {
    // Ação Social
    tipoAtendimento: 'ATENDIMENTO_MEDICO',
    liderancaResponsavel: '',
    localidadeAtendida: '',
    servicosOferecidos: '',
    
    // Dados do Eleitor
    eleitorNome: '',
    eleitorCpf: '',
    eleitorRg: '',
    eleitorDataNascimento: '',
    eleitorSexo: '',
    eleitorEmail: '',
    eleitorCelular: '',
    eleitorTelefone: '',
    eleitorEndereco: '',
    eleitorNumero: '',
    eleitorComplemento: '',
    eleitorBairro: '',
    eleitorCidade: '',
    eleitorEstado: '',
    eleitorCep: '',
    eleitorProfissao: '',
    
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
    ausenteAcaoCampanha: false,
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

  // Funções de máscara
  const aplicarMascaraCPF = (valor) => {
    const cpf = valor.replace(/\D/g, '');
    return cpf
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const aplicarMascaraCEP = (valor) => {
    const cep = valor.replace(/\D/g, '');
    return cep
      .slice(0, 8)
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const aplicarMascaraCelular = (valor) => {
    const celular = valor.replace(/\D/g, '');
    return celular
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const removerMascaras = (dados) => {
    const dadosLimpos = { ...dados };
    if (dadosLimpos.eleitorCpf) {
      dadosLimpos.eleitorCpf = dadosLimpos.eleitorCpf.replace(/\D/g, '');
    }
    if (dadosLimpos.eleitorCelular) {
      dadosLimpos.eleitorCelular = dadosLimpos.eleitorCelular.replace(/\D/g, '');
    }
    if (dadosLimpos.eleitorCep) {
      dadosLimpos.eleitorCep = dadosLimpos.eleitorCep.replace(/\D/g, '');
    }
    return dadosLimpos;
  };

  const handleInputChange = (e) => {
    let { name, value, type, checked } = e.target;
    
    // Aplicar máscaras
    if (name === 'eleitorCpf') {
      value = aplicarMascaraCPF(value);
    } else if (name === 'eleitorCep') {
      value = aplicarMascaraCEP(value);
    } else if (name === 'eleitorCelular') {
      value = aplicarMascaraCelular(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Se o campo alterado é o CEP, fazer busca automática
    if (name === 'eleitorCep') {
      const cepLimpo = value.replace(/\D/g, '');
      if (cepLimpo.length === 8) {
        handleBuscaCep(cepLimpo);
      }
    }
  };

  const handleBuscaCep = async (cepLimpo) => {
    if (cepLimpo.length !== 8) {
      return;
    }
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        showWarning('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      
      // Preencher automaticamente os campos
      setFormData(prev => ({
        ...prev,
        eleitorEndereco: data.logradouro || '',
        eleitorBairro: data.bairro || '',
        eleitorCidade: data.localidade || '',
        eleitorEstado: data.uf || ''
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      showError('Erro ao buscar CEP. Tente novamente.');
    }
  };

  const handleSelecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    
    if (eleitor) {
      // Preencher automaticamente os dados do eleitor no atendimento
      setFormData(prev => ({
        ...prev,
        eleitorNome: eleitor.nome || '',
        eleitorCpf: eleitor.cpf || '',
        eleitorRg: eleitor.rg || '',
        eleitorEmail: eleitor.email || '',
        eleitorCelular: eleitor.celular || eleitor.telefone || '',
        eleitorTelefone: eleitor.telefone || '',
        eleitorEndereco: eleitor.endereco || '',
        eleitorNumero: eleitor.numero || '',
        eleitorComplemento: eleitor.complemento || '',
        eleitorBairro: eleitor.bairro || '',
        eleitorCidade: eleitor.cidade || '',
        eleitorEstado: eleitor.estado || '',
        eleitorCep: eleitor.cep || '',
        eleitorDataNascimento: eleitor.data_nascimento || '',
        eleitorSexo: eleitor.sexo || '',
        eleitorProfissao: eleitor.profissao || ''
      }));
    } else {
      // Limpar dados do eleitor
      setFormData(prev => ({
        ...prev,
        eleitorNome: '',
        eleitorCpf: '',
        eleitorRg: '',
        eleitorEmail: '',
        eleitorCelular: '',
        eleitorTelefone: '',
        eleitorEndereco: '',
        eleitorNumero: '',
        eleitorComplemento: '',
        eleitorBairro: '',
        eleitorCidade: '',
        eleitorEstado: '',
        eleitorCep: '',
        eleitorDataNascimento: '',
        eleitorSexo: '',
        eleitorProfissao: ''
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
        // Extrair serviços da campanha com ESTRUTURA { id, nome } para uso posterior na persistência
        const servicos = campanha.campanhas_servicos?.map(s => ({
          id: s.categorias_servicos?.id,
          nome: s.categorias_servicos?.nome
        })).filter(s => s.id && s.nome) || [];
        
        setServicosCampanha(servicos);
        setServicosSelecionados(servicos); // Marcar automaticamente todos os serviços da campanha por padrão
        
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
      // Comparar por ID de serviço para evitar problemas com referência de objeto
      const servicoId = servico.id;
      const jaExiste = prev.some(s => s.id === servicoId);
      
      if (jaExiste) {
        return prev.filter(item => item.id !== servicoId);
      }
      return [...prev, servico];
    });
  };

  const normalizarServicoNome = (nome) => {
    if (!nome) return '';
    return nome
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  };

  const mapServicoParaTipoAtendimento = (nomeServico) => {
    const normalizado = normalizarServicoNome(nomeServico);
    const mapa = {
      'ATENDIMENTO MEDICO': 'ATENDIMENTO_MEDICO',
      'ATENDIMENTO ODONTOLOGICO': 'ATENDIMENTO_ODONTOLOGICO',
      'CADASTRO BENEFICIOS': 'CADASTRO_BENEFICIOS',
      'CADASTRO DE BENEFICIOS': 'CADASTRO_BENEFICIOS',
      'CURSOS PROFISSIONALIZANTES': 'CURSOS_PROFISSIONALIZANTES',
      'DISTRIBUICAO ALIMENTOS': 'DISTRIBUICAO_ALIMENTOS',
      'DISTRIBUICAO DE ALIMENTOS': 'DISTRIBUICAO_ALIMENTOS',
      'EMISSAO DOCUMENTOS': 'EMISSAO_DOCUMENTOS',
      'EMISSAO DE DOCUMENTOS': 'EMISSAO_DOCUMENTOS',
      'ENCAMINHAMENTO SOCIAL': 'ENCAMINHAMENTO_SOCIAL',
      'OFICINAS CAPACITACAO': 'OFICINAS_CAPACITACAO',
      'OFICINAS DE CAPACITACAO': 'OFICINAS_CAPACITACAO',
      'OFTALMOLOGISTA': 'OFTALMOLOGISTA',
      'ORIENTACAO SAUDE': 'ORIENTACAO_SAUDE',
      'ORIENTACAO DE SAUDE': 'ORIENTACAO_SAUDE',
      'ORIENTACAO JURIDICA': 'ORIENTACAO_JURIDICA',
      'ORIENTACAO JURIDICA': 'ORIENTACAO_JURIDICA',
      'OUTROS': 'OUTROS'
    };

    return mapa[normalizado] || 'OUTROS';
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
    
    let eleitorIdParaAtendimento = null;
    
    // Modo 1: Buscar eleitor existente
    if (modoEleitor === 'buscar') {
      if (!eleitorSelecionado?.id) {
        showWarning('Selecione um eleitor antes de salvar');
        return;
      }
      eleitorIdParaAtendimento = eleitorSelecionado.id;
    }
    
    // Modo 2: Registrar novo eleitor
    if (modoEleitor === 'registrar') {
      if (!formData.eleitorNome) {
        showWarning('Preencha o nome do novo eleitor');
        return;
      }
      
      // Criar novo eleitor primeiro
      try {
        setSalvando(true);
        
        // Limpar máscaras dos dados antes de enviar
        const dadosLimpos = removerMascaras(formData);
        
        const novoEleitorResponse = await fetch('/api/cadastros/eleitores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: dadosLimpos.eleitorNome,
            cpf: dadosLimpos.eleitorCpf,
            rg: dadosLimpos.eleitorRg || '',
            email: dadosLimpos.eleitorEmail || '',
            celular: dadosLimpos.eleitorCelular || '',
            telefone: dadosLimpos.eleitorTelefone || '',
            endereco: dadosLimpos.eleitorEndereco || '',
            numero: dadosLimpos.eleitorNumero || '',
            complemento: dadosLimpos.eleitorComplemento || '',
            bairro: dadosLimpos.eleitorBairro || '',
            cidade: dadosLimpos.eleitorCidade || '',
            estado: dadosLimpos.eleitorEstado || '',
            cep: dadosLimpos.eleitorCep || '',
            data_nascimento: dadosLimpos.eleitorDataNascimento || '',
            sexo: dadosLimpos.eleitorSexo || '',
            profissao: dadosLimpos.eleitorProfissao || '',
            lideranca_id: liderancaSelecionada?.id || null,
            lideranca: liderancaSelecionada?.nome || formData.liderancaResponsavel || '',
            status: 'ATIVO'
          })
        });

        if (!novoEleitorResponse.ok) {
          const error = await novoEleitorResponse.json();
          throw new Error(error.error || 'Erro ao criar novo eleitor');
        }

        const novoEleitorData = await novoEleitorResponse.json();
        eleitorIdParaAtendimento = novoEleitorData.id;
        
        // Atualizar o formulário com os dados do eleitor criado
        setEleitorSelecionado(novoEleitorData);
        showSuccess(`Eleitor "${formData.eleitorNome}" criado com sucesso!`);
        
      } catch (error) {
        showError('Erro ao criar novo eleitor: ' + error.message);
        setSalvando(false);
        return;
      }
    }

    // Criar o atendimento vinculado ao eleitor
    const campanhaValida = campanhaSelecionada?.id && campanhaSelecionada?.id !== 'AVULSO';
    const temServicosSelecionados = campanhaValida && servicosSelecionados.length > 0;
    const payloadBase = {
      eleitorId: eleitorIdParaAtendimento,
      liderancaId: liderancaSelecionada?.id || null,
      descricao: formData.descricao || formData.servicosOferecidos || '',
      resultado: formData.observacoes || '',
      status: formData.statusAtendimento,
      ausenteAcaoCampanha: Boolean(formData.ausenteAcaoCampanha),
      dataAtendimento: formData.dataAtendimento || null,
      campanhaId: campanhaValida ? campanhaSelecionada.id : null
    };
    
    // Enviar notificação se habilitado
    if (formData.notificarEleitor && formData.eleitorCelular) {
      const mensagem = `Olá ${formData.eleitorNome}! Seu atendimento foi registrado. Status: ${formData.statusAtendimento}. Acompanhe o progresso pelo sistema.`;
      
      await enviarNotificacao(formData.modoNotificacao, mensagem);
    }
    
    try {
      if (temServicosSelecionados) {
        for (const servico of servicosSelecionados) {
          const nomeServico = typeof servico === 'string' ? servico : servico.nome;
          const tipoAtendimento = mapServicoParaTipoAtendimento(nomeServico);

          const payload = {
            ...payloadBase,
            tipoAtendimento,
            assunto: nomeServico || formData.tipoEspecifico || formData.tipoAtendimentoJuridico || '',
            servicosSelecionados: [servico]
          };

          const response = await fetch('/api/cadastros/atendimentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao salvar atendimento');
          }
        }
      } else {
        const payload = {
          ...payloadBase,
          tipoAtendimento: formData.tipoAtendimento,
          assunto: formData.tipoEspecifico || formData.tipoAtendimentoJuridico || '',
          servicosSelecionados
        };

        const response = await fetch('/api/cadastros/atendimentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao salvar atendimento');
        }
      }

      const totalCriados = temServicosSelecionados ? servicosSelecionados.length : 1;
      const mensagemSucesso = totalCriados > 1
        ? `${totalCriados} atendimentos criados com sucesso!`
        : 'Atendimento cadastrado com sucesso!';

      showSuccess(mensagemSucesso, () => {
        setFormData(initialFormData);
        setEleitorSelecionado(null);
        setCampanhaSelecionada(null);
        setLiderancaSelecionada(null);
        setServicosCampanha([]);
        setServicosSelecionados([]);
        setModoEleitor('buscar');
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

      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Toggle: Buscar Eleitor Existente ou Registrar Novo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-5 lg:p-6">
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-4 bg-teal-600 rounded-full inline-block"></span>
            Como deseja começar?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setModoEleitor('buscar')}
              className={`px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                modoEleitor === 'buscar'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔍 Buscar Eleitor Existente
            </button>
            <button
              type="button"
              onClick={() => setModoEleitor('registrar')}
              className={`px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                modoEleitor === 'registrar'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ➕ Registrar Novo Eleitor
            </button>
          </div>
        </div>

        {/* Busca de Eleitor Existente */}
        {modoEleitor === 'buscar' && (
          <div className="w-full">
            <BuscaEleitor 
              onSelecionarEleitor={handleSelecionarEleitor}
              eleitorSelecionado={eleitorSelecionado}
            />
          </div>
        )}

        {/* Registrar Novo Eleitor */}
        {modoEleitor === 'registrar' && (
          <div className="bg-blue-50/80 border-2 border-blue-200 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 mb-1">Dados do Novo Eleitor</h3>
              <p className="text-sm text-blue-800">📝 Preencha os dados da ficha entregue. Os campos marcados com * são obrigatórios. Você pode completar os dados depois.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Nome Completo */}
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="eleitorNome"
                  value={formData.eleitorNome}
                  onChange={handleInputChange}
                  placeholder="Nome da pessoa"
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                />
              </div>

              {/* RG */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  RG
                </label>
                <input
                  type="text"
                  name="eleitorRg"
                  value={formData.eleitorRg}
                  onChange={handleInputChange}
                  placeholder="RG (opcional)"
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>

              {/* CPF */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="eleitorCpf"
                  value={formData.eleitorCpf}
                  onChange={handleInputChange}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  required
                />
              </div>

              {/* Data de Nascimento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  name="eleitorDataNascimento"
                  value={formData.eleitorDataNascimento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Sexo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sexo
                </label>
                <select
                  name="eleitorSexo"
                  value={formData.eleitorSexo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Selecionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              {/* Celular / WhatsApp */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Celular / WhatsApp
                </label>
                <input
                  type="tel"
                  name="eleitorCelular"
                  value={formData.eleitorCelular}
                  onChange={handleInputChange}
                  placeholder="(85) 98765-4321"
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Email */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="eleitorEmail"
                  value={formData.eleitorEmail}
                  onChange={handleInputChange}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            {/* Container de Endereço */}
            <div className="mt-4 p-5 bg-white/90 rounded-xl border border-green-300 shadow-2xs">
              <h4 className="text-base font-bold text-green-900 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faMapMarkedAlt} />
                Endereço
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* CEP */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="eleitorCep"
                    value={formData.eleitorCep}
                    onChange={handleInputChange}
                    placeholder="00000-000"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono bg-white"
                  />
                  <p className="text-xs text-green-700 mt-1">Pressione TAB para preencher</p>
                </div>

                {/* Endereço */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    name="eleitorEndereco"
                    value={formData.eleitorEndereco}
                    onChange={handleInputChange}
                    placeholder="Rua, Avenida, etc"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Número */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    name="eleitorNumero"
                    value={formData.eleitorNumero}
                    onChange={handleInputChange}
                    placeholder="000"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Complemento */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    name="eleitorComplemento"
                    value={formData.eleitorComplemento}
                    onChange={handleInputChange}
                    placeholder="Apto, Bloco, etc"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Bairro */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    name="eleitorBairro"
                    value={formData.eleitorBairro}
                    onChange={handleInputChange}
                    placeholder="Bairro"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Cidade */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    name="eleitorCidade"
                    value={formData.eleitorCidade}
                    onChange={handleInputChange}
                    placeholder="Cidade"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Estado */}
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    name="eleitorEstado"
                    value={formData.eleitorEstado}
                    onChange={handleInputChange}
                    placeholder="PA"
                    maxLength="2"
                    className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-blue-700 mt-2 bg-blue-100/70 p-3 rounded-lg">
              ✅ Após salvar, os dados serão registrados na base de eleitores e você poderá completar o cadastro depois.
            </p>
          </div>
        )}

        {/* Busca de Campanha - após seleção do eleitor ou preenchimento de nome (registrar novo) */}
        {(eleitorSelecionado || modoEleitor === 'registrar') && formData.eleitorNome && (
          <div className="w-full">
            <BuscaCampanha 
              onSelecionarCampanha={handleSelecionarCampanha}
              campanhaSelecionada={campanhaSelecionada}
            />
          </div>
        )}

        {/* Formulário Principal de Atendimento */}
        <form onSubmit={handleSubmit} className="w-full bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 lg:p-8 space-y-6">
          {/* Status do Atendimento - Badge no Topo */}
          <div className="flex flex-wrap gap-3 items-center justify-between border-b border-gray-100 pb-5">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Situação do Registro</span>
              <span className="text-sm font-semibold text-gray-700">Defina o status inicial do atendimento</span>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => atualizarStatus('AGENDADO')}
                className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  formData.statusAtendimento === 'AGENDADO'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FontAwesomeIcon icon={faClock} />
                Agendado
              </button>
              <button
                type="button"
                onClick={() => atualizarStatus('CANCELADO')}
                className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  formData.statusAtendimento === 'CANCELADO'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FontAwesomeIcon icon={faTimesCircle} />
                Cancelado
              </button>
              <button
                type="button"
                onClick={() => atualizarStatus('REALIZADO')}
                className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  formData.statusAtendimento === 'REALIZADO'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                Realizado
              </button>
            </div>
          </div>

          {/* Tipo de Atendimento - Oculto se campanha existente selecionada */}
          {(!campanhaSelecionada || campanhaSelecionada.id === 'AVULSO') && (
            <div className="p-5 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border border-teal-200">
              <h3 className="text-base font-bold text-gray-800 mb-2">Tipo de Atendimento</h3>
              <select
                name="tipoAtendimento"
                value={formData.tipoAtendimento}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-semibold bg-white"
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
              </select>
            </div>
          )}

          {/* Campanha selecionada */}
          {campanhaSelecionada && campanhaSelecionada.id !== 'AVULSO' && (
            <div className="border border-teal-100 rounded-xl p-5 bg-teal-50/40 space-y-4">
              <h3 className="text-base font-bold text-teal-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faHandshake} className="text-teal-600" />
                CAMPANHA VINCULADA
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Liderança Responsável <span className="text-red-500">*</span>
                      </label>
                      <div className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 space-y-1">
                        {formData.liderancaResponsavel ? (
                          <>
                            <div className="font-semibold text-gray-800">{formData.liderancaResponsavel}</div>
                            <div className="text-xs text-gray-500">
                              <span className="inline-block bg-teal-100 text-teal-700 px-2 py-0.5 rounded font-semibold">
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
                        <p className="text-xs text-amber-600 mt-1">⚠️ Campanha sem liderança cadastrada</p>
                      )}
                    </>
                  )}
                </div>

                {/* Localidade Atendida */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Localidade Atendida <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="localidadeAtendida"
                    value={formData.localidadeAtendida}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                    placeholder={campanhaSelecionada?.id === 'AVULSO' ? 'Informar localidade...' : ''}
                  />
                  {campanhaSelecionada?.id !== 'AVULSO' && (
                    <p className="text-xs text-gray-500 mt-1">✓ Preenchido automaticamente da campanha</p>
                  )}
                </div>
              </div>

              {/* Serviços da Campanha */}
              <div className="pt-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Serviços Oferecidos {campanhaSelecionada?.id === 'AVULSO' ? '(Selecione os serviços)' : '(Da campanha)'}
                </label>
                
                {campanhaSelecionada?.id === 'AVULSO' ? (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-3.5">
                    <p className="text-xs text-gray-700 mb-2 font-medium">
                      💡 Atendimento avulso - Selecione os serviços oferecidos ou descreva abaixo:
                    </p>
                    <textarea
                      name="servicosOferecidos"
                      value={formData.servicosOferecidos}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Descreva os serviços oferecidos neste atendimento avulso..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>
                ) : servicosCampanha.length > 0 ? (
                  <div className="bg-white border border-teal-200 rounded-xl p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {servicosCampanha.map((servico, idx) => (
                        <label key={idx} className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-teal-50/60 rounded-lg border border-gray-200 cursor-pointer transition-colors select-none">
                          <input
                            type="checkbox"
                            id={`servico-${idx}`}
                            checked={servicosSelecionados.some(s => (typeof s === 'string' ? s === servico.nome : s.id === servico.id))}
                            onChange={() => toggleServicoCampanha(servico)}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 accent-teal-600"
                          />
                          <span className="text-xs font-medium text-gray-800">
                            {servico.nome}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800">
                    ⚠️ Esta campanha não possui serviços cadastrados. Descreva os serviços abaixo:
                    <textarea
                      name="servicosOferecidos"
                      value={formData.servicosOferecidos}
                      onChange={handleInputChange}
                      rows="2"
                      placeholder="Descreva os serviços oferecidos..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mt-2 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Atendimento Jurídico */}
          {formData.tipoAtendimento === 'ATENDIMENTO_JURIDICO' && (
            <div className="border-t border-gray-100 pt-5 space-y-3">
              <h3 className="text-base font-bold text-teal-700 flex items-center gap-2">
                <FontAwesomeIcon icon={faGavel} className="text-teal-600" />
                ATENDIMENTO JURÍDICO
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Tipo de Atendimento
                  </label>
                  <input
                    type="text"
                    name="tipoAtendimentoJuridico"
                    value={formData.tipoAtendimentoJuridico}
                    onChange={handleInputChange}
                    placeholder="Ex: Consultoria, Processo, Orientação"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Agendamento
                  </label>
                  <input
                    type="datetime-local"
                    name="agendamento"
                    value={formData.agendamento}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dados do Eleitor */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <h3 className="text-base font-bold text-teal-800">DADOS DO ELEITOR SELECIONADO</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="eleitorCpf"
                  value={formData.eleitorCpf}
                  readOnly
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-mono text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="eleitorNome"
                  value={formData.eleitorNome}
                  readOnly
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-800 font-semibold text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faWhatsapp} className="text-emerald-500" />
                  Celular / WhatsApp
                </label>
                <input
                  type="tel"
                  name="eleitorCelular"
                  value={formData.eleitorCelular}
                  readOnly
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="eleitorEmail"
                  value={formData.eleitorEmail}
                  readOnly
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            {campanhaSelecionada && campanhaSelecionada.id !== 'AVULSO' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="ausenteAcaoCampanha"
                    checked={formData.ausenteAcaoCampanha}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 accent-amber-600"
                  />
                  <div>
                    <span className="block font-bold text-sm text-amber-900">Ausente na ação/Campanha</span>
                    <span className="block text-xs text-amber-800">
                      Marque quando o eleitor estava vinculado à campanha, mas não compareceu ao atendimento.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Descrição e Observações */}
          <div className="border-t border-gray-100 pt-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Descrição do Atendimento
                </label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Descreva detalhadamente o atendimento realizado..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Observações Gerais
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Observações ou anotações internas adicionais..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <h3 className="text-base font-bold text-teal-800">DATAS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Data do Atendimento
                </label>
                <input
                  type="date"
                  name="dataAtendimento"
                  value={formData.dataAtendimento}
                  onChange={handleInputChange}
                  disabled={campanhaSelecionada?.id && campanhaSelecionada.id !== 'AVULSO'}
                  className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 ${
                    campanhaSelecionada?.id && campanhaSelecionada.id !== 'AVULSO'
                      ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                      : 'bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Data de Conclusão
                </label>
                <input
                  type="date"
                  name="dataConclusao"
                  value={formData.dataConclusao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Configurações de Notificação */}
          <div className="border-t border-gray-100 pt-5">
            <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <FontAwesomeIcon icon={faBell} className="text-blue-600" />
                NOTIFICAÇÕES AUTOMÁTICAS
              </h3>
              
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="notificarEleitor"
                    checked={formData.notificarEleitor}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 accent-teal-600"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    Notificar eleitor sobre atualizações do atendimento
                  </span>
                </label>
              </div>

              {formData.notificarEleitor && (
                <div className="pt-2 border-t border-blue-200/60">
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">
                    Canal de Notificação
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="EMAIL"
                        checked={formData.modoNotificacao === 'EMAIL'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 accent-blue-600"
                      />
                      <FontAwesomeIcon icon={faEnvelope} className="text-blue-600" />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="SMS"
                        checked={formData.modoNotificacao === 'SMS'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-green-600 accent-green-600"
                      />
                      <FontAwesomeIcon icon={faPhone} className="text-green-600" />
                      <span>SMS</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                      <input
                        type="radio"
                        name="modoNotificacao"
                        value="WHATSAPP"
                        checked={formData.modoNotificacao === 'WHATSAPP'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-green-500 accent-green-500"
                      />
                      <FontAwesomeIcon icon={faWhatsapp} className="text-green-500" />
                      <span>WhatsApp</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.push('/cadastros/atendimentos')}
              className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Voltar para Lista
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faSave} />
              {salvando ? 'Salvando...' : 'Salvar Atendimento'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
    }
