import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlug,
  faShieldAlt,
  faCheck,
  faCheckCircle,
  faTriangleExclamation,
  faServer,
  faSpinner,
  faMobileAlt,
  faSyncAlt,
  faKey,
  faCopy,
  faTimes,
  faCog,
  faQrcode,
  faArrowRight,
  faPowerOff
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { MODULES } from '@/utils/permissions';

export default function WhatsAppBusinessOficial() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [iniciandoWablast, setIniciandoWablast] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState(null);

  // Estados específicos para modal e configuração manual WAFLY
  const [modalWaflyAberto, setModalWaflyAberto] = useState(false);
  const [salvandoWafly, setSalvandoWafly] = useState(false);
  const [waflyForm, setWaflyForm] = useState({
    clientToken: '',
    instance: '',
    token: '',
    connectedPhone: '',
    phoneNumber: '',
    webhookSecret: ''
  });
  const [erroWaflyModal, setErroWaflyModal] = useState(null);
  const [webhookCopiado, setWebhookCopiado] = useState(false);

  // Estados específicos para Modal de Conexão WhatsApp via QR Code WAFLY
  const [modalQrAberto, setModalQrAberto] = useState(false);
  const [carregandoQr, setCarregandoQr] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [erroQrModal, setErroQrModal] = useState(null);
  const [conectadoSucesso, setConectadoSucesso] = useState(false);
  const [telefoneConectado, setTelefoneConectado] = useState(null);

  // Estados específicos para VIBEWHATS
  const [modalVibeAberto, setModalVibeAberto] = useState(false);
  const [salvandoVibe, setSalvandoVibe] = useState(false);
  const [vibeForm, setVibeForm] = useState({
    instance: '',
    token: '',
    clientToken: '',
    connectedPhone: '',
    webhookSecret: ''
  });
  const [erroVibeModal, setErroVibeModal] = useState(null);
  const [modalQrVibeAberto, setModalQrVibeAberto] = useState(false);
  const [carregandoQrVibe, setCarregandoQrVibe] = useState(false);
  const [qrCodeVibeData, setQrCodeVibeData] = useState(null);
  const [erroQrVibeModal, setErroQrVibeModal] = useState(null);
  const [conectadoSucessoVibe, setConectadoSucessoVibe] = useState(false);
  const [telefoneConectadoVibe, setTelefoneConectadoVibe] = useState(null);

  // Estados para teste de envio VibeWhats
  const [modalTesteVibeAberto, setModalTesteVibeAberto] = useState(false);
  const [testandoVibe, setTestandoVibe] = useState(false);
  const [testeTelefoneVibe, setTesteTelefoneVibe] = useState('');
  const [testeMensagemVibe, setTesteMensagemVibe] = useState('Olá! Este é um teste oficial de conexão da VibeWhats no MandatoPRO.');
  const [resultadoTesteVibe, setResultadoTesteVibe] = useState(null);

  // Estados para Desconexão VibeWhats
  const [modalDesconectarVibeAberto, setModalDesconectarVibeAberto] = useState(false);
  const [desconectandoVibe, setDesconectandoVibe] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query?.onboarding === 'wablast_complete') {
      executarSincronizacaoWaBlast();
    } else {
      carregarConfiguracao();
    }
  }, [router.isReady, router.query]);

  // Polling automático para detectar conexão quando o modal de QR Code estiver aberto
  useEffect(() => {
    let intervalId = null;

    if (modalQrAberto && !conectadoSucesso) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp-business/wafly-status');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.connected) {
              setConectadoSucesso(true);
              setTelefoneConectado(data.phone || config?.waflyDetails?.phoneNumber || null);
              await carregarConfiguracao();
            }
          }
        } catch (pollErr) {
          console.warn('[WAFLY POLLING] Erro ao consultar status:', pollErr);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [modalQrAberto, conectadoSucesso, config?.waflyDetails?.phoneNumber]);

  // Polling automático para detectar conexão quando o modal de QR Code VIBEWHATS estiver aberto
  useEffect(() => {
    let intervalId = null;

    if (modalQrVibeAberto && !conectadoSucessoVibe) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp-business/vibewhats-status');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.connected) {
              setConectadoSucessoVibe(true);
              setTelefoneConectadoVibe(data.phone || config?.vibewhatsDetails?.phoneNumber || null);
              await carregarConfiguracao();
            }
          }
        } catch (pollErr) {
          console.warn('[VIBEWHATS POLLING] Erro ao consultar status:', pollErr);
        }
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [modalQrVibeAberto, conectadoSucessoVibe, config?.vibewhatsDetails?.phoneNumber]);

  const executarSincronizacaoWaBlast = async () => {
    try {
      setLoading(true);
      setMensagemStatus({
        tipo: 'info',
        texto: 'Verificando e sincronizando a conexão WhatsApp WaBlast...'
      });

      const res = await fetch('/api/whatsapp-business/wablast-sync');
      const data = await res.json();

      if (data?.status === 'COMPLETED') {
        setMensagemStatus({
          tipo: 'sucesso',
          texto: data.message || 'WhatsApp WABLAST conectado com sucesso.'
        });
      } else if (data?.status === 'PENDING') {
        setMensagemStatus({
          tipo: 'info',
          texto: data.message || 'O WhatsApp foi conectado, mas a confirmação da WaBlast ainda está sendo processada. Tente novamente em alguns instantes.'
        });
      } else if (data?.status === 'NO_SESSION') {
        setMensagemStatus(null);
      } else if (data?.status === 'NO_PHONE') {
        setMensagemStatus({
          tipo: 'erro',
          texto: data.message || 'Conta WaBlast localizada, mas nenhum número de WhatsApp ativo foi retornado.'
        });
      } else {
        setMensagemStatus({
          tipo: 'erro',
          texto: data.error || data.message || 'Não foi possível sincronizar a conexão WABLAST.'
        });
      }
    } catch (syncErr) {
      console.error('Erro ao sincronizar retorno WaBlast:', syncErr);
      setMensagemStatus({
        tipo: 'erro',
        texto: syncErr.message || 'Não foi possível sincronizar a conexão WABLAST.'
      });
    } finally {
      await carregarConfiguracao();
    }
  };

  const carregarConfiguracao = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp-business/config');
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
      }
    } catch (err) {
      console.error('Erro ao carregar configuracao do provedor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrocarProvedor = async (novoProvedor) => {
    if (changing || config?.provider === novoProvedor) return;

    try {
      setChanging(true);
      setMensagemStatus(null);

      const res = await fetch('/api/whatsapp-business/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: novoProvedor })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao alterar provedor');
      }

      setMensagemStatus({
        tipo: 'sucesso',
        texto: `Provedor ativo alterado para ${novoProvedor} com sucesso!`
      });

      await carregarConfiguracao();
    } catch (err) {
      setMensagemStatus({
        tipo: 'erro',
        texto: err.message || 'Falha ao alterar provedor'
      });
    } finally {
      setChanging(false);
    }
  };

  // --- Handlers de QR Code WAFLY ---
  const carregarQrCode = async () => {
    try {
      setCarregandoQr(true);
      setErroQrModal(null);
      const res = await fetch('/api/whatsapp-business/wafly-qr');
      const data = await res.json();
      if (res.ok && data.success && data.qrCode) {
        setQrCodeData(data.qrCode);
      } else {
        throw new Error(data.error || 'Não foi possível obter o QR Code da WAFLY.');
      }
    } catch (err) {
      console.error('Erro ao carregar QR Code WAFLY:', err);
      setErroQrModal(err.message || 'Falha ao gerar QR Code.');
    } finally {
      setCarregandoQr(false);
    }
  };

  const handleAbrirModalQr = () => {
    setModalQrAberto(true);
    setConectadoSucesso(false);
    setTelefoneConectado(null);
    setErroQrModal(null);
    setQrCodeData(null);
    carregarQrCode();
  };

  const handleFecharModalQr = () => {
    setModalQrAberto(false);
    setQrCodeData(null);
    setErroQrModal(null);
    if (conectadoSucesso) {
      carregarConfiguracao();
    }
  };

  // --- Handlers de Modal Manual WAFLY ---
  const handleAbrirModalWafly = () => {
    setWaflyForm({
      clientToken: '',
      instance: config?.waflyDetails?.instance || '',
      token: '',
      connectedPhone: config?.waflyDetails?.phoneNumber || '',
      phoneNumber: config?.waflyDetails?.phoneNumber || '',
      webhookSecret: ''
    });
    setErroWaflyModal(null);
    setWebhookCopiado(false);
    setModalWaflyAberto(true);
  };

  const handleFecharModalWafly = () => {
    if (salvandoWafly) return;
    setModalWaflyAberto(false);
    setErroWaflyModal(null);
    setWebhookCopiado(false);
  };

  const handleSalvarWafly = async (e) => {
    e.preventDefault();
    setErroWaflyModal(null);

    const clientToken = String(waflyForm.clientToken || '').trim();
    const instance = String(waflyForm.instance || '').trim();
    const token = String(waflyForm.token || '').trim();
    const cleanPhone = String(
      waflyForm.connectedPhone || waflyForm.phoneNumber || ''
    ).replace(/\D+/g, '');
    const webhookSecret = String(waflyForm.webhookSecret || '').trim();

    if (!clientToken) {
      setErroWaflyModal('Client Token da WAFLY é obrigatório.');
      return;
    }
    if (!instance) {
      setErroWaflyModal('ID da Instância da WAFLY é obrigatório.');
      return;
    }
    if (!token) {
      setErroWaflyModal('Token da Instância da WAFLY é obrigatório.');
      return;
    }
    if (!cleanPhone) {
      setErroWaflyModal('Número do WhatsApp do Gabinete é obrigatório.');
      return;
    }

    try {
      setSalvandoWafly(true);

      const payload = {
        provider: 'WAFLY',
        clientToken,
        instance,
        token,
        connectedPhone: cleanPhone
      };

      if (webhookSecret) {
        payload.webhookSecret = webhookSecret;
      }

      const res = await fetch('/api/whatsapp-business/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar credenciais da WAFLY.');
      }

      setModalWaflyAberto(false);
      setMensagemStatus({
        tipo: 'sucesso',
        texto: 'Configuração da WAFLY salva com sucesso! Você pode conectar o WhatsApp via QR Code agora.'
      });

      await carregarConfiguracao();
    } catch (err) {
      setErroWaflyModal(err.message || 'Erro ao salvar configuração WAFLY.');
    } finally {
      setSalvandoWafly(false);
    }
  };

  const getWaflyWebhookUrl = () => {
    if (typeof window === 'undefined') return '/api/whatsapp-business/wafly-webhook';
    const origin = window.location.origin;
    const cleanSecret = String(waflyForm.webhookSecret || '').trim();
    if (cleanSecret) {
      return `${origin}/api/whatsapp-business/wafly-webhook?token=${encodeURIComponent(cleanSecret)}`;
    }
    return `${origin}/api/whatsapp-business/wafly-webhook`;
  };

  const handleCopiarWebhook = async () => {
    try {
      const url = getWaflyWebhookUrl();
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setWebhookCopiado(true);
      setTimeout(() => setWebhookCopiado(false), 2500);
    } catch {
      // Ignora erro silencioso de permissão de clipboard
    }
  };

  // --- Handlers de QR Code e Configuração VIBEWHATS ---
  const carregarQrCodeVibe = async () => {
    try {
      setCarregandoQrVibe(true);
      setErroQrVibeModal(null);
      const res = await fetch('/api/whatsapp-business/vibewhats-qr');
      const data = await res.json();
      if (res.ok && data.success && data.qrCode) {
        setQrCodeVibeData(data.qrCode);
      } else {
        throw new Error(data.error || 'Não foi possível obter o QR Code da VibeWhats.');
      }
    } catch (err) {
      console.error('Erro ao carregar QR Code VibeWhats:', err);
      setErroQrVibeModal(err.message || 'Falha ao gerar QR Code.');
    } finally {
      setCarregandoQrVibe(false);
    }
  };

  const handleAbrirModalQrVibe = () => {
    setModalQrVibeAberto(true);
    setConectadoSucessoVibe(false);
    setTelefoneConectadoVibe(null);
    setErroQrVibeModal(null);
    setQrCodeVibeData(null);
    carregarQrCodeVibe();
  };

  const handleFecharModalQrVibe = () => {
    setModalQrVibeAberto(false);
    setQrCodeVibeData(null);
    setErroQrVibeModal(null);
    if (conectadoSucessoVibe) {
      carregarConfiguracao();
    }
  };

  const handleAbrirModalVibe = () => {
    setVibeForm({
      instance: config?.vibewhatsDetails?.instance || '',
      token: '',
      clientToken: '',
      connectedPhone: config?.vibewhatsDetails?.phoneNumber || '',
      webhookSecret: ''
    });
    setErroVibeModal(null);
    setModalVibeAberto(true);
  };

  const handleFecharModalVibe = () => {
    if (salvandoVibe) return;
    setModalVibeAberto(false);
    setErroVibeModal(null);
  };

  const handleSalvarVibe = async (e) => {
    e.preventDefault();
    setErroVibeModal(null);

    const instance = String(vibeForm.instance || '').trim();
    const token = String(vibeForm.token || '').trim();
    const clientToken = String(vibeForm.clientToken || '').trim();
    const cleanPhone = String(vibeForm.connectedPhone || '').replace(/\D+/g, '');
    const webhookSecret = String(vibeForm.webhookSecret || '').trim();

    if (!instance) {
      setErroVibeModal('ID da Instância da VibeWhats é obrigatório.');
      return;
    }
    if (!token) {
      setErroVibeModal('Token da Instância da VibeWhats é obrigatório.');
      return;
    }

    try {
      setSalvandoVibe(true);

      const payload = {
        provider: 'VIBEWHATS',
        instance,
        token,
        clientToken,
        connectedPhone: cleanPhone
      };

      if (webhookSecret) {
        payload.webhookSecret = webhookSecret;
      }

      const res = await fetch('/api/whatsapp-business/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar credenciais da VibeWhats.');
      }

      setModalVibeAberto(false);
      setMensagemStatus({
        tipo: 'sucesso',
        texto: 'Configuração da VibeWhats salva com sucesso! Você pode conectar o WhatsApp via QR Code agora.'
      });

      await carregarConfiguracao();
    } catch (err) {
      setErroVibeModal(err.message || 'Erro ao salvar configuração VibeWhats.');
    } finally {
      setSalvandoVibe(false);
    }
  };

  const handleAbrirTesteVibe = () => {
    setModalTesteVibeAberto(true);
    setResultadoTesteVibe(null);
  };

  const handleExecutarTesteVibe = async (e) => {
    e.preventDefault();
    setResultadoTesteVibe(null);
    const cleanPhone = String(testeTelefoneVibe || '').replace(/\D+/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setResultadoTesteVibe({
        tipo: 'erro',
        mensagem: 'Informe um número de WhatsApp válido com DDD.'
      });
      return;
    }

    try {
      setTestandoVibe(true);
      const res = await fetch('/api/whatsapp-business/vibewhats-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          message: testeMensagemVibe
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao enviar mensagem de teste');
      }

      setResultadoTesteVibe({
        tipo: 'sucesso',
        mensagem: `Mensagem aceita pela VibeWhats! Message ID: ${data.messageId}. (Aguardando entrega via webhook).`
      });
    } catch (err) {
      setResultadoTesteVibe({
        tipo: 'erro',
        mensagem: err.message || 'Erro na chamada de teste de envio.'
      });
    } finally {
      setTestandoVibe(false);
    }
  };

  const handleConfirmarDesconectarVibe = async () => {
    try {
      setDesconectandoVibe(true);
      const res = await fetch('/api/whatsapp-business/vibewhats-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao desconectar instância VibeWhats.');
      }

      setModalDesconectarVibeAberto(false);
      setMensagemStatus({
        tipo: 'sucesso',
        texto: 'Instância VibeWhats desconectada com sucesso. Para voltar a disparar, conecte novamente via QR Code.'
      });

      await carregarConfiguracao();
    } catch (err) {
      setMensagemStatus({
        tipo: 'erro',
        texto: err.message || 'Erro ao desconectar instância VibeWhats.'
      });
    } finally {
      setDesconectandoVibe(false);
    }
  };

  const providerAtivo = config?.provider || 'META';
  const prontoParaEnvio = Boolean(config?.isConfigured || config?.productionReady);

  return (
    <ProtectedRoute module={MODULES.COMUNICACAO}>
      <Layout titulo="WhatsApp Business - Provedor e Integração">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50">
            <h3 className="text-xl font-bold text-gray-800">WhatsApp Business Oficial</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configuração, conexão via QR Code e seleção centralizada do provedor oficial de WhatsApp.
            </p>
          </div>

          {mensagemStatus && (
            <div
              className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
                mensagemStatus.tipo === 'sucesso'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{mensagemStatus.texto}</span>
              <button
                onClick={() => setMensagemStatus(null)}
                className="text-xs text-gray-500 hover:text-gray-800 font-bold ml-4"
              >
                ✕
              </button>
            </div>
          )}

          {/* CARD: Seletor Central de Provedor */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <FontAwesomeIcon icon={faServer} className="text-teal-600" />
                  Provedor Ativo de WhatsApp
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selecione qual infraestrutura de API será utilizada por todos os módulos do sistema (Atendimento Connect, Disparos e Campanhas).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Status Geral:</span>
                {prontoParaEnvio ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                    Pronto para envio
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" />
                    Configuração incompleta
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-teal-600 text-base" />
                Carregando provedor ativo...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* Card 5: VIBEWHATS */}
                {(() => {
                  const isVibeAtivo = providerAtivo === 'VIBEWHATS';
                  const isVibeConnected = Boolean(config?.vibewhatsDetails?.connected);
                  const isVibeConfigured = Boolean(config?.vibewhatsDetails?.configured);
                  const vibePhone = config?.vibewhatsDetails?.phoneNumber || null;
                  const vibeInstance = config?.vibewhatsDetails?.instance || null;
                  const vibeStatus = config?.vibewhatsDetails?.status || 'INATIVO';

                  return (
                    <div
                      key="provider_vibewhats"
                      onClick={() => {
                        if (isVibeConnected && !changing && !isVibeAtivo) {
                          handleTrocarProvedor('VIBEWHATS');
                        }
                      }}
                      className={`p-5 rounded-2xl border-2 transition relative ${
                        isVibeConnected ? 'cursor-pointer hover:border-emerald-300' : ''
                      } ${
                        isVibeAtivo
                          ? 'border-emerald-600 bg-emerald-50/30 shadow-sm'
                          : 'border-gray-200 bg-gray-50/40'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <input
                            type="radio"
                            name="provider_choice"
                            checked={isVibeAtivo}
                            onChange={() => handleTrocarProvedor('VIBEWHATS')}
                            disabled={changing || !isVibeConnected}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1 shrink-0"
                          />
                          <div className="p-3 bg-emerald-100/70 text-emerald-700 rounded-xl shrink-0">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-gray-800 text-sm">VibeWhats API</h5>
                              {isVibeAtivo ? (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-600 text-white rounded-md">
                                  Ativo
                                </span>
                              ) : isVibeConnected ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
                                  Conectado / Pronto
                                </span>
                              ) : isVibeConfigured ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md">
                                  Aguardando QR Code
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md">
                                  Não Configurado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Instância independente WhatsApp via VibeWhats API (Padrão Z-API)
                            </p>

                            {(isVibeConfigured || isVibeConnected) && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-100">
                                {vibeInstance && (
                                  <span className="flex items-center gap-1">
                                    <strong className="text-gray-700">Instância:</strong> {vibeInstance}
                                  </span>
                                )}
                                {vibePhone && (
                                  <span className="flex items-center gap-1">
                                    <strong className="text-gray-700">Número:</strong> +{vibePhone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <strong className="text-gray-700">Status:</strong>
                                  <span className={`font-semibold ${isVibeConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {vibeStatus}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação do Card VIBEWHATS */}
                        <div className="shrink-0 flex items-center gap-2 flex-wrap self-end md:self-center">
                          {isVibeConfigured && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirTesteVibe();
                              }}
                              disabled={changing}
                              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                              title="Testar envio de mensagem"
                            >
                              <span>Testar Envio</span>
                            </button>
                          )}
                          {isVibeConnected ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalDesconectarVibeAberto(true);
                                }}
                                disabled={changing || desconectandoVibe}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                                title="Desconectar sessão do WhatsApp"
                              >
                                <FontAwesomeIcon icon={faPowerOff} className="text-rose-600" />
                                <span>Desconectar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalQrVibe();
                                }}
                                disabled={changing}
                                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                                title="Reconectar via QR Code"
                              >
                                <FontAwesomeIcon icon={faQrcode} className="text-emerald-600" />
                                <span>Reconectar QR</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalVibe();
                                }}
                                disabled={changing}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                              >
                                <FontAwesomeIcon icon={faCog} className="text-xs" />
                                <span>Configurar</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalQrVibe();
                                }}
                                disabled={changing || !isVibeConfigured}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                              >
                                <FontAwesomeIcon icon={faQrcode} className="text-sm" />
                                <span>Conectar novamente</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalVibe();
                                }}
                                disabled={changing}
                                className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                                title="Configurar credenciais da instância"
                              >
                                <FontAwesomeIcon icon={faCog} className="text-gray-500 text-xs" />
                                <span>Configurar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Grid de Detalhes e Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Card de Informações da Conta */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <FontAwesomeIcon icon={faPlug} className="text-teal-600" />
                  Detalhes do Provedor Selecionado
                </h4>

                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Provedor em Uso</label>
                    <input
                      type="text"
                      disabled
                      value={
                        providerAtivo === 'VIBEWHATS'
                          ? 'WhatsApp — API não oficial (VibeWhats)'
                          : providerAtivo === 'WAFLY'
                            ? 'WAFLY Bridge API (Conexão Direta QR Code)'
                            : providerAtivo === 'WABLAST'
                              ? 'WaBlast Partner API (Onboarding Integrado)'
                              : providerAtivo === 'YCLOUD'
                                ? 'YCloud WhatsApp API (v2)'
                                : 'WhatsApp — API oficial (Meta)'
                      }
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Número de WhatsApp Vinculado</label>
                    <input
                      type="text"
                      disabled
                      value={config?.displayPhoneNumber ? `+${config.displayPhoneNumber}` : 'Nenhum número ativo identificado'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar de Status */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-teal-900 text-sm flex items-center gap-2">
                  <FontAwesomeIcon icon={faShieldAlt} />
                  Status da Conexão
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-teal-100 pb-2">
                    <span className="text-teal-700">Canal Ativo</span>
                    <span className="font-bold text-teal-900">{providerAtivo}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-b border-teal-100 pb-2">
                    <span className="text-teal-700">Estado</span>
                    {prontoParaEnvio ? (
                      <span className="font-bold text-green-700 flex items-center gap-1">
                        <FontAwesomeIcon icon={faCheck} className="text-[10px]" /> Operacional
                      </span>
                    ) : (
                      <span className="font-bold text-amber-700 flex items-center gap-1">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" /> Incompleto
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MODAL 1: Conexão WhatsApp via QR Code WAFLY */}
          {modalQrAberto && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-gray-100 relative">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Conectar WhatsApp via QR Code</h3>
                      <p className="text-xs text-gray-500">Pareamento direto com a instância WAFLY</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFecharModalQr}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {/* Conteúdo Dinâmico */}
                {conectadoSucesso ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-xs">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-gray-800 text-lg">WhatsApp Conectado com Sucesso!</h4>
                      <p className="text-xs text-gray-500 max-w-xs">
                        Sua instância foi pareada com sucesso. O sistema já está apto para envios de campanhas e atendimentos.
                      </p>
                    </div>
                    {telefoneConectado && (
                      <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                        Número: +{telefoneConectado}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleFecharModalQr}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
                    >
                      Concluir
                    </button>
                  </div>
                ) : erroQrModal ? (
                  <div className="py-4 space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-2">
                      <div className="font-bold flex items-center gap-2 text-rose-900">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <span>Não foi possível gerar o QR Code</span>
                      </div>
                      <p>{erroQrModal}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleFecharModalQr();
                          handleAbrirModalWafly();
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                      >
                        Configurar Credenciais
                      </button>
                      <button
                        type="button"
                        onClick={carregarQrCode}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                      >
                        <FontAwesomeIcon icon={faSyncAlt} />
                        <span>Tentar Novamente</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Box do QR Code */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200/80 rounded-2xl min-h-[280px]">
                      {carregandoQr ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400 py-16">
                          <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-emerald-600" />
                          <span className="text-xs font-medium">Gerando QR Code...</span>
                        </div>
                      ) : qrCodeData ? (
                        <div className="space-y-3 flex flex-col items-center">
                          <div className="p-2 bg-white rounded-2xl shadow-xs border border-gray-200">
                            <img
                              src={qrCodeData}
                              alt="QR Code WhatsApp WAFLY"
                              className="w-[230px] h-[230px] object-contain rounded-xl"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-600">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-semibold text-gray-700">Aguardando leitura pelo celular...</span>
                            <button
                              type="button"
                              onClick={carregarQrCode}
                              className="ml-2 text-teal-600 hover:text-teal-800 font-bold hover:underline flex items-center gap-1 text-[10px]"
                              title="Renovar QR Code"
                            >
                              <FontAwesomeIcon icon={faSyncAlt} className="text-[9px]" />
                              <span>Atualizar</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Instruções */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 text-xs text-gray-600 space-y-2">
                      <h5 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
                        <FontAwesomeIcon icon={faMobileAlt} className="text-teal-600" />
                        <span>Instruções no celular:</span>
                      </h5>
                      <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-gray-600 leading-relaxed">
                        <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
                        <li>Toque em <strong>Mais opções (⋮)</strong> ou <strong>Configurações (⚙️)</strong>.</li>
                        <li>Toque em <strong>Dispositivos conectados</strong>.</li>
                        <li>Toque em <strong>Conectar dispositivo</strong> e aponte a câmera para o QR Code acima.</li>
                      </ol>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleFecharModalQr}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODAL 2: Modal de Configuração Manual WAFLY */}
          {modalWaflyAberto && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-6 border border-gray-100 relative animate-in fade-in zoom-in-95 duration-150">
                {/* Cabeçalho do Modal */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                      <FontAwesomeIcon icon={faPlug} className="text-lg" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">Configurar Provedor WAFLY</h3>
                      <p className="text-xs text-gray-500">Credenciais de conexão com a API WAFLY</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFecharModalWafly}
                    disabled={salvandoWafly}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {/* Banner de Erro */}
                {erroWaflyModal && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="shrink-0" />
                    <span>{erroWaflyModal}</span>
                  </div>
                )}

                {/* Formulário */}
                <form onSubmit={handleSalvarWafly} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Client Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={waflyForm.clientToken}
                      onChange={(e) => setWaflyForm({ ...waflyForm, clientToken: e.target.value })}
                      placeholder="Token de cliente / autenticação da conta"
                      disabled={salvandoWafly}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Por segurança, o token atual nunca é exibido.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        ID da Instância <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={waflyForm.instance}
                        onChange={(e) => setWaflyForm({ ...waflyForm, instance: e.target.value })}
                        placeholder="Ex: EE1922..."
                        disabled={salvandoWafly}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Token da Instância <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={waflyForm.token}
                        onChange={(e) => setWaflyForm({ ...waflyForm, token: e.target.value })}
                        placeholder="Token de acesso da instância"
                        disabled={salvandoWafly}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Número do WhatsApp do Gabinete <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={waflyForm.connectedPhone || waflyForm.phoneNumber || ''}
                      onChange={(e) => setWaflyForm({
                        ...waflyForm,
                        connectedPhone: e.target.value,
                        phoneNumber: e.target.value
                      })}
                      placeholder="Ex: 5511999998888 (com DDI e DDD)"
                      disabled={salvandoWafly}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Apenas números, incluindo código do país e DDD.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Secret do Webhook <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="password"
                      value={waflyForm.webhookSecret}
                      onChange={(e) => setWaflyForm({ ...waflyForm, webhookSecret: e.target.value })}
                      placeholder="Deixe em branco para gerar automaticamente"
                      disabled={salvandoWafly}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Usado para validar callbacks inbound e status.</p>
                  </div>

                  {/* Informações do Webhook */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">URL do Webhook para cadastro na WAFLY</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getWaflyWebhookUrl()}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopiarWebhook}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shrink-0"
                        title="Copiar URL do Webhook"
                      >
                        <FontAwesomeIcon icon={webhookCopiado ? faCheck : faCopy} className={webhookCopiado ? 'text-green-600' : ''} />
                        <span>{webhookCopiado ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Cadastre esta URL no painel da WAFLY para receber mensagens recebidas e confirmações de entrega.
                    </p>
                  </div>

                  {/* Ações do Modal */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleFecharModalWafly}
                      disabled={salvandoWafly}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoWafly}
                      className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {salvandoWafly && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                      <span>{salvandoWafly ? 'Salvando...' : 'Salvar Credenciais'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 1: Configuração Manual VIBEWHATS */}
          {modalVibeAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FontAwesomeIcon icon={faWhatsapp} className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">Configurar Instância VibeWhats</h4>
                      <p className="text-xs text-gray-500">Credenciais criptografadas no servidor (AES-256-GCM)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFecharModalVibe}
                    disabled={salvandoVibe}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {erroVibeModal && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
                    <span>{erroVibeModal}</span>
                  </div>
                )}

                <form onSubmit={handleSalvarVibe} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ID da Instância <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vibeForm.instance}
                      onChange={(e) => setVibeForm({ ...vibeForm, instance: e.target.value })}
                      placeholder="Ex: 3B4C5D6E7F8G9H"
                      disabled={salvandoVibe}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Token da Instância <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={vibeForm.token}
                      onChange={(e) => setVibeForm({ ...vibeForm, token: e.target.value })}
                      placeholder="Token gerado no painel da VibeWhats"
                      disabled={salvandoVibe}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Client-Token <span className="text-gray-400 font-normal">(Opcional se ativado no painel)</span>
                    </label>
                    <input
                      type="password"
                      value={vibeForm.clientToken}
                      onChange={(e) => setVibeForm({ ...vibeForm, clientToken: e.target.value })}
                      placeholder="Deixe em branco se não ativou Client-Token na conta"
                      disabled={salvandoVibe}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Número Conectado <span className="text-gray-400 font-normal">(Preenchido automaticamente após QR)</span>
                    </label>
                    <input
                      type="text"
                      value={vibeForm.connectedPhone}
                      onChange={(e) => setVibeForm({ ...vibeForm, connectedPhone: e.target.value })}
                      placeholder="Ex: 5511999998888"
                      disabled={salvandoVibe}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleFecharModalVibe}
                      disabled={salvandoVibe}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoVibe}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {salvandoVibe && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                      <span>{salvandoVibe ? 'Salvando...' : 'Salvar Credenciais'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 2: QR Code VIBEWHATS */}
          {modalQrVibeAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-center space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-gray-800 text-base">Conectar WhatsApp - VibeWhats</h4>
                  <button
                    type="button"
                    onClick={handleFecharModalQrVibe}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {conectadoSucessoVibe ? (
                  <div className="py-6 space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <h5 className="font-bold text-gray-800 text-lg">WhatsApp Conectado com Sucesso!</h5>
                    {telefoneConectadoVibe && (
                      <p className="text-sm font-semibold text-gray-600">Número: +{telefoneConectadoVibe}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleFecharModalQrVibe}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition"
                    >
                      Concluir
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">
                      Abra o WhatsApp no celular do gabinete, acesse <strong>Aparelhos Conectados</strong> e aponte a câmera para o QR Code abaixo:
                    </p>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center min-h-[260px]">
                      {carregandoQrVibe ? (
                        <div className="space-y-2">
                          <FontAwesomeIcon icon={faSpinner} className="text-emerald-600 text-3xl animate-spin" />
                          <p className="text-xs text-gray-500 font-medium">Gerando QR Code...</p>
                        </div>
                      ) : erroQrVibeModal ? (
                        <div className="p-3 text-red-600 text-xs space-y-2">
                          <p>{erroQrVibeModal}</p>
                          <button
                            type="button"
                            onClick={carregarQrCodeVibe}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-red-800 font-semibold"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : qrCodeVibeData ? (
                        <img
                          src={qrCodeVibeData}
                          alt="QR Code WhatsApp VibeWhats"
                          className="w-60 h-60 object-contain rounded-xl shadow-xs"
                        />
                      ) : (
                        <p className="text-xs text-gray-400">Nenhum QR Code disponível.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                      <button
                        type="button"
                        onClick={carregarQrCodeVibe}
                        disabled={carregandoQrVibe}
                        className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faSyncAlt} className={carregandoQrVibe ? 'animate-spin' : ''} />
                        <span>Atualizar código</span>
                      </button>
                      <span>Aguardando leitura...</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modal 3: Teste de Envio VIBEWHATS */}
          {modalTesteVibeAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-gray-800 text-base">Teste de Envio - VibeWhats</h4>
                  <button
                    type="button"
                    onClick={() => setModalTesteVibeAberto(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {resultadoTesteVibe && (
                  <div
                    className={`p-3.5 text-xs rounded-xl border flex items-start gap-2.5 ${
                      resultadoTesteVibe.tipo === 'sucesso'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={resultadoTesteVibe.tipo === 'sucesso' ? faCheckCircle : faTriangleExclamation}
                      className="mt-0.5 shrink-0"
                    />
                    <span>{resultadoTesteVibe.mensagem}</span>
                  </div>
                )}

                <form onSubmit={handleExecutarTesteVibe} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Destinatário (WhatsApp com DDI e DDD) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={testeTelefoneVibe}
                      onChange={(e) => setTesteTelefoneVibe(e.target.value)}
                      placeholder="Ex: 5511999998888"
                      required
                      disabled={testandoVibe}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mensagem de Teste</label>
                    <textarea
                      value={testeMensagemVibe}
                      onChange={(e) => setTesteMensagemVibe(e.target.value)}
                      rows={3}
                      disabled={testandoVibe}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setModalTesteVibeAberto(false)}
                      disabled={testandoVibe}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      Fechar
                    </button>
                    <button
                      type="submit"
                      disabled={testandoVibe}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {testandoVibe && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                      <span>{testandoVibe ? 'Enviando...' : 'Disparar Teste'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 4: Confirmação de Desconexão VIBEWHATS */}
          {modalDesconectarVibeAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                      <FontAwesomeIcon icon={faPowerOff} className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-base">Desconectar WhatsApp</h4>
                      <p className="text-xs text-gray-500">Instância VibeWhats API</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalDesconectarVibeAberto(false)}
                    disabled={desconectandoVibe}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    Tem certeza de que deseja desconectar a sessão do WhatsApp desta instância?
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Importante:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Suas credenciais e integrações permanecem salvas com segurança.</li>
                      <li>Novos disparos e mensagens automáticas serão pausados até reconexão.</li>
                      <li>Para reconectar, basta escanear novamente o QR Code com seu WhatsApp.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalDesconectarVibeAberto(false)}
                    disabled={desconectandoVibe}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarDesconectarVibe}
                    disabled={desconectandoVibe}
                    className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {desconectandoVibe && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                    <span>{desconectandoVibe ? 'Desconectando...' : 'Sim, Desconectar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
