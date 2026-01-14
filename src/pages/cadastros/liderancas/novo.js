import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSearch, faTimes, faMapMarkerAlt, faCheckCircle, faExclamationCircle, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { criarLiderancaComGeolocalizacao } from '@/services/liderancaService';

export default function NovaLideranca() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError } = useModal();
  
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const [formData, setFormData] = useState({
    // Dados básicos
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    
    // Dados pessoais
    rg: '',
    dataNascimento: '',
    sexo: 'MASCULINO',
    nomePai: '',
    nomeMae: '',
    naturalidade: '',
    estadoCivil: '',
    profissao: '',
    
    // Endereço residencial
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    
    // Dados de liderança
    influencia: 'MÉDIA',
    areaAtuacao: '',
    observacoes: '',
    status: 'ATIVO',
    
    // Localização (geolocalização)
    latitude: '',
    longitude: ''
  });

  // Simulação de banco de dados de eleitores
  // TODO: Substituir por chamada à API/Supabase
  const eleitoresCadastrados = [
    {
      id: 1,
      nome: 'JOÃO DA SILVA SANTOS',
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      dataNascimento: '1985-05-15',
      sexo: 'MASCULINO',
      nomeMae: 'MARIA DA SILVA',
      nomePai: 'JOSÉ SANTOS',
      naturalidade: 'São Paulo',
      estadoCivil: 'CASADO',
      profissao: 'Advogado',
      email: 'joao.silva@email.com',
      telefone: '(11) 3333-3333',
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Apto 101',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      latitude: '-23.5505',
      longitude: '-46.6333'
    },
    {
      id: 2,
      nome: 'MARIA OLIVEIRA SANTOS',
      cpf: '987.654.321-00',
      rg: '98.765.432-1',
      dataNascimento: '1990-08-20',
      sexo: 'FEMININO',
      nomeMae: 'ANA OLIVEIRA',
      nomePai: 'CARLOS SANTOS',
      naturalidade: 'Rio de Janeiro',
      estadoCivil: 'SOLTEIRA',
      profissao: 'Professora',
      email: 'maria.oliveira@email.com',
      telefone: '(11) 2222-2222',
      cep: '04567-890',
      logradouro: 'Rua das Flores',
      numero: '500',
      complemento: '',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
      uf: 'SP',
      latitude: '-23.5875',
      longitude: '-46.6361'
    },
    {
      id: 3,
      nome: 'PEDRO HENRIQUE COSTA',
      cpf: '456.789.123-00',
      rg: '45.678.912-3',
      dataNascimento: '1978-12-10',
      sexo: 'MASCULINO',
      nomeMae: 'HELENA COSTA',
      nomePai: 'ROBERTO COSTA',
      naturalidade: 'Belo Horizonte',
      estadoCivil: 'VIÚVO',
      profissao: 'Empresário',
      email: 'pedro.costa@email.com',
      telefone: '(21) 3333-4444',
      cep: '20040-020',
      logradouro: 'Avenida Rio Branco',
      numero: '123',
      complemento: 'Sala 5',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      latitude: '-22.9068',
      longitude: '-43.1729'
    }
  ];

  const buscarEleitor = (termo) => {
    setBusca(termo);
    
    if (termo.length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    const termoLower = termo.toLowerCase();
    const encontrados = eleitoresCadastrados.filter(eleitor => 
      eleitor.nome.toLowerCase().includes(termoLower) ||
      eleitor.cpf.includes(termo)
    );

    setResultados(encontrados);
    setMostrarResultados(true);
  };

  const selecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    setFormData(prev => ({
      ...prev,
      nome: eleitor.nome,
      cpf: eleitor.cpf,
      email: eleitor.email,
      telefone: eleitor.telefone,
      rg: eleitor.rg,
      dataNascimento: eleitor.dataNascimento,
      sexo: eleitor.sexo,
      nomePai: eleitor.nomePai,
      nomeMae: eleitor.nomeMae,
      naturalidade: eleitor.naturalidade,
      estadoCivil: eleitor.estadoCivil,
      profissao: eleitor.profissao,
      cep: eleitor.cep,
      logradouro: eleitor.logradouro,
      numero: eleitor.numero,
      complemento: eleitor.complemento,
      bairro: eleitor.bairro,
      cidade: eleitor.cidade,
      uf: eleitor.uf,
      latitude: eleitor.latitude,
      longitude: eleitor.longitude
    }));
    setBusca('');
    setResultados([]);
    setMostrarResultados(false);
  };

  const limparSelecao = () => {
    setEleitorSelecionado(null);
    setBusca('');
    setFormData({
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      rg: '',
      dataNascimento: '',
      sexo: 'MASCULINO',
      nomePai: '',
      nomeMae: '',
      naturalidade: '',
      estadoCivil: '',
      profissao: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      influencia: 'MÉDIA',
      areaAtuacao: '',
      observacoes: '',
      status: 'ATIVO',
      latitude: '',
      longitude: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!eleitorSelecionado) {
      showError('Selecione um eleitor para cadastrar como liderança');
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      showError('Dados de localização incompletos. Verifique os dados do eleitor.');
      return;
    }

    setCarregando(true);

    try {
      // Salvar liderança com geolocalização
      const resultado = await criarLiderancaComGeolocalizacao(formData);
      
      showSuccess('Liderança cadastrada com sucesso!');
      
      setTimeout(() => {
        router.push('/cadastros/liderancas');
      }, 2000);
    } catch (error) {
      console.error('Erro ao cadastrar liderança:', error);
      showError('Erro ao cadastrar liderança. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Layout titulo="Cadastro de Nova Liderança">
      <div className="max-w-6xl mx-auto">
        {/* Busca de Eleitor */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg shadow-md p-6 mb-6 border-l-4 border-teal-600">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faSearch} className="text-teal-600" />
            BUSCAR ELEITOR PARA CADASTRAR COMO LIDERANÇA
          </h3>

          {!eleitorSelecionado ? (
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => buscarEleitor(e.target.value)}
                placeholder="Digite o nome ou CPF do eleitor..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              {mostrarResultados && resultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {resultados.map(eleitor => (
                    <button
                      key={eleitor.id}
                      onClick={() => selecionarEleitor(eleitor)}
                      className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b last:border-b-0 transition"
                    >
                      <div className="font-semibold text-gray-800">{eleitor.nome}</div>
                      <div className="text-sm text-gray-600">CPF: {eleitor.cpf}</div>
                    </button>
                  ))}
                </div>
              )}

              {mostrarResultados && resultados.length === 0 && busca.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                  Nenhum eleitor encontrado
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border-2 border-teal-500 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600 text-xl" />
                <div>
                  <div className="font-semibold text-gray-800">{eleitorSelecionado.nome}</div>
                  <div className="text-sm text-gray-600">CPF: {eleitorSelecionado.cpf}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={limparSelecao}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faTimes} />
                Mudar
              </button>
            </div>
          )}
        </div>

        {eleitorSelecionado && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* DADOS PESSOAIS */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                DADOS PESSOAIS
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CPF */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                {/* NOME COMPLETO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME COMPLETO <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* RG */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RG
                  </label>
                  <input
                    type="text"
                    name="rg"
                    value={formData.rg}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* DATA DE NASCIMENTO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    DATA DE NASCIMENTO <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* SEXO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SEXO
                  </label>
                  <select
                    name="sexo"
                    value={formData.sexo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMININO">Feminino</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                {/* NATURALIDADE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NATURALIDADE
                  </label>
                  <input
                    type="text"
                    name="naturalidade"
                    value={formData.naturalidade}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* NOME DO PAI */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME DO PAI
                  </label>
                  <input
                    type="text"
                    name="nomePai"
                    value={formData.nomePai}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* NOME DA MÃE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME DA MÃE
                  </label>
                  <input
                    type="text"
                    name="nomeMae"
                    value={formData.nomeMae}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* ESTADO CIVIL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ESTADO CIVIL
                  </label>
                  <select
                    name="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Escolha uma Opção -</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIÚVO">Viúvo(a)</option>
                    <option value="UNIAO_ESTAVEL">União Estável</option>
                  </select>
                </div>

                {/* PROFISSÃO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PROFISSÃO
                  </label>
                  <input
                    type="text"
                    name="profissao"
                    value={formData.profissao}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* DADOS RESIDENCIAIS */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                DADOS RESIDENCIAIS
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CEP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="00000000"
                  />
                </div>

                {/* LOGRADOURO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LOGRADOURO
                  </label>
                  <input
                    type="text"
                    name="logradouro"
                    value={formData.logradouro}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* NÚMERO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NÚMERO
                  </label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* COMPLEMENTO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    COMPLEMENTO
                  </label>
                  <input
                    type="text"
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* BAIRRO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BAIRRO
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* CIDADE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CIDADE
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* UF */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UF
                  </label>
                  <input
                    type="text"
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    maxLength="2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* DADOS DE LIDERANÇA */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                DADOS DE LIDERANÇA
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* INFLUÊNCIA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NÍVEL DE INFLUÊNCIA
                  </label>
                  <select
                    name="influencia"
                    value={formData.influencia}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MÉDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="MUITO_ALTA">Muito Alta</option>
                  </select>
                </div>

                {/* ÁREA DE ATUAÇÃO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ÁREA DE ATUAÇÃO
                  </label>
                  <input
                    type="text"
                    name="areaAtuacao"
                    value={formData.areaAtuacao}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ex: Saúde, Educação, Comunidade..."
                  />
                </div>

                {/* STATUS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    STATUS
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                {/* CONTATO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TELEFONE
                  </label>
                  <input
                    type="text"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OBSERVAÇÕES
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Adicione observações relevantes sobre a liderança..."
                />
              </div>

              {/* AVISO DE GEOLOCALIZAÇÃO */}
              <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded">
                <div className="flex gap-2 items-start">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-600 mt-1" />
                  <div>
                    <p className="font-semibold text-blue-900">Geolocalização</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Esta liderança será automaticamente registrada no mapa com um ícone de liderança nos dados residenciais indicados.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => router.push('/cadastros/liderancas')}
                disabled={carregando}
                className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {carregando ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} />
                    Salvar Liderança
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.type === 'success' ? 'Sucesso' : 'Erro'}
        message={modalState.message}
        type={modalState.type}
      />
    </Layout>
  );
}
