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
      if (!formData.eleitorNome || !formData.eleitorCpf) {
        showWarning('Preencha o nome e CPF/RG do novo eleitor');
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
      descricao: formData.descricao || formData.servicosOferecidos || '',
      resultado: formData.observacoes || '',
      status: formData.statusAtendimento,
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


      {/* Toggle: Buscar Eleitor Existente ou Registrar Novo */}
      <div className="max-w-6xl mx-auto mb-6 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-700 mb-4">Como deseja começar?</h2>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setModoEleitor('buscar')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              modoEleitor === 'buscar'
                ? 'bg-teal-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🔍 Buscar Eleitor Existente
          </button>
          <button
            type="button"
            onClick={() => setModoEleitor('registrar')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              modoEleitor === 'registrar'
                ? 'bg-teal-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ➕ Registrar Novo Eleitor
          </button>
        </div>
      </div>

      {/* Busca de Eleitor Existente */}
      {modoEleitor === 'buscar' && (
        <div className="max-w-6xl mx-auto mb-6">
          <BuscaEleitor 
            onSelecionarEleitor={handleSelecionarEleitor}
            eleitorSelecionado={eleitorSelecionado}
          />
        </div>
      )}

      {/* Registrar Novo Eleitor */}
      {modoEleitor === 'registrar' && (
        <div className="max-w-6xl mx-auto mb-6 bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Dados do Novo Eleitor</h3>
          <p className="text-sm text-blue-800 mb-4">📝 Preencha os dados da ficha entregue. Os campos marcados com * são obrigatórios. Você pode completar os dados depois.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nome Completo */}
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                name="eleitorNome"
                value={formData.eleitorNome}
                onChange={handleInputChange}
                placeholder="Nome da pessoa"
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* CPF */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                CPF *
              </label>
              <input
                type="text"
                name="eleitorCpf"
                value={formData.eleitorCpf}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecionar</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            {/* Celular / WhatsApp */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Celular / WhatsApp
              </label>
              <input
                type="tel"
                name="eleitorCelular"
                value={formData.eleitorCelular}
                onChange={handleInputChange}
                placeholder="(85) 98765-4321"
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="eleitorEmail"
                value={formData.eleitorEmail}
                onChange={handleInputChange}
                placeholder="email@example.com"
                className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Container de Endereço */}
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-300">
            <h4 className="text-base font-bold text-green-900 mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faMapMarkedAlt} />
              Endereço
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CEP */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  name="eleitorCep"
                  value={formData.eleitorCep}
                  onChange={handleInputChange}
                  placeholder="00000-000"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-green-700 mt-1">Pressione TAB ou clique fora para buscar</p>
              </div>

              {/* Endereço */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  name="eleitorEndereco"
                  value={formData.eleitorEndereco}
                  onChange={handleInputChange}
                  placeholder="Rua, Avenida, etc"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Número */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  name="eleitorNumero"
                  value={formData.eleitorNumero}
                  onChange={handleInputChange}
                  placeholder="000"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Complemento */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  name="eleitorComplemento"
                  value={formData.eleitorComplemento}
                  onChange={handleInputChange}
                  placeholder="Apto 101, Bloco A, etc"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  name="eleitorBairro"
                  value={formData.eleitorBairro}
                  onChange={handleInputChange}
                  placeholder="Nome do bairro"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  name="eleitorCidade"
                  value={formData.eleitorCidade}
                  onChange={handleInputChange}
                  placeholder="Nome da cidade"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Estado
                </label>
                <input
                  type="text"
                  name="eleitorEstado"
                  value={formData.eleitorEstado}
                  onChange={handleInputChange}
                  placeholder="CE"
                  maxLength="2"
                  className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-blue-700 mt-4 bg-blue-100 p-3 rounded">
            ✅ Após salvar, os dados serão registrados na base de eleitores e você poderá completar o cadastro depois.
          </p>
        </div>
      )}

      {/* Busca de Campanha - após seleção do eleitor ou preenchimento de nome (registrar novo) */}
      {(eleitorSelecionado || modoEleitor === 'registrar') && formData.eleitorNome && (
        <div className="max-w-6xl mx-auto mb-6">
          <BuscaCampanha 
            onSelecionarCampanha={handleSelecionarCampanha}
            campanhaSelecionada={campanhaSelecionada}
          />
        </div>
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
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faHandshake} className="text-teal-600" />
                  CAMPANHA SELECIONADA
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
                              checked={servicosSelecionados.some(s => (typeof s === 'string' ? s === servico.nome : s.id === servico.id))}
                              onChange={() => toggleServicoCampanha(servico)}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <label htmlFor={`servico-${idx}`} className="text-sm text-gray-700 cursor-pointer">
                              {servico.nome}
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
