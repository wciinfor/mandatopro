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
  faArrowRight
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
                {/* Opção WAFLY (Conexão Direta via QR Code / Bridge API) */}
                {(() => {
                  const isWaflyConnected = Boolean(
                    config?.waflyDetails?.connected ||
                    config?.availableProviders?.WAFLY ||
                    config?.provider === 'WAFLY'
                  );
                  const isWaflyConfigured = Boolean(
                    config?.waflyDetails?.configured ||
                    isWaflyConnected
                  );
                  const isWaflyAtivo = providerAtivo === 'WAFLY';
                  const waflyPhone = config?.waflyDetails?.phoneNumber || (isWaflyAtivo ? config?.displayPhoneNumber : null);
                  const waflyInstance = config?.waflyDetails?.instance;
                  const waflyStatus = config?.waflyDetails?.status || (isWaflyConnected ? 'ATIVO' : 'DESCONECTADO');

                  return (
                    <div
                      onClick={() => {
                        if (isWaflyConnected) {
                          handleTrocarProvedor('WAFLY');
                        }
                      }}
                      className={`p-5 rounded-2xl border-2 transition relative ${
                        isWaflyConnected ? 'cursor-pointer hover:border-teal-300' : ''
                      } ${
                        isWaflyAtivo
                          ? 'border-teal-600 bg-teal-50/30 shadow-sm'
                          : 'border-gray-200 bg-gray-50/40'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <input
                            type="radio"
                            name="provider_choice"
                            checked={isWaflyAtivo}
                            onChange={() => handleTrocarProvedor('WAFLY')}
                            disabled={changing || !isWaflyConnected}
                            className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1 shrink-0"
                          />
                          <div className="p-3 bg-teal-100/70 text-teal-700 rounded-xl shrink-0">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-gray-800 text-sm">WAFLY</h5>
                              {isWaflyAtivo ? (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-teal-600 text-white rounded-md">
                                  Ativo
                                </span>
                              ) : isWaflyConnected ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
                                  Conectado / Pronto
                                </span>
                              ) : isWaflyConfigured ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-md">
                                  Desconectado
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-200 text-gray-700 rounded-md">
                                  Não Configurado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Conexão direta do WhatsApp via leitura de QR Code (WAFLY Bridge API)
                            </p>

                            {(isWaflyConfigured || isWaflyConnected) && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white/80 px-3 py-1.5 rounded-xl border border-teal-100">
                                {waflyInstance && (
                                  <span className="flex items-center gap-1">
                                    <strong className="text-gray-700">Instância:</strong> {waflyInstance}
                                  </span>
                                )}
                                {waflyPhone && (
                                  <span className="flex items-center gap-1">
                                    <strong className="text-gray-700">Número:</strong> +{waflyPhone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <strong className="text-gray-700">Status:</strong>
                                  <span className={`font-semibold ${isWaflyConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {waflyStatus}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação do Card WAFLY */}
                        <div className="shrink-0 flex items-center gap-2 flex-wrap self-end md:self-center">
                          {isWaflyConnected ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalQr();
                                }}
                                disabled={changing}
                                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                                title="Reconectar via QR Code"
                              >
                                <FontAwesomeIcon icon={faQrcode} className="text-teal-600" />
                                <span>Reconectar QR</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalWafly();
                                }}
                                disabled={changing}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                              >
                                <FontAwesomeIcon icon={faCog} className="text-xs" />
                                <span>Configurar WAFLY</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalQr();
                                }}
                                disabled={changing}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                              >
                                <FontAwesomeIcon icon={faQrcode} className="text-sm" />
                                <span>Conectar WhatsApp</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalWafly();
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
                        providerAtivo === 'WAFLY'
                          ? 'WAFLY Bridge API (Conexão Direta QR Code)'
                          : providerAtivo === 'WABLAST'
                            ? 'WaBlast Partner API (Onboarding Integrado)'
                            : providerAtivo === 'YCLOUD'
                              ? 'YCloud WhatsApp API (v2)'
                              : 'Meta Cloud API (v21.0)'
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
