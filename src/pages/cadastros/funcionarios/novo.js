import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSearch, faUser, faBell
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import BuscaEleitor from '@/components/BuscaEleitor';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import PDFGenerator from '@/utils/pdfGenerator';

export default function NovoFuncionario() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  // Estado do formulário
  const [formData, setFormData] = useState({
    // Dados Pessoais
    foto: null,
    cpf: '',
    nome: '',
    nomeSocial: '',
    rg: '',
    orgaoEmissor: '',
    dataNascimento: '',
    sexo: 'MASCULINO',
    estadoCivil: '',
    nomePai: '',
    nomeMae: '',
    
    // Dados Profissionais
    cargo: '',
    departamento: '',
    dataAdmissao: '',
    salario: '',
    cargaHoraria: '',
    tipoContrato: 'CLT',
    matricula: '',
    
    // Contato
    email: '',
    emailCorporativo: '',
    telefone: '',
    celular: '',
    
    // Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: 'SP',
    
    // Documentos
    ctps: '',
    serieCtps: '',
    pis: '',
    tituloEleitoral: '',
    
    // Dados Bancários
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'CORRENTE',
    pix: '',
    
    // Status
    status: 'ATIVO',
    observacoes: ''
  });

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) {
      router.push('/login');
      return;
    }
    setUsuario(JSON.parse(usuarioStr));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    router.push('/login');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    
    if (eleitor) {
      // Preencher automaticamente os dados do formulário com os dados do eleitor
      setFormData(prev => ({
        ...prev,
        cpf: eleitor.cpf || '',
        nome: eleitor.nome || '',
        rg: eleitor.rg || '',
        orgaoEmissor: eleitor.orgaoEmissor || '',
        dataNascimento: eleitor.dataNascimento || '',
        sexo: eleitor.sexo || 'MASCULINO',
        nomePai: eleitor.nomePai || '',
        nomeMae: eleitor.nomeMae || '',
        email: eleitor.email || '',
        telefone: eleitor.telefone || '',
        celular: eleitor.celular || '',
        cep: eleitor.cep || '',
        logradouro: eleitor.logradouro || '',
        numero: eleitor.numero || '',
        complemento: eleitor.complemento || '',
        bairro: eleitor.bairro || '',
        cidade: eleitor.cidade || '',
        uf: eleitor.uf || 'SP',
        tituloEleitoral: eleitor.tituloEleitoral || ''
      }));
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        showWarning('Por favor, selecione apenas arquivos de imagem.');
        return;
      }
      
      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showWarning('A imagem deve ter no máximo 5MB.');
        return;
      }

      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
        setFormData(prev => ({
          ...prev,
          foto: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removerFoto = () => {
    setFotoPreview(null);
    setFormData(prev => ({
      ...prev,
      foto: null
    }));
  };

  const buscarCep = async () => {
    if (formData.cep.length !== 8) {
      showWarning('CEP deve conter 8 dígitos');
      return;
    }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${formData.cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        showError('CEP não encontrado!');
        return;
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || ''
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      showError('Erro ao buscar CEP. Tente novamente.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.cpf || !formData.nome || !formData.cargo || !formData.departamento) {
      showWarning('Preencha todos os campos obrigatórios: CPF, Nome, Cargo e Departamento');
      return;
    }

    console.log('Dados do funcionário:', formData);
    showSuccess('Funcionário cadastrado com sucesso!', () => {
      router.push('/cadastros/funcionarios');
    });
  };

  // Gerar Crachá
  const handleGerarCracha = () => {
    if (!formData.nome) {
      showWarning('Preencha o nome do funcionário antes de gerar o crachá');
      return;
    }

    const pdfGenerator = new PDFGenerator();
    pdfGenerator.gerarCrachaFuncionario(formData);
    showSuccess('Crachá gerado com sucesso!');
  };

  if (!usuario) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  return (
    <Layout titulo="Cadastro de Novo Funcionário">
      {/* Modal */}
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

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
            {/* Dados Pessoais */}
            <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-teal-600" />
                DADOS PESSOAIS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CPF <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="000.000.000-00"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Social
                  </label>
                  <input
                    type="text"
                    name="nomeSocial"
                    value={formData.nomeSocial}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RG
                  </label>
                  <input
                    type="text"
                    name="rg"
                    value={formData.rg}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Órgão Emissor
                  </label>
                  <input
                    type="text"
                    name="orgaoEmissor"
                    value={formData.orgaoEmissor}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="SSP/SP"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexo
                  </label>
                  <select
                    name="sexo"
                    value={formData.sexo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMININO">Feminino</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado Civil
                  </label>
                  <select
                    name="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Selecione</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIUVO">Viúvo(a)</option>
                    <option value="UNIAO_ESTAVEL">União Estável</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Mãe
                  </label>
                  <input
                    type="text"
                    name="nomeMae"
                    value={formData.nomeMae}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Pai
                  </label>
                  <input
                    type="text"
                    name="nomePai"
                    value={formData.nomePai}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Dados Profissionais */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-l-4 border-blue-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faBriefcase} className="text-blue-600" />
                DADOS PROFISSIONAIS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cargo"
                    value={formData.cargo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Ex: Assessor Parlamentar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="departamento"
                    value={formData.departamento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="GABINETE">Gabinete</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="FINANCEIRO">Financeiro</option>
                    <option value="COMUNICACAO">Comunicação</option>
                    <option value="JURIDICO">Jurídico</option>
                    <option value="ATENDIMENTO">Atendimento ao Cidadão</option>
                    <option value="TI">Tecnologia da Informação</option>
                    <option value="RECURSOS_HUMANOS">Recursos Humanos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    name="dataAdmissao"
                    value={formData.dataAdmissao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salário (R$)
                  </label>
                  <input
                    type="number"
                    name="salario"
                    value={formData.salario}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carga Horária (h/semana)
                  </label>
                  <input
                    type="number"
                    name="cargaHoraria"
                    value={formData.cargaHoraria}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Contrato
                  </label>
                  <select
                    name="tipoContrato"
                    value={formData.tipoContrato}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="CLT">CLT</option>
                    <option value="ESTAGIARIO">Estagiário</option>
                    <option value="TERCEIRIZADO">Terceirizado</option>
                    <option value="COMISSIONADO">Comissionado</option>
                    <option value="TEMPORARIO">Temporário</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border-l-4 border-green-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faPhone} className="text-green-600" />
                CONTATO
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail Pessoal
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    name="emailCorporativo"
                    value={formData.emailCorporativo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone Fixo
                  </label>
                  <input
                    type="tel"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="(11) 3333-3333"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Celular/WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-yellow-600" />
                ENDEREÇO
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="00000-000"
                    maxLength="8"
                  />
                  <button
                    type="button"
                    onClick={buscarCep}
                    className="px-4 py-2 bg-teal-600 text-white rounded-r-lg hover:bg-teal-700 transition-colors"
                  >
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                </div>

                <div className="md:col-span-3">
                  <input
                    type="text"
                    name="logradouro"
                    value={formData.logradouro}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Logradouro"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Número"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Complemento"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Bairro"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Cidade"
                  />
                </div>

                <div>
                  <select
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="AC">AC</option>
                    <option value="AL">AL</option>
                    <option value="AP">AP</option>
                    <option value="AM">AM</option>
                    <option value="BA">BA</option>
                    <option value="CE">CE</option>
                    <option value="DF">DF</option>
                    <option value="ES">ES</option>
                    <option value="GO">GO</option>
                    <option value="MA">MA</option>
                    <option value="MT">MT</option>
                    <option value="MS">MS</option>
                    <option value="MG">MG</option>
                    <option value="PA">PA</option>
                    <option value="PB">PB</option>
                    <option value="PR">PR</option>
                    <option value="PE">PE</option>
                    <option value="PI">PI</option>
                    <option value="RJ">RJ</option>
                    <option value="RN">RN</option>
                    <option value="RS">RS</option>
                    <option value="RO">RO</option>
                    <option value="RR">RR</option>
                    <option value="SC">SC</option>
                    <option value="SP">SP</option>
                    <option value="SE">SE</option>
                    <option value="TO">TO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-l-4 border-purple-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faIdCard} className="text-purple-600" />
                DOCUMENTOS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CTPS
                  </label>
                  <input
                    type="text"
                    name="ctps"
                    value={formData.ctps}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Série CTPS
                  </label>
                  <input
                    type="text"
                    name="serieCtps"
                    value={formData.serieCtps}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIS/PASEP
                  </label>
                  <input
                    type="text"
                    name="pis"
                    value={formData.pis}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título de Eleitor
                  </label>
                  <input
                    type="text"
                    name="tituloEleitoral"
                    value={formData.tituloEleitoral}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Dados Bancários */}
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border-l-4 border-indigo-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faCoins} className="text-indigo-600" />
                DADOS BANCÁRIOS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    name="banco"
                    value={formData.banco}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Caixa, Banco do Brasil..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agência
                  </label>
                  <input
                    type="text"
                    name="agencia"
                    value={formData.agencia}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conta
                  </label>
                  <input
                    type="text"
                    name="conta"
                    value={formData.conta}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Conta
                  </label>
                  <select
                    name="tipoConta"
                    value={formData.tipoConta}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="CORRENTE">Corrente</option>
                    <option value="POUPANCA">Poupança</option>
                    <option value="SALARIO">Salário</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    name="pix"
                    value={formData.pix}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                  />
                </div>
              </div>
            </div>

            {/* Status e Observações */}
            <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border-l-4 border-gray-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                STATUS E OBSERVAÇÕES
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status do Funcionário
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="FERIAS">Férias</option>
                    <option value="LICENCA">Licença</option>
                    <option value="AFASTADO">Afastado</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleInputChange}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Informações adicionais sobre o funcionário..."
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Upload de Foto */}
            <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-purple-50 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-teal-600" />
                FOTO PARA CRACHÁ
              </h3>
              
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="relative inline-block">
                    {fotoPreview ? (
                      <div className="relative">
                        <img
                          src={fotoPreview}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-2xl border-4 border-teal-500 shadow-lg"
                        />
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 shadow-lg transition-colors"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-40 h-40 bg-gradient-to-br from-teal-100 to-purple-100 rounded-2xl border-4 border-dashed border-teal-400 flex flex-col items-center justify-center hover:border-teal-600 transition-colors">
                          <FontAwesomeIcon icon={faUser} className="text-5xl text-teal-400 mb-2" />
                          <span className="text-sm text-gray-600 font-semibold">Adicionar Foto</span>
                          <span className="text-xs text-gray-500 mt-1">JPG, PNG (máx 5MB)</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Foto para crachá e identificação
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-between">
              <button
                type="button"
                onClick={() => router.push('/cadastros/funcionarios')}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Listagem
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                Salvar Funcionário
              </button>
            </div>
          </form>
        </Layout>
      );
    }
