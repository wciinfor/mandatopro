import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import { 
  FontAwesomeIcon 
} from '@fortawesome/react-fontawesome';
import { 
  faCog, 
  faArrowLeft, 
  faCamera,
  faSave,
  faCheck,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

export default function ConfiguracaoSistema() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('sistema');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);

  // Dados do Sistema
  const [sistema, setSistema] = useState({
    nomeOrgao: '',
    sigla: '',
    logo: null,
    cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
    website: '',
    cargo: '',
    nomeParlamentar: '',
    corPrincipal: '#14b8a6',
    corSecundaria: '#0d9488'
  });

  // Dados WhatsApp Business
  const [whatsapp, setWhatsapp] = useState({
    phoneNumberId: '',
    accessToken: '',
  });

  const [whatsappStatus, setWhatsappStatus] = useState({
    isConfigured: false,
    isConnected: false,
    lastUpdate: null
  });

  // Carregar dados da API
  useEffect(() => {
    try {
      carregarConfiguracoes();

      // Verificar hash para definir aba ativa
      if (window.location.hash === '#whatsapp') {
        setActiveTab('whatsapp');
      } else if (window.location.hash === '#dados') {
        setActiveTab('sistema');
      }
    } catch (error) {
      console.error('Erro ao carregar página de configurações:', error);
    }
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      const response = await fetch('/api/configuracoes');
      if (!response.ok) {
        console.error('Erro ao carregar configurações:', response.status);
        return;
      }
      const result = await response.json();
      
      if (result.success && result.data) {
        setSistema({
          nomeOrgao: result.data.nomeOrgao || '',
          sigla: result.data.sigla || '',
          logo: result.data.logo || null,
          cnpj: result.data.cnpj || '',
          endereco: result.data.endereco || '',
          telefone: result.data.telefone || '',
          email: result.data.email || '',
          website: result.data.website || '',
          cargo: result.data.cargo || '',
          nomeParlamentar: result.data.nomeParlamentar || '',
          corPrincipal: result.data.corPrincipal || '#14b8a6',
          corSecundaria: result.data.corSecundaria || '#0d9488'
        });

        if (result.data.logo) {
          setLogoPreview(result.data.logo);
        }

        if (result.data.whatsapp) {
          setWhatsapp(result.data.whatsapp);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
    
    // Verificar status WhatsApp com tratamento de erro
    try {
      verificarStatusWhatsApp();
    } catch (error) {
      console.error('Erro ao verificar status WhatsApp:', error);
    }
  };

  const verificarStatusWhatsApp = async () => {
    try {
      const response = await fetch('/api/whatsapp-business/config');
      const data = await response.json();
      setWhatsappStatus({
        isConfigured: data.isConfigured || false,
        isConnected: data.isConnected || false,
        lastUpdate: new Date().toLocaleString('pt-BR')
      });
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  // Manipular upload de logo
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSistema({ ...sistema, logo: reader.result });
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Manipular mudanças no Sistema
  const handleSistemaChange = (e) => {
    const { name, value } = e.target;
    setSistema({ ...sistema, [name]: value });
  };

  // Manipular mudanças no WhatsApp
  const handleWhatsappChange = (e) => {
    const { name, value } = e.target;
    setWhatsapp({ ...whatsapp, [name]: value });
  };

  // Salvar configurações do Sistema
  const salvarConfiguracoes = async () => {
    if (!sistema.nomeOrgao || !sistema.cnpj || !sistema.nomeParlamentar) {
      setErrorMessage('Preenchimento obrigatório: Nome do Órgão, CNPJ e Nome do Parlamentar');
      setErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'sistema',
          dados: sistema
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 3000);
      } else {
        throw new Error(data.message || 'Erro ao salvar configuração');
      }
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Salvar WhatsApp Business
  const salvarWhatsApp = async () => {
    if (!whatsapp.phoneNumberId || !whatsapp.accessToken) {
      setErrorMessage('Preenchimento obrigatório: Phone Number ID e Access Token');
      setErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      
      // Salvar na configuração do sistema
      const response = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'whatsapp',
          dados: whatsapp
        })
      });

      const data = await response.json();
      if (data.success) {
        setWhatsappStatus({
          isConfigured: true,
          isConnected: true,
          lastUpdate: new Date().toLocaleString('pt-BR')
        });
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 3000);
      } else {
        throw new Error(data.message || 'Erro ao salvar configuração');
      }
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Testar mensagem WhatsApp
  const testarWhatsApp = async () => {
    const telefone = prompt('Digite um número com DDD (ex: 5591988889999):');
    if (!telefone) return;

    try {
      setLoading(true);
      const response = await fetch('/api/whatsapp-business/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: telefone,
          message: `Teste de configuração do MandatoPro - ${sistema.nomeParlamentar}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 3000);
      } else {
        throw new Error(data.message || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout titulo="Configurações do Sistema">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="hover:bg-teal-700 p-2 rounded transition">
                <FontAwesomeIcon icon={faArrowLeft} size="lg" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FontAwesomeIcon icon={faCog} />
                Configurações do Sistema
              </h1>
              <p className="text-teal-100 mt-1">Personalize seu MandatoPro</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('sistema')}
                className={`py-4 px-2 border-b-2 font-semibold transition ${
                  activeTab === 'sistema'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Dados do Sistema
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`py-4 px-2 border-b-2 font-semibold transition ${
                  activeTab === 'whatsapp'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                WhatsApp Business
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* ABA: SISTEMA */}
          {activeTab === 'sistema' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Dados Gerais do Sistema
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {/* Logo */}
                <div className="md:col-span-1">
                  <div className="bg-gray-100 rounded-lg p-6 border-2 border-dashed border-gray-300 text-center hover:bg-gray-200 transition cursor-pointer relative group">
                    {logoPreview || sistema.logo ? (
                      <img
                        src={logoPreview || sistema.logo}
                        alt="Logo"
                        className="h-40 mx-auto object-contain"
                      />
                    ) : (
                      <div className="py-10">
                        <FontAwesomeIcon
                          icon={faCamera}
                          className="text-gray-400 text-4xl mb-2"
                        />
                        <p className="text-gray-500 text-sm mt-2">
                          Clique para fazer upload da logo
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Recomendado: 200x200px, PNG ou JPG
                  </p>
                </div>

                {/* Dados do Órgão */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nome do Órgão *
                      </label>
                      <input
                        type="text"
                        name="nomeOrgao"
                        value={sistema.nomeOrgao}
                        onChange={handleSistemaChange}
                        placeholder="Ex: Câmara Municipal"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Sigla
                      </label>
                      <input
                        type="text"
                        name="sigla"
                        value={sistema.sigla}
                        onChange={handleSistemaChange}
                        placeholder="Ex: CM"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      name="cnpj"
                      value={sistema.cnpj}
                      onChange={handleSistemaChange}
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="text"
                      name="website"
                      value={sistema.website}
                      onChange={handleSistemaChange}
                      placeholder="https://exemplo.com.br"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço e Contatos */}
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Endereço e Contatos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      name="endereco"
                      value={sistema.endereco}
                      onChange={handleSistemaChange}
                      placeholder="Rua, número, complemento"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Telefone
                    </label>
                    <input
                      type="text"
                      name="telefone"
                      value={sistema.telefone}
                      onChange={handleSistemaChange}
                      placeholder="(XX) XXXXX-XXXX"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={sistema.email}
                      onChange={handleSistemaChange}
                      placeholder="contato@exemplo.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Parlamentar */}
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Dados do Parlamentar
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome do Parlamentar *
                    </label>
                    <input
                      type="text"
                      name="nomeParlamentar"
                      value={sistema.nomeParlamentar}
                      onChange={handleSistemaChange}
                      placeholder="Nome completo"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cargo
                    </label>
                    <input
                      type="text"
                      name="cargo"
                      value={sistema.cargo}
                      onChange={handleSistemaChange}
                      placeholder="Ex: Vereador, Deputado"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cores do Sistema */}
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Cores Personalizadas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cor Principal
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        name="corPrincipal"
                        value={sistema.corPrincipal}
                        onChange={handleSistemaChange}
                        className="h-12 w-20 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={sistema.corPrincipal}
                        readOnly
                        className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cor Secundária
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        name="corSecundaria"
                        value={sistema.corSecundaria}
                        onChange={handleSistemaChange}
                        className="h-12 w-20 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={sistema.corSecundaria}
                        readOnly
                        className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão Salvar */}
              <button
                onClick={salvarConfiguracoes}
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                {loading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          )}

          {/* ABA: WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Integração WhatsApp Business
              </h2>

              {/* Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Status da Configuração</p>
                  <div className="flex items-center gap-2 mt-2">
                    <FontAwesomeIcon
                      icon={whatsappStatus.isConfigured ? faCheck : faTimes}
                      className={whatsappStatus.isConfigured ? 'text-green-600' : 'text-red-600'}
                      size="lg"
                    />
                    <span className={`font-bold ${whatsappStatus.isConfigured ? 'text-green-600' : 'text-red-600'}`}>
                      {whatsappStatus.isConfigured ? 'Configurado' : 'Não configurado'}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Status da Conexão</p>
                  <div className="flex items-center gap-2 mt-2">
                    <FontAwesomeIcon
                      icon={whatsappStatus.isConnected ? faCheck : faTimes}
                      className={whatsappStatus.isConnected ? 'text-blue-600' : 'text-yellow-600'}
                      size="lg"
                    />
                    <span className={`font-bold ${whatsappStatus.isConnected ? 'text-blue-600' : 'text-yellow-600'}`}>
                      {whatsappStatus.isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-l-4 border-gray-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Última Atualização</p>
                  <p className="font-bold text-gray-700 mt-2">
                    {whatsappStatus.lastUpdate || 'Nunca'}
                  </p>
                </div>
              </div>

              {/* Formulário */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6 border-l-4 border-yellow-500">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Passo 1:</strong> Acesse{' '}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Meta for Developers
                    </a>
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Passo 2:</strong> Crie/configure uma app com WhatsApp
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Passo 3:</strong> Copie o Phone Number ID e Access Token abaixo
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    name="phoneNumberId"
                    value={whatsapp.phoneNumberId}
                    onChange={handleWhatsappChange}
                    placeholder="Seu Phone Number ID do Meta"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Encontre em: App → WhatsApp → API Setup
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Access Token *
                  </label>
                  <textarea
                    name="accessToken"
                    value={whatsapp.accessToken}
                    onChange={handleWhatsappChange}
                    placeholder="Seu Access Token do Meta"
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Token permanente (24h) ou temporário. Copie com cuidado!
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 flex-col md:flex-row">
                <button
                  onClick={salvarWhatsApp}
                  disabled={loading}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faSave} />
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>

                <button
                  onClick={testarWhatsApp}
                  disabled={loading || !whatsappStatus.isConfigured}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faCheck} />
                  Enviar Mensagem de Teste
                </button>

                <button
                  onClick={verificarStatusWhatsApp}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Verificar Status
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={successModal}
        title="Sucesso!"
        message="Configuração salva com sucesso!"
        type="success"
        onClose={() => setSuccessModal(false)}
      />

      <Modal
        isOpen={errorModal}
        title="Erro"
        message={errorMessage}
        type="error"
        onClose={() => setErrorModal(false)}
      />
    </Layout>
  );
}
