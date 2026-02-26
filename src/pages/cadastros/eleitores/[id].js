import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faSearch, faCheckCircle, faTimesCircle, faArrowLeft, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { applyMask, onlyDigits } from '@/utils/inputMasks';

export default function EditarEleitor() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [loading, setLoading] = useState(true);
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
    situacaoTSE: 'ATIVO',
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

  // Carregar dados do eleitor ao montar
  useEffect(() => {
    if (id) {
      carregarEleitor();
    }
  }, [id]);

  const carregarEleitor = async () => {
    try {
      setLoading(true);
      // Buscar eleitor da API
      const response = await fetch(`/api/cadastros/eleitores/${id}`);
      
      if (!response.ok) {
        throw new Error('Eleitor não encontrado');
      }
      
      const data = await response.json();
      const mapped = {
        ...data,
        nomeSocial: data.nomeSocial || data.nomesocial || '',
        nomePai: data.nomePai || data.nomepai || '',
        nomeMae: data.nomeMae || data.nomemae || '',
        dataNascimento: data.dataNascimento || data.datanascimento || data.data_nascimento || '',
        estadoCivil: data.estadoCivil || data.estadocivil || '',
        sexo: data.sexo || 'MASCULINO',
        localTrabalho: data.localTrabalho || data.localtrabalho || '',
        tituloEleitoral: data.tituloEleitoral || data.tituloeleitoral || '',
        situacaoTSE: data.situacaoTSE || data.situacaotse || data.situacao_tse || 'ATIVO',
        localVotacao: data.localVotacao || data.localvotacao || '',
        logradouro: data.logradouro || data.endereco || '',
        uf: data.uf || data.estado || '',
        statusCadastro: data.statusCadastro || data.statuscadastro || data.status || 'ATIVO'
      };

      const masked = {
        ...mapped,
        cpf: applyMask('cpf', mapped.cpf || ''),
        rg: applyMask('rg', mapped.rg || ''),
        telefone: applyMask('telefone', mapped.telefone || ''),
        celular: applyMask('celular', mapped.celular || ''),
        whatsapp: applyMask('whatsapp', mapped.whatsapp || ''),
        cep: applyMask('cep', mapped.cep || '')
      };

      setFormData(prev => ({
        ...prev,
        ...masked
      }));
    } catch (error) {
      showError('Erro ao carregar eleitor: ' + error.message);
      setTimeout(() => router.push('/cadastros/eleitores'), 2000);
    } finally {
      setLoading(false);
    }
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
    
    try {
      // Validações básicas
      if (!formData.nome.trim()) {
        showWarning('Nome é obrigatório');
        return;
      }

      if (!formData.cpf.trim()) {
        showWarning('CPF é obrigatório');
        return;
      }

      setLoading(true);

      let latitude = formData.latitude ? parseFloat(formData.latitude) : null;
      let longitude = formData.longitude ? parseFloat(formData.longitude) : null;

      // Geocodificar endereco se coordenadas estiverem vazias
      if (!latitude || !longitude) {
        const enderecoPartes = [
          formData.logradouro,
          formData.numero,
          formData.bairro,
          formData.cidade,
          formData.uf,
          formData.cep
        ].filter(Boolean);

        if (enderecoPartes.length < 3) {
          showWarning('Preencha endereco completo para gerar as coordenadas.');
          return;
        }

        const endereco = enderecoPartes.join(', ');
        const geoResponse = await fetch('/api/geolocalizacao/geocodificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: endereco })
        });

        if (!geoResponse.ok) {
          const geoError = await geoResponse.json();
          throw new Error(geoError.error || 'Erro ao gerar coordenadas');
        }

        const geoData = await geoResponse.json();
        latitude = geoData.latitude;
        longitude = geoData.longitude;
      }

      const payload = {
        ...formData,
        cpf: onlyDigits(formData.cpf),
        rg: onlyDigits(formData.rg),
        telefone: onlyDigits(formData.telefone),
        celular: onlyDigits(formData.celular),
        whatsapp: onlyDigits(formData.whatsapp),
        cep: onlyDigits(formData.cep),
        tituloEleitoral: onlyDigits(formData.tituloEleitoral),
        latitude,
        longitude
      };

      // Enviar para API
      const response = await fetch(`/api/cadastros/eleitores/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar eleitor');
      }

      showSuccess('Eleitor atualizado com sucesso!', () => {
        router.push('/cadastros/eleitores');
      });
    } catch (error) {
      showError('Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const buscarCep = async () => {
    const cepDigits = onlyDigits(formData.cep);
    if (cepDigits.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf
          }));
          showSuccess('Endereço encontrado!');
        } else {
          showWarning('CEP não encontrado');
        }
      } catch (error) {
        showError('Erro ao buscar CEP: ' + error.message);
      }
    }
  };

  const handleVoltar = () => {
    router.push('/cadastros/eleitores');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando eleitor...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Modal state={modalState} closeModal={closeModal} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleVoltar}
              className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              title="Voltar"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Editar Eleitor</h1>
              <p className="text-gray-600">ID: {id}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* DADOS PESSOAIS */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📋 DADOS PESSOAIS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NOME COMPLETO *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Digite o nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPF *
                </label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="000.000.000-00"
                  maxLength="14"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NOME SOCIAL
                </label>
                <input
                  type="text"
                  name="nomeSocial"
                  value={formData.nomeSocial}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome social (se houver)"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="RG"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  DATA DE NASCIMENTO
                </label>
                <input
                  type="date"
                  name="dataNascimento"
                  value={formData.dataNascimento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NOME DO PAI
                </label>
                <input
                  type="text"
                  name="nomePai"
                  value={formData.nomePai}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome do pai"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NOME DA MÃE
                </label>
                <input
                  type="text"
                  name="nomeMae"
                  value={formData.nomeMae}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome da mãe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NATURALIDADE
                </label>
                <input
                  type="text"
                  name="naturalidade"
                  value={formData.naturalidade}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Cidade de nascimento"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ESTADO CIVIL
                </label>
                <select
                  name="estadoCivil"
                  value={formData.estadoCivil}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="SOLTEIRO">Solteiro(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="VIUVO">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  PROFISSÃO
                </label>
                <input
                  type="text"
                  name="profissao"
                  value={formData.profissao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Profissão"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LOCAL DE TRABALHO
                </label>
                <input
                  type="text"
                  name="localTrabalho"
                  value={formData.localTrabalho}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Local onde trabalha"
                />
              </div>
            </div>
          </div>

          {/* ENDEREÇO */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              🏠 ENDEREÇO RESIDENCIAL
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CEP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="00000-000"
                    maxLength="8"
                  />
                  <button
                    type="button"
                    onClick={buscarCep}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold"
                  >
                    <FontAwesomeIcon icon={faSearch} className="mr-2" />
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LOGRADOURO
                </label>
                <input
                  type="text"
                  name="logradouro"
                  value={formData.logradouro}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Rua, avenida, etc"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  NÚMERO
                </label>
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Número"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  COMPLEMENTO
                </label>
                <input
                  type="text"
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Apto, sala, etc"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BAIRRO
                </label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Bairro"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CIDADE
                </label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Cidade"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  UF
                </label>
                <input
                  type="text"
                  name="uf"
                  value={formData.uf}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="UF"
                  maxLength="2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LATITUDE
                </label>
                <input
                  type="text"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="-3.119028"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LONGITUDE
                </label>
                <input
                  type="text"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="-60.021308"
                />
              </div>
            </div>
          </div>

          {/* DADOS ELEITORAIS */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              🗳️ DADOS ELEITORAIS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  TÍTULO ELEITORAL
                </label>
                <input
                  type="text"
                  name="tituloEleitoral"
                  value={formData.tituloEleitoral}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Título eleitoral"
                  maxLength="12"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Número da seção"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Zona eleitoral"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  MUNICÍPIO
                </label>
                <input
                  type="text"
                  name="municipio"
                  value={formData.municipio}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Município eleitoral"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  SITUAÇÃO TSE
                </label>
                <select
                  name="situacaoTSE"
                  value={formData.situacaoTSE}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LOCAL DE VOTAÇÃO
                </label>
                <input
                  type="text"
                  name="localVotacao"
                  value={formData.localVotacao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Escola/Local"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  BIOMETRIA
                </label>
                <input
                  type="text"
                  name="biometria"
                  value={formData.biometria}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="ID biometria"
                />
              </div>
            </div>
          </div>

          {/* DADOS DE CONTATO */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📞 DADOS DE CONTATO
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-MAIL
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  TELEFONE RESIDENCIAL
                </label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(00) 0000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CELULAR
                </label>
                <input
                  type="text"
                  name="celular"
                  value={formData.celular}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(00) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  WHATSAPP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="(00) 99999-9999"
                  />
                  {formData.whatsapp && (
                    <a
                      href={`https://wa.me/55${formData.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      title="Abrir no WhatsApp"
                    >
                      <FontAwesomeIcon icon={faWhatsapp} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📝 OBSERVAÇÕES
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                OBSERVAÇÕES GERAIS
              </label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows="4"
                placeholder="Adicione observações sobre este eleitor..."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                STATUS DO CADASTRO
              </label>
              <select
                name="statusCadastro"
                value={formData.statusCadastro}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>
          </div>

          {/* BOTÕES */}
          <div className="flex gap-4 justify-end mb-8">
            <button
              type="button"
              onClick={handleVoltar}
              className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTimesCircle} />
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faSave} />
              {loading ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
