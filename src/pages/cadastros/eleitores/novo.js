import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faSearch, faCheckCircle, faTimesCircle, faArrowLeft, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export default function NovoEleitor() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [formData, setFormData] = useState({
    // Dados Pessoais
    cpf: '',
    nome: '',
    nomeSocial: '',
    rg: '',
    dataNascimento: '',
    sexo: 'MASCULINO',
    nomePai: '',
    nomeMae: '',
    naturalidade: '',
    estadoCivil: '',
    profissao: '',
    localTrabalho: '',
    
    // Endereço Residencial
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    latitude: '',
    longitude: '',
    
    // Dados Eleitorais
    tituloEleitoral: '',
    secao: '',
    municipio: '',
    zona: '',
    localVotacao: '',
    situacaoTSE: 'ATIVO', // ATIVO ou INATIVO
    biometria: '',
    
    // Dados de Contato
    email: '',
    telefone: '',
    celular: '',
    whatsapp: '',
    
    // Observações
    observacoes: '',
    
    // Status do cadastro
    statusCadastro: 'ATIVO'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Dados do formulário:', formData);
      // Aqui você implementará a integração com Supabase
      
      // Registra o cadastro bem-sucedido
      await registrarCadastro(
        usuario,
        'ELEITORES',
        'Eleitor',
        `eleitor-${Date.now()}`,
        {
          nome: formData.nome,
          cpf: formData.cpf,
          email: formData.email,
          celular: formData.celular
        }
      );
      
      showSuccess('Eleitor cadastrado com sucesso!', () => {
        router.push('/cadastros/eleitores');
      });
    } catch (error) {
      // Registra o erro
      await registrarErro(
        usuario,
        'ELEITORES',
        'Erro ao cadastrar eleitor',
        error
      );
      showError('Erro ao cadastrar: ' + error.message);
    }
  };

  const gerarRelatorioPDF = () => {
    const pdfGen = new PDFGenerator();
    const doc = pdfGen.gerarRelatorioEleitor(formData);
    doc.save(`Relatorio_Eleitor_${formData.nome || 'eleitor'}_${Date.now()}.pdf`);
  };

  const buscarCep = async () => {
    if (formData.cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${formData.cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const consultarTSE = async () => {
    if (!formData.secao) {
      showWarning('Por favor, informe o número da seção');
      return;
    }

    try {
      const response = await fetch('/api/consulta-tse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secao: formData.secao
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          municipio: data.municipio || prev.municipio,
          zona: data.zona?.toString() || prev.zona,
          localVotacao: data.localVotacao || prev.localVotacao
        }));
        
        showSuccess('Dados do TSE consultados com sucesso!');
      } else {
        showError(data.error || 'Erro ao consultar TSE. Verifique a seção informada.');
      }
    } catch (error) {
      console.error('Erro ao consultar TSE:', error);
      showError('Erro ao conectar com o servidor.');
    }
  };

  return (
    <Layout titulo="Cadastro de Novo Eleitor">
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

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6">
            {/* Situação no TSE */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Situação no TSE</h3>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="situacaoTSE"
                    value="ATIVO"
                    checked={formData.situacaoTSE === 'ATIVO'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-green-600"
                  />
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                  <span className="font-semibold text-gray-700">Ativo / TSE</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="situacaoTSE"
                    value="INATIVO"
                    checked={formData.situacaoTSE === 'INATIVO'}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-red-600"
                  />
                  <FontAwesomeIcon icon={faTimesCircle} className="text-red-600" />
                  <span className="font-semibold text-gray-700">Inativo / TSE</span>
                </label>
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4">DADOS PESSOAIS</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleInputChange}
                    placeholder="Somente Números"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NOME COMPLETO <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Nome completo do eleitor"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Social
                  </label>
                  <input
                    type="text"
                    name="nomeSocial"
                    value={formData.nomeSocial}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    RG
                  </label>
                  <input
                    type="text"
                    name="rg"
                    value={formData.rg}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sexo
                  </label>
                  <select
                    name="sexo"
                    value={formData.sexo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="MASCULINO">MASCULINO</option>
                    <option value="FEMININO">FEMININO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome do Pai
                  </label>
                  <input
                    type="text"
                    name="nomePai"
                    value={formData.nomePai}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da Mãe
                  </label>
                  <input
                    type="text"
                    name="nomeMae"
                    value={formData.nomeMae}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Naturalidade
                  </label>
                  <input
                    type="text"
                    name="naturalidade"
                    value={formData.naturalidade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado Civil
                  </label>
                  <select
                    name="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">- Escolha uma Opção -</option>
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIUVO">Viúvo(a)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Profissão
                  </label>
                  <input
                    type="text"
                    name="profissao"
                    value={formData.profissao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Endereço Residencial */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4">DADOS RESIDENCIAIS</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CEP
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      name="cep"
                      value={formData.cep}
                      onChange={handleInputChange}
                      maxLength="8"
                      placeholder="00000000"
                      className="w-24 px-2 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                    <button
                      type="button"
                      onClick={buscarCep}
                      className="px-3 py-2 bg-gray-600 text-white rounded-r-lg hover:bg-gray-700"
                      title="Buscar CEP"
                    >
                      <FontAwesomeIcon icon={faSearch} />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    name="logradouro"
                    value={formData.logradouro}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Número
                  </label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bairro
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Complemento
                  </label>
                  <input
                    type="text"
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    UF
                  </label>
                  <input
                    type="text"
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    maxLength="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Geolocalização <span className="text-xs text-gray-500">(Para o mapa)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleInputChange}
                        placeholder="Latitude (ex: -1.365396)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleInputChange}
                        placeholder="Longitude (ex: -48.372093)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1" />
                    Coordenadas serão usadas para exibir no mapa de geolocalização
                  </p>
                </div>
              </div>
            </div>

            {/* Dados Eleitorais / Locais de Votação */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4">DADOS ELEITORAIS / LOCAIS DE VOTAÇÃO</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nº TÍTULO
                  </label>
                  <input
                    type="text"
                    name="tituloEleitoral"
                    value={formData.tituloEleitoral}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    SEÇÃO
                  </label>
                  <input
                    type="text"
                    name="secao"
                    value={formData.secao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={consultarTSE}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors"
                  >
                    Consultar TSE
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open('https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor', '_blank')}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold text-sm"
                  >
                    Site do TSE
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    MUNICÍPIO
                  </label>
                  <input
                    type="text"
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ZONA
                  </label>
                  <input
                    type="text"
                    name="zona"
                    value={formData.zona}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    LOCAL DE VOTAÇÃO
                  </label>
                  <input
                    type="text"
                    name="localVotacao"
                    value={formData.localVotacao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BIOMETRIA
                </label>
                <select
                  name="biometria"
                  value={formData.biometria}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">- Definir uma Opção -</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </div>
            </div>

            {/* Dados de Contato */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
                DADOS DE CONTATO
                <span className="text-xs font-normal text-gray-500">(Para disparo de mensagens)</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    TELEFONE
                  </label>
                  <input
                    type="tel"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-green-500" />
                    CELULAR / WHATSAPP
                  </label>
                  <input
                    type="tel"
                    name="celular"
                    value={formData.celular}
                    onChange={handleInputChange}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    STATUS DO CADASTRO
                  </label>
                  <select
                    name="statusCadastro"
                    value={formData.statusCadastro}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="border-t pt-6 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                rows="4"
                placeholder="Informações adicionais sobre o eleitor..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-between">
              <button
                type="button"
                onClick={() => router.push('/cadastros/eleitores')}
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
                Salvar Eleitor
              </button>
            </div>
          </form>
        </Layout>
      );
    }
