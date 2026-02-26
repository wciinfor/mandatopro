import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSearch, faTimes, faCheckCircle, faExclamationCircle, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { criarLiderancaComGeolocalizacao } from '@/services/liderancaService';
import { applyMask } from '@/utils/inputMasks';

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
    
    // Dados de liderança
    influencia: 'MÉDIA',
    areaAtuacao: '',
    observacoes: '',
    status: 'ATIVO'
  });

  // Simulação de banco de dados de eleitores
  // TODO: Substituir por chamada à API/Supabase
  // Simulação de banco de dados de eleitores
  // TODO: Substituir por chamada à API/Supabase
  // Removido: dados mockados estão sendo buscados via API

  // Função para validar dados obrigatórios
  const validarDadosEleitor = (eleitor) => {
    const camposFaltando = [];
    
    if (!eleitor.nome) camposFaltando.push('Nome');
    if (!eleitor.cpf) camposFaltando.push('CPF');
    if (!eleitor.email) camposFaltando.push('Email');
    if (!eleitor.telefone) camposFaltando.push('Telefone');
    if (!eleitor.dataNascimento) camposFaltando.push('Data de Nascimento');
    
    return camposFaltando;
  };

  const buscarEleitor = async (termo) => {
    setBusca(termo);
    
    if (termo.length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    setCarregando(true);
    try {
      // Buscar do Supabase através da API
      const response = await fetch(`/api/cadastros/eleitores?search=${encodeURIComponent(termo)}`);
      
      if (response.ok) {
        const dados = await response.json();
        setResultados(dados.data || []);
        setMostrarResultados(true);
      } else {
        setResultados([]);
      }
    } catch (error) {
      console.error('Erro ao buscar eleitores:', error);
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  };

  const selecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    setFormData(prev => ({
      ...prev,
      nome: eleitor.nome,
      cpf: applyMask('cpf', eleitor.cpf || ''),
      email: eleitor.email,
      telefone: applyMask('telefone', eleitor.telefone || ''),
      rg: applyMask('rg', eleitor.rg || ''),
      dataNascimento: eleitor.dataNascimento,
      sexo: eleitor.sexo,
      nomePai: eleitor.nomePai,
      nomeMae: eleitor.nomeMae,
      naturalidade: eleitor.naturalidade,
      estadoCivil: eleitor.estadoCivil,
      profissao: eleitor.profissao
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
      influencia: 'MÉDIA',
      areaAtuacao: '',
      observacoes: '',
      status: 'ATIVO'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData(prev => ({
      ...prev,
      [name]: maskedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!eleitorSelecionado) {
      showError('Selecione um eleitor para cadastrar como liderança');
      return;
    }

    // Validar dados obrigatórios
    const camposFaltando = validarDadosEleitor(formData);
    
    if (camposFaltando.length > 0) {
      const mensagem = `Dados incompletos do eleitor:\n\n${camposFaltando.join('\n')}\n\nCompleto os dados ou tente outro eleitor.`;
      showError(mensagem);
      return;
    }

    setCarregando(true);

    try {
      const payload = {
        ...formData,
        cpf: applyMask('cpf', formData.cpf).replace(/\D/g, ''),
        rg: applyMask('rg', formData.rg).replace(/\D/g, ''),
        telefone: applyMask('telefone', formData.telefone).replace(/\D/g, ''),
        celular: applyMask('celular', formData.celular || '').replace(/\D/g, '')
      };

      // Salvar liderança
      const resultado = await criarLiderancaComGeolocalizacao(payload);
      
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
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => buscarEleitor(e.target.value)}
                  placeholder="Digite o nome ou CPF do eleitor..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {carregando && (
                  <div className="absolute right-4 text-teal-600 animate-spin">
                    ⟳
                  </div>
                )}
              </div>

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

              {mostrarResultados && resultados.length === 0 && busca.length >= 2 && !carregando && (
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
            {/* Aviso de dados faltando */}
            {(() => {
              const camposFaltando = validarDadosEleitor(formData);
              return camposFaltando.length > 0 ? (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                  <div className="flex gap-3">
                    <div className="text-yellow-600 text-2xl">⚠️</div>
                    <div>
                      <h4 className="font-bold text-yellow-800 mb-2">Dados incompletos</h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        Os seguintes dados do eleitor precisam ser preenchidos:
                      </p>
                      <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                        {camposFaltando.map((campo, index) => (
                          <li key={index}>{campo}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                  <div className="flex gap-3 items-center">
                    <div className="text-green-600 text-2xl">✓</div>
                    <p className="text-sm text-green-700 font-semibold">
                      Todos os dados obrigatórios foram preenchidos. Pronto para salvar!
                    </p>
                  </div>
                </div>
              );
            })()}

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
