import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/utils/permissions';
import { 
  FontAwesomeIcon 
} from '@fortawesome/react-fontawesome';
import { 
  faCog, 
  faArrowLeft, 
  faCamera,
  faSave,
  faCheck,
  faTimes,
  faRobot,
  faKey,
  faPlug,
  faSyncAlt,
  faExclamationTriangle,
  faBuilding,
  faPhone,
  faChartLine,
  faShieldAlt,
  faClipboardCheck,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

const WHATSAPP_WIZARD_STEPS = [
  'Conectar Meta',
  'Business Manager',
  'WhatsApp Business Account (WABA)',
  'Número do WhatsApp',
  'Validação do Número',
  'Webhook e Credenciais',
  'Teste Final'
];

const WHATSAPP_INITIAL_STEP = 0;
const WHATSAPP_MANUAL_STEP = 5;
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '';
const META_EMBEDDED_SIGNUP_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || '';
const META_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || 'v21.0';

function WhatsAppWizardProgress({ currentStep = WHATSAPP_INITIAL_STEP }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">Assistente de Configuração</p>
          <p className="text-xs text-gray-500">
            Fluxo preparado para a integração oficial com a Meta.
          </p>
        </div>
        <span className="text-sm font-semibold text-gray-600">
          Etapa {currentStep + 1} de {WHATSAPP_WIZARD_STEPS.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {WHATSAPP_WIZARD_STEPS.map((step, index) => {
          const isCurrent = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <button
              key={step}
              type="button"
              disabled={!isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
              className={`text-left rounded-lg border p-3 transition ${
                isCurrent
                  ? 'border-teal-500 bg-teal-50 shadow-sm ring-2 ring-teal-100'
                  : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-teal-600 text-white'
                      : isCompleted
                        ? 'bg-gray-300 text-gray-700'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`text-xs font-semibold ${isCurrent ? 'text-teal-700' : 'text-gray-500'}`}>
                  {isCurrent ? 'Atual' : 'Bloqueada'}
                </span>
              </div>
              <p className={`text-sm font-semibold leading-snug ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                {step}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HEALTH_STATUS_STYLES = {
  OK: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    icon: 'text-green-600',
    card: 'border-green-200 bg-green-50'
  },
  Atenção: {
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: 'text-yellow-600',
    card: 'border-yellow-200 bg-yellow-50'
  },
  Erro: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: 'text-red-600',
    card: 'border-red-200 bg-red-50'
  }
};

const HEALTH_CARD_ICONS = {
  connection: faPlug,
  embedded_signup: faClipboardCheck,
  token: faKey,
  scopes: faShieldAlt,
  business_manager: faBuilding,
  waba: faBuilding,
  phone_number: faPhone,
  phone_quality: faChartLine,
  message_limit: faChartLine,
  onboarding: faClipboardCheck,
  webhook_configured: faPlug,
  webhook_verified: faShieldAlt,
  webhook_last_event: faInfoCircle,
  webhook_last_validation: faClipboardCheck,
  webhook_signature: faShieldAlt,
  last_sync: faSyncAlt
};

function HealthStatusBadge({ status }) {
  const styles = HEALTH_STATUS_STYLES[status] || HEALTH_STATUS_STYLES.Atenção;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${styles.badge}`}>
      {status}
    </span>
  );
}

function WhatsappHealthCard({ item }) {
  const styles = HEALTH_STATUS_STYLES[item.status] || HEALTH_STATUS_STYLES.Atenção;
  const icon = HEALTH_CARD_ICONS[item.id] || faInfoCircle;

  return (
    <div className={`rounded-lg border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={icon} className={styles.icon} />
          <h4 className="font-bold text-gray-800">{item.name}</h4>
        </div>
        <HealthStatusBadge status={item.status} />
      </div>
      <p className="text-sm text-gray-700 min-h-[42px]">{item.description}</p>
      <p className="text-xs text-gray-500 mt-3">
        Última verificação: {item.checkedAt ? new Date(item.checkedAt).toLocaleString('pt-BR') : 'Nunca'}
      </p>
    </div>
  );
}

export default function ConfiguracaoSistema() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('sistema');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [whatsappWizardStep, setWhatsappWizardStep] = useState(WHATSAPP_INITIAL_STEP);
  const [metaSignupLoading, setMetaSignupLoading] = useState(false);
  const [metaSignupData, setMetaSignupData] = useState(null);
  const [whatsappHealth, setWhatsappHealth] = useState(null);
  const [whatsappHealthLoading, setWhatsappHealthLoading] = useState(false);
  const [phoneRegistrationPin, setPhoneRegistrationPin] = useState('');
  const [phoneRegistrationLoading, setPhoneRegistrationLoading] = useState(false);
  const [whatsappSyncLoading, setWhatsappSyncLoading] = useState(false);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false);
  const metaSignupResultRef = useRef(null);
  const metaSignupCodeRef = useRef('');
  const metaSignupSavedRef = useRef(false);

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
    verifyToken: '',
    hasAccessToken: false,
    verifyTokenConfigured: false
  });

  const [whatsappStatus, setWhatsappStatus] = useState({
    isConfigured: false,
    isConnected: false,
    lastUpdate: null,
    onboarding: {
      embeddedSignupCompleted: false,
      tokenValidated: false,
      wabaValidated: false,
      phoneValidated: false,
      productionReady: false,
      phoneRegistrationPending: false,
      phoneRegistered: false,
      phoneRegistrationFailed: false,
      phoneRegisteredAt: null,
      phoneRegistrationMessage: '',
      webhookPending: false,
      webhookVerified: false,
      webhookReceivingEvents: false,
      webhookLastVerifiedAt: null,
      webhookLastEventAt: null,
      webhookLastSignatureStatus: '',
      webhookValidationMessage: ''
    }
  });

  const [openai, setOpenai] = useState({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    groqApiKey: '',
    groqModel: 'llama-3.1-8b-instant',
    enabled: false,
    hasKey: false,
    hasGroqKey: false
  });

  const [openaiStatus, setOpenaiStatus] = useState({
    lastTest: null,
    isConnected: false,
    message: ''
  });

  const providerLabel = openai.provider === 'groq' ? 'Groq' : 'OpenAI';
  const providerKeyValue = openai.provider === 'groq' ? openai.groqApiKey : openai.apiKey;
  const providerModelValue = openai.provider === 'groq' ? openai.groqModel : openai.model;
  const hasProviderKey = openai.provider === 'groq' ? openai.hasGroqKey : openai.hasKey;

  const carregarMetaSdk = useCallback(() => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('SDK da Meta disponivel apenas no navegador'));
      return;
    }

    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: META_GRAPH_VERSION
      });
      resolve(window.FB);
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.FB), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Nao foi possivel carregar o SDK da Meta')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.onerror = () => reject(new Error('Nao foi possivel carregar o SDK da Meta'));
    document.body.appendChild(script);
  }), []);

  const extrairDadosEmbeddedSignup = useCallback((data = {}) => ({
    businessId: data.business_id || data.businessId || data.business?.id || '',
    wabaId: data.waba_id || data.wabaId || data.whatsapp_business_account_id || '',
    phoneNumberId: data.phone_number_id || data.phoneNumberId || data.phone?.id || '',
    phoneNumber: data.phone_number || data.display_phone_number || data.phoneNumber || data.phone?.display_phone_number || '',
    displayName: data.display_name || data.displayName || data.phone?.display_name || '',
    verifiedName: data.verified_name || data.verifiedName || data.phone?.verified_name || ''
  }), []);

  const persistirEmbeddedSignup = useCallback(async (payload) => {
    const response = await fetch('/api/whatsapp-business/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Erro ao salvar dados do Embedded Signup');
    }

    const account = data.account || {};
    setMetaSignupData(account);
    setWhatsapp(prev => ({
      ...prev,
      phoneNumberId: account.phoneNumberId || payload.phoneNumberId || prev.phoneNumberId
    }));
    setWhatsappStatus(prev => ({
      ...prev,
      isConfigured: Boolean(account.isConfigured),
      isConnected: Boolean(account.isConnected),
      onboarding: account.onboarding || prev.onboarding,
      lastUpdate: new Date().toLocaleString('pt-BR')
    }));
    setWhatsappWizardStep(1);
    return account;
  }, []);

  const concluirMetaEmbeddedSignup = useCallback(async () => {
    const signupPayload = metaSignupResultRef.current;
    const code = metaSignupCodeRef.current;

    if (metaSignupSavedRef.current || !signupPayload || !code) return false;
    if (!signupPayload.wabaId || !signupPayload.phoneNumberId) {
      setMetaSignupLoading(false);
      setLoading(false);
      setErrorMessage('A Meta concluiu o fluxo, mas nao retornou WABA ID e Phone Number ID.');
      setErrorModal(true);
      return false;
    }

    try {
      metaSignupSavedRef.current = true;
      await persistirEmbeddedSignup({ ...signupPayload, code });
      setSuccessModal(true);
      setTimeout(() => setSuccessModal(false), 3000);
      return true;
    } catch (error) {
      metaSignupSavedRef.current = false;
      setErrorMessage(error.message);
      setErrorModal(true);
      return false;
    } finally {
      setMetaSignupLoading(false);
      setLoading(false);
    }
  }, [persistirEmbeddedSignup]);

  useEffect(() => {
    const handleMessage = async (event) => {
      const allowedOrigins = ['https://www.facebook.com', 'https://web.facebook.com'];
      if (!allowedOrigins.includes(event.origin)) return;

      let message = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch {
          return;
        }
      }

      if (message?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (message.event === 'FINISH') {
        const payload = extrairDadosEmbeddedSignup(message.data || {});
        metaSignupResultRef.current = payload;
        await concluirMetaEmbeddedSignup();
      }

      if (message.event === 'CANCEL' || message.event === 'ERROR') {
        setMetaSignupLoading(false);
        setLoading(false);
        setErrorMessage(message.data?.error_message || 'Fluxo de conexao com a Meta nao foi concluido');
        setErrorModal(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [concluirMetaEmbeddedSignup, extrairDadosEmbeddedSignup]);

  const iniciarMetaEmbeddedSignup = async () => {
    if (!META_APP_ID || !META_EMBEDDED_SIGNUP_CONFIG_ID) {
      setErrorMessage('Configure NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID para usar o Embedded Signup.');
      setErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      setMetaSignupLoading(true);
      metaSignupResultRef.current = null;
      metaSignupCodeRef.current = '';
      metaSignupSavedRef.current = false;
      const FB = await carregarMetaSdk();

      FB.login((response) => {
        if (response?.status === 'not_authorized' || response?.status === 'unknown') {
          setMetaSignupLoading(false);
          setLoading(false);
          setErrorMessage('Login com a Meta nao foi autorizado.');
          setErrorModal(true);
          return;
        }

        if (response?.authResponse?.code) {
          metaSignupCodeRef.current = response.authResponse.code;
          concluirMetaEmbeddedSignup();
        }
      }, {
        config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: 3,
          setup: {}
        }
      });
    } catch (error) {
      setMetaSignupLoading(false);
      setLoading(false);
      setErrorMessage(error.message);
      setErrorModal(true);
    }
  };

  const verificarStatusWhatsApp = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp-business/config');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erro ao verificar WhatsApp Business');
      }
      setWhatsapp(prev => ({
        ...prev,
        phoneNumberId: data.phoneNumberId || '',
        accessToken: '',
        verifyToken: '',
        hasAccessToken: data.hasAccessToken || false,
        verifyTokenConfigured: data.verifyTokenConfigured || false
      }));
      setWhatsappStatus({
        isConfigured: data.isConfigured || false,
        isConnected: data.isConnected || false,
        lastUpdate: data.lastUpdate ? new Date(data.lastUpdate).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
        onboarding: data.onboarding || {
          embeddedSignupCompleted: false,
          tokenValidated: false,
          wabaValidated: false,
          phoneValidated: false,
          productionReady: false,
          phoneRegistrationPending: false,
          phoneRegistered: false,
          phoneRegistrationFailed: false,
          phoneRegisteredAt: null,
          phoneRegistrationMessage: '',
          webhookPending: false,
          webhookVerified: false,
          webhookReceivingEvents: false,
          webhookLastVerifiedAt: null,
          webhookLastEventAt: null,
          webhookLastSignatureStatus: '',
          webhookValidationMessage: ''
        }
      });
      if (data.phoneNumberId || data.wabaId || data.businessManagerId) {
        setMetaSignupData(data);
        setWhatsappWizardStep(data.hasAccessToken ? WHATSAPP_MANUAL_STEP : 1);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  }, []);

  const carregarHistoricoSincronizacao = useCallback(async () => {
    try {
      setSyncHistoryLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('whatsapp_business_sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico de sincronizações:', error);
    } finally {
      setSyncHistoryLoading(false);
    }
  }, []);

  const executarSincronizacao = async () => {
    try {
      setWhatsappSyncLoading(true);
      const response = await fetch('/api/whatsapp-business/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Erro ao sincronizar');
      }

      setSuccessModal(true);
      setTimeout(() => setSuccessModal(false), 3000);

      // Auto-refresh the health indicators
      await executarDiagnosticoWhatsapp();

      // Auto-refresh the sync history
      await carregarHistoricoSincronizacao();
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setWhatsappSyncLoading(false);
    }
  };

  const carregarConfiguracoes = useCallback(async () => {
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

        if (result.data.openai) {
          setOpenai(prev => ({
            ...prev,
            provider: result.data.openai.provider || 'openai',
            model: result.data.openai.model || 'gpt-4o-mini',
            groqModel: result.data.openai.groqModel || 'llama-3.1-8b-instant',
            enabled: result.data.openai.enabled ?? false,
            hasKey: result.data.openai.hasKey ?? false,
            hasGroqKey: result.data.openai.hasGroqKey ?? false
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
    
    // Verificar status WhatsApp com tratamento de erro
    try {
      verificarStatusWhatsApp();
      carregarHistoricoSincronizacao();
    } catch (error) {
      console.error('Erro ao verificar status WhatsApp:', error);
    }
  }, [verificarStatusWhatsApp, carregarHistoricoSincronizacao]);

  // Carregar dados da API
  useEffect(() => {
    try {
      carregarConfiguracoes();

      // Verificar hash para definir aba ativa
      if (window.location.hash === '#whatsapp') {
        setActiveTab('whatsapp');
      } else if (window.location.hash === '#ia') {
        setActiveTab('ia');
      } else if (window.location.hash === '#dados') {
        setActiveTab('sistema');
      }
    } catch (error) {
      console.error('Erro ao carregar página de configurações:', error);
    }
  }, [carregarConfiguracoes]);

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

  const handleOpenAIChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOpenai(prev => {
      if (name === 'provider') {
        return { ...prev, provider: value };
      }
      if (name === 'apiKey') {
        if (prev.provider === 'groq') {
          return { ...prev, groqApiKey: value };
        }
        return { ...prev, apiKey: value };
      }
      if (name === 'model') {
        if (prev.provider === 'groq') {
          return { ...prev, groqModel: value };
        }
        return { ...prev, model: value };
      }
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
    });
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
    if (!whatsapp.phoneNumberId || (!whatsapp.accessToken && !whatsapp.hasAccessToken)) {
      setErrorMessage('Preenchimento obrigatório: Phone Number ID e Access Token');
      setErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/whatsapp-business/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whatsapp)
      });

      const data = await response.json();
      if (data.success) {
        setWhatsapp(prev => ({
          ...prev,
          accessToken: '',
          verifyToken: '',
          hasAccessToken: true,
          verifyTokenConfigured: prev.verifyTokenConfigured || Boolean(prev.verifyToken)
        }));
        setWhatsappStatus({
          isConfigured: true,
          isConnected: true,
          onboarding: {
            embeddedSignupCompleted: false,
            tokenValidated: false,
            wabaValidated: false,
            phoneValidated: true,
            productionReady: true,
            phoneRegistrationPending: false,
            phoneRegistered: false,
            phoneRegistrationFailed: false,
            phoneRegisteredAt: null,
            phoneRegistrationMessage: '',
            webhookPending: Boolean(whatsapp.verifyToken),
            webhookVerified: false,
            webhookReceivingEvents: false,
            webhookLastVerifiedAt: null,
            webhookLastEventAt: null,
            webhookLastSignatureStatus: '',
            webhookValidationMessage: ''
          },
          lastUpdate: new Date().toLocaleString('pt-BR')
        });
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 3000);
      } else {
        throw new Error(data.message || data.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const salvarOpenAI = async () => {
    if (openai.enabled && !providerKeyValue && !hasProviderKey) {
      setErrorMessage(`Informe a API Key da ${providerLabel} para ativar a IA`);
      setErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'openai',
          dados: {
            provider: openai.provider,
            apiKey: openai.apiKey || undefined,
            model: openai.model,
            groqApiKey: openai.groqApiKey || undefined,
            groqModel: openai.groqModel,
            enabled: openai.enabled
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setOpenai(prev => {
          const next = { ...prev };
          if (prev.provider === 'groq') {
            next.hasGroqKey = prev.hasGroqKey || Boolean(prev.groqApiKey);
            next.groqApiKey = '';
          } else {
            next.hasKey = prev.hasKey || Boolean(prev.apiKey);
            next.apiKey = '';
          }
          return next;
        });
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 3000);
      } else {
        throw new Error(data.message || 'Erro ao salvar configuracao da IA');
      }
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const testarOpenAI = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: openai.provider,
          apiKey: providerKeyValue || undefined,
          model: providerModelValue
        })
      });

      const data = await response.json();
      if (data.success) {
        setOpenaiStatus({
          lastTest: new Date().toLocaleString('pt-BR'),
          isConnected: true,
          message: 'Conexao validada com sucesso'
        });
        setSuccessModal(true);
        setTimeout(() => setSuccessModal(false), 2000);
      } else {
        setOpenaiStatus({
          lastTest: new Date().toLocaleString('pt-BR'),
          isConnected: false,
          message: data.message || 'Falha ao validar a IA'
        });
        setErrorMessage(data.message || 'Falha ao validar a IA');
        setErrorModal(true);
      }
    } catch (error) {
      setOpenaiStatus({
        lastTest: new Date().toLocaleString('pt-BR'),
        isConnected: false,
        message: error.message
      });
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

  const executarDiagnosticoWhatsapp = async () => {
    try {
      setWhatsappHealthLoading(true);
      const response = await fetch('/api/whatsapp-business/health');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erro ao executar diagnóstico');
      }

      setWhatsappHealth(data);
      setWhatsappWizardStep(6);
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setWhatsappHealthLoading(false);
    }
  };

  const registrarNumeroWhatsapp = async () => {
    if (!/^\d{6}$/.test(phoneRegistrationPin)) {
      setErrorMessage('Informe um PIN de 6 digitos para registrar o numero');
      setErrorModal(true);
      return;
    }

    try {
      setPhoneRegistrationLoading(true);
      const response = await fetch('/api/whatsapp-business/register-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: phoneRegistrationPin })
      });
      const data = await response.json();

      if (data.account?.onboarding) {
        setWhatsappStatus(prev => ({
          ...prev,
          isConfigured: Boolean(data.account.isConfigured),
          isConnected: Boolean(data.account.isConnected),
          onboarding: data.account.onboarding,
          lastUpdate: new Date().toLocaleString('pt-BR')
        }));
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Erro ao registrar numero');
      }

      setPhoneRegistrationPin('');
      setSuccessModal(true);
      setTimeout(() => setSuccessModal(false), 3000);
    } catch (error) {
      setErrorMessage(error.message);
      setErrorModal(true);
    } finally {
      setPhoneRegistrationLoading(false);
    }
  };

  const whatsappOnboardingSteps = [
    ['Embedded Signup concluido', whatsappStatus.onboarding.embeddedSignupCompleted],
    ['Token validado', whatsappStatus.onboarding.tokenValidated],
    ['WABA validada', whatsappStatus.onboarding.wabaValidated],
    ['Numero validado', whatsappStatus.onboarding.phoneValidated],
    ['Numero registrado', whatsappStatus.onboarding.phoneRegistered],
    ['Webhook validado', whatsappStatus.onboarding.webhookVerified],
    ['Recebendo eventos', whatsappStatus.onboarding.webhookReceivingEvents],
    ['Pronto para producao', whatsappStatus.onboarding.productionReady]
  ];

  const phoneRegistrationStatus = whatsappStatus.onboarding.phoneRegistered
    ? 'Registrado'
    : whatsappStatus.onboarding.phoneRegistrationFailed
      ? 'Erro'
      : whatsappStatus.onboarding.phoneRegistrationPending
        ? 'Pendente'
        : 'Pendente';

  return (
    <ProtectedRoute requiredRole={ROLES.ADMINISTRADOR}>
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
              <button
                onClick={() => setActiveTab('ia')}
                className={`py-4 px-2 border-b-2 font-semibold transition ${
                  activeTab === 'ia'
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Inteligencia Artificial
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
                      <Image
                        src={logoPreview || sistema.logo}
                        alt="Logo"
                        width={160}
                        height={160}
                        className="h-40 mx-auto object-contain"
                        unoptimized
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

              <WhatsAppWizardProgress currentStep={whatsappWizardStep} />

              <div className="border border-blue-100 rounded-xl overflow-hidden mb-6">
                <div className="bg-blue-50 border-b border-blue-100 p-5">
                  <p className="text-sm font-semibold text-blue-700">Etapa 1</p>
                  <h3 className="text-xl font-bold text-gray-900">Conectar Meta</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Use o Embedded Signup oficial para selecionar ou criar Business Manager, WABA e numero do WhatsApp.
                  </p>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <p className="font-semibold text-gray-800 mb-2">Configuracao assistida pela Meta</p>
                      <p className="text-sm text-gray-600 mb-4">
                        Esta opcao abre o popup oficial da Meta, troca o codigo de autorizacao no backend e grava os IDs e o System User Access Token no tenant atual. Webhook e envio continuam para as proximas etapas.
                      </p>
                      <button
                        type="button"
                        onClick={iniciarMetaEmbeddedSignup}
                        disabled={loading || metaSignupLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <FontAwesomeIcon icon={faPlug} />
                        {metaSignupLoading ? 'Conectando...' : 'Conectar com a Meta'}
                      </button>
                      {(!META_APP_ID || !META_EMBEDDED_SIGNUP_CONFIG_ID) && (
                        <p className="text-xs text-amber-700 mt-3">
                          Configure NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID para habilitar o popup oficial.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 p-5">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Dados capturados</p>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Business ID:</strong> {metaSignupData?.businessManagerId || '-'}</p>
                        <p><strong>WABA ID:</strong> {metaSignupData?.wabaId || '-'}</p>
                        <p><strong>Phone Number ID:</strong> {metaSignupData?.phoneNumberId || '-'}</p>
                        <p><strong>Telefone:</strong> {metaSignupData?.displayPhoneNumber || '-'}</p>
                        <p><strong>Display Name:</strong> {metaSignupData?.displayName || '-'}</p>
                        <p><strong>Verified Name:</strong> {metaSignupData?.verifiedName || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-cyan-100 rounded-xl overflow-hidden mb-6">
                <div className="bg-cyan-50 border-b border-cyan-100 p-5">
                  <p className="text-sm font-semibold text-cyan-700">Etapa 5</p>
                  <h3 className="text-xl font-bold text-gray-900">Validação do Número</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Registre oficialmente o número na WhatsApp Cloud API usando o endpoint oficial da Meta.
                  </p>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PIN de verificação em duas etapas *
                      </label>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={phoneRegistrationPin}
                          onChange={(event) => setPhoneRegistrationPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6 dígitos"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={registrarNumeroWhatsapp}
                          disabled={phoneRegistrationLoading || !whatsappStatus.onboarding.productionReady}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <FontAwesomeIcon icon={faPhone} />
                          {phoneRegistrationLoading ? 'Registrando...' : 'Registrar Número'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        A Meta exige um PIN de 6 dígitos para registrar o número e ativar a verificação em duas etapas.
                      </p>
                      {!whatsappStatus.onboarding.productionReady && (
                        <p className="text-xs text-amber-700 mt-2">
                          Conclua a validação da integração antes de registrar o número.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 p-5">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Registro do número</p>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Status:</strong> {phoneRegistrationStatus}</p>
                        <p>
                          <strong>Data do registro:</strong>{' '}
                          {whatsappStatus.onboarding.phoneRegisteredAt
                            ? new Date(whatsappStatus.onboarding.phoneRegisteredAt).toLocaleString('pt-BR')
                            : '-'}
                        </p>
                        <p><strong>Mensagem:</strong> {whatsappStatus.onboarding.phoneRegistrationMessage || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-teal-100 rounded-xl overflow-hidden">
                <div className="bg-teal-50 border-b border-teal-100 p-5">
                  <p className="text-sm font-semibold text-teal-700">Etapa Atual</p>
                  <h3 className="text-xl font-bold text-gray-900">Webhook e Credenciais</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Informe as credenciais oficiais da Meta e acompanhe o status da conexão antes do teste final.
                  </p>
                </div>

                <div className="p-5">
              {/* Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Pronto para Produção</p>
                  <div className="flex items-center gap-2 mt-2">
                    <FontAwesomeIcon
                      icon={whatsappStatus.isConfigured ? faCheck : faTimes}
                      className={whatsappStatus.isConfigured ? 'text-green-600' : 'text-red-600'}
                      size="lg"
                    />
                    <span className={`font-bold ${whatsappStatus.isConfigured ? 'text-green-600' : 'text-red-600'}`}>
                      {whatsappStatus.isConfigured ? 'Pronto' : 'Pendente'}
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

              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8">
                <p className="text-sm font-semibold text-gray-700 mb-3">Onboarding Meta</p>
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {whatsappOnboardingSteps.map(([label, done]) => (
                    <div
                      key={label}
                      className={`rounded-lg border p-3 ${done ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                          icon={done ? faCheck : faTimes}
                          className={done ? 'text-green-600' : 'text-gray-400'}
                        />
                        <span className={`text-sm font-semibold ${done ? 'text-green-700' : 'text-gray-500'}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                  ))}
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
                    Encontre em: App ? WhatsApp ? API Setup
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Verify Token do Webhook
                  </label>
                  <input
                    type="text"
                    name="verifyToken"
                    value={whatsapp.verifyToken}
                    onChange={handleWhatsappChange}
                    placeholder={whatsapp.verifyTokenConfigured ? 'Token já configurado' : 'Defina um token de verificação'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Callback URL oficial: /api/whatsapp-business/meta-webhook
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
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">
                <div className="bg-gray-50 border-b border-gray-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Etapa 7</p>
                    <h3 className="text-xl font-bold text-gray-900">Teste Final</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Painel de saúde e diagnóstico da integração WhatsApp Business.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={executarDiagnosticoWhatsapp}
                    disabled={whatsappHealthLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FontAwesomeIcon icon={faSyncAlt} className={whatsappHealthLoading ? 'animate-spin' : ''} />
                    {whatsappHealthLoading ? 'Executando...' : 'Executar Diagnóstico'}
                  </button>
                </div>

                <div className="p-5">
                  {/* Grid de Resumo de Sincronização e Diagnóstico Geral */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                    {/* Card 1: Última Sincronização */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faSyncAlt} className="text-teal-600 text-lg" />
                          <h4 className="font-bold text-gray-800">Sincronização com a Meta</h4>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={executarSincronizacao}
                            disabled={whatsappSyncLoading}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
                          >
                            <FontAwesomeIcon icon={faSyncAlt} className={whatsappSyncLoading ? 'animate-spin' : ''} />
                            {whatsappSyncLoading ? 'Sincronizando...' : 'Sincronizar Agora'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsSyncHistoryModalOpen(true)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition flex items-center gap-2"
                          >
                            Histórico
                          </button>
                        </div>
                      </div>

                      {syncHistory.length > 0 ? (
                        (() => {
                          const latest = syncHistory[0];
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-800">Status: </span>
                                  {latest.success ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                                      Sucesso
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                                      Falha
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-800">Última Sincronização: </span>
                                  {latest.started_at ? new Date(latest.started_at).toLocaleString('pt-BR') : '-'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-800">Duração: </span>
                                  {latest.duration_ms ? (latest.duration_ms >= 1000 ? (latest.duration_ms / 1000).toFixed(2) + 's' : latest.duration_ms + 'ms') : '0ms'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <span className="font-semibold text-gray-800">Alterações: </span>
                                  {latest.updated_items} {latest.updated_items === 1 ? 'campo alterado' : 'campos alterados'}
                                </p>
                              </div>

                              <div className="space-y-2 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                                <span className="text-xs font-bold uppercase text-gray-400 block tracking-wider">Diferenças Detectadas</span>
                                {latest.diff && latest.diff.length > 0 ? (
                                  <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-xs bg-gray-50 p-2.5 rounded border border-gray-100">
                                    {latest.diff.map((d, idx) => (
                                      <div key={idx} className="text-gray-700 truncate" title={`${d.field}: ${String(d.before)} -> ${String(d.after)}`}>
                                        <span className="text-teal-700 font-semibold">{d.field}</span>: <span className="text-red-500 line-through">{String(d.before ?? 'null')}</span> → <span className="text-green-600 font-bold">{String(d.after ?? 'null')}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded border border-gray-100">
                                    Nenhuma diferença encontrada. Dados idênticos aos da Meta.
                                  </p>
                                )}

                                {latest.error_message && (
                                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded">
                                    <span className="font-bold">Erro:</span> {latest.error_message}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-6 text-gray-500 text-sm">
                          Nenhuma sincronização realizada ainda. Clique em "Sincronizar Agora" para iniciar.
                        </div>
                      )}
                    </div>

                    {/* Card 2: Resumo do Diagnóstico */}
                    <div className={`rounded-xl border p-5 flex flex-col justify-between shadow-sm ${
                      whatsappHealth?.ready
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-yellow-200 bg-yellow-50/50'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FontAwesomeIcon
                            icon={whatsappHealth?.ready ? faCheck : faExclamationTriangle}
                            className={whatsappHealth?.ready ? 'text-green-600' : 'text-yellow-600'}
                          />
                          <h4 className={`font-bold ${whatsappHealth?.ready ? 'text-green-800' : 'text-yellow-800'}`}>
                            Painel de Saúde
                          </h4>
                        </div>
                        <p className="text-sm text-gray-700">
                          {whatsappHealth
                            ? (whatsappHealth.ready ? 'Integração pronta para uso em produção.' : 'Existem pendências antes de iniciar o uso.')
                            : 'Diagnóstico não executado.'}
                        </p>
                        {whatsappHealth?.pending?.length > 0 && (
                          <div className="mt-3 max-h-24 overflow-y-auto text-xs text-yellow-800 space-y-1 bg-yellow-100/50 p-2 rounded">
                            {whatsappHealth.pending.map((item) => (
                              <div key={item}>• {item}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-4">
                        Última verificação: {whatsappHealth?.checkedAt ? new Date(whatsappHealth.checkedAt).toLocaleString('pt-BR') : 'Nunca'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(whatsappHealth?.indicators || []).map((item) => (
                      <WhatsappHealthCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: IA */}
          {activeTab === 'ia' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <FontAwesomeIcon icon={faRobot} className="text-teal-600" />
                Configuracao da IA
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-l-4 border-teal-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Status da IA</p>
                  <div className="flex items-center gap-2 mt-2">
                    <FontAwesomeIcon
                      icon={openai.enabled ? faCheck : faTimes}
                      className={openai.enabled ? 'text-green-600' : 'text-red-600'}
                      size="lg"
                    />
                    <span className={`font-bold ${openai.enabled ? 'text-green-600' : 'text-red-600'}`}>
                      {openai.enabled ? 'Ativada' : 'Desativada'}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm text-gray-600">API Key ({providerLabel})</p>
                  <div className="flex items-center gap-2 mt-2">
                    <FontAwesomeIcon
                      icon={hasProviderKey ? faCheck : faTimes}
                      className={hasProviderKey ? 'text-blue-600' : 'text-yellow-600'}
                      size="lg"
                    />
                    <span className={`font-bold ${hasProviderKey ? 'text-blue-600' : 'text-yellow-600'}`}>
                      {hasProviderKey ? 'Configurada' : 'Nao configurada'}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-l-4 border-gray-500 p-4 rounded">
                  <p className="text-sm text-gray-600">Ultimo Teste</p>
                  <p className="font-bold text-gray-700 mt-2">
                    {openaiStatus.lastTest || 'Nunca'}
                  </p>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-gray-900">Ativar IA</h3>
                    <p className="text-sm text-gray-600">Habilita a Thai, assessora pessoal do parlamentar</p>
                  </div>
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={openai.enabled}
                    onChange={handleOpenAIChange}
                    className="w-5 h-5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faPlug} className="mr-2 text-teal-600" />
                    Provedor
                  </label>
                  <select
                    name="provider"
                    value={openai.provider}
                    onChange={handleOpenAIChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faKey} className="mr-2 text-teal-600" />
                    API Key da {providerLabel}
                  </label>
                  <input
                    type="password"
                    name="apiKey"
                    value={providerKeyValue}
                    onChange={handleOpenAIChange}
                    placeholder={hasProviderKey ? '******** (chave configurada)' : (openai.provider === 'groq' ? 'gsk_...' : 'sk-...')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A chave fica salva no servidor e nunca aparece para usuarios.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faPlug} className="mr-2 text-teal-600" />
                    Modelo
                  </label>
                  <select
                    name="model"
                    value={providerModelValue}
                    onChange={handleOpenAIChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {openai.provider === 'groq' ? (
                      <>
                        <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (rapido)</option>
                        <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
                        <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                      </>
                    ) : (
                      <>
                        <option value="gpt-4o-mini">gpt-4o-mini (recomendado)</option>
                        <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 flex-col md:flex-row">
                <button
                  onClick={salvarOpenAI}
                  disabled={loading}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faSave} />
                  {loading ? 'Salvando...' : 'Salvar Configuracao'}
                </button>

                <button
                  onClick={testarOpenAI}
                  disabled={loading || (!providerKeyValue && !hasProviderKey)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faCheck} />
                  Testar Conexao
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

      {/* Modal Histórico de Sincronizações */}
      {isSyncHistoryModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setIsSyncHistoryModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col transform transition-all animate-modal-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0A4C53] to-[#032E35] rounded-t-2xl p-6 text-white relative overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
              </div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg">
                    🔄
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Histórico de Sincronizações</h2>
                    <p className="text-xs text-teal-100">WhatsApp Business Integration</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSyncHistoryModalOpen(false)}
                  className="text-white hover:text-teal-200 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full h-8 w-8 flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {syncHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FontAwesomeIcon icon={faSyncAlt} className="text-teal-600 text-3xl animate-spin mb-4" />
                  <p className="text-gray-500 text-sm">Carregando histórico...</p>
                </div>
              ) : syncHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nenhuma sincronização encontrada.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                        <th className="p-4">Data/Hora</th>
                        <th className="p-4">Duração</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Campos Alterados</th>
                        <th className="p-4">Retorno da Meta / Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-600">
                      {syncHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-medium text-gray-900 whitespace-nowrap">
                            {item.started_at ? new Date(item.started_at).toLocaleString('pt-BR') : '-'}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            {item.duration_ms ? (item.duration_ms >= 1000 ? (item.duration_ms / 1000).toFixed(2) + 's' : item.duration_ms + 'ms') : '0ms'}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            {item.success ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                                Sucesso
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                                Falha
                              </span>
                            )}
                          </td>
                          <td className="p-4 max-w-xs">
                            {item.diff && item.diff.length > 0 ? (
                              <div className="space-y-1 text-xs font-mono bg-gray-50 p-2 rounded max-h-24 overflow-y-auto border border-gray-100">
                                {item.diff.map((d, idx) => (
                                  <div key={idx} className="truncate" title={`${d.field}: ${String(d.before)} -> ${String(d.after)}`}>
                                    <span className="text-teal-700 font-semibold">{d.field}</span>: <span className="text-red-500 line-through">{String(d.before ?? 'null')}</span> → <span className="text-green-600 font-bold">{String(d.after ?? 'null')}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Nenhum</span>
                            )}
                          </td>
                          <td className="p-4 max-w-sm">
                            {item.error_message && (
                              <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded mb-1">
                                <span className="font-semibold">Erro: </span>{item.error_message}
                              </div>
                            )}
                            {item.meta_messages && item.meta_messages.length > 0 ? (
                              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 p-2 rounded max-h-20 overflow-y-auto">
                                {item.meta_messages.map((msg, idx) => (
                                  <div key={idx}>• {msg}</div>
                                ))}
                              </div>
                            ) : (
                              !item.error_message && <span className="text-xs text-gray-400 italic">Nenhuma mensagem</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsSyncHistoryModalOpen(false)}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={errorModal}
        title="Erro"
        message={errorMessage}
        type="error"
        onClose={() => setErrorModal(false)}
      />
    </Layout>

    </ProtectedRoute>
  );
}


