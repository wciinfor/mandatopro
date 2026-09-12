import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlug,
  faShieldAlt,
  faCheck,
  faTriangleExclamation,
  faServer,
  faSpinner,
  faMobileAlt,
  faSyncAlt,
  faKey,
  faCopy,
  faTimes,
  faCog
} from '@fortawesome/free-solid-svg-icons';
import { MODULES } from '@/utils/permissions';

export default function WhatsAppBusinessOficial() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [iniciandoWablast, setIniciandoWablast] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState(null);

  // Estados específicos para modal e configuração WAFLY
  const [modalWaflyAberto, setModalWaflyAberto] = useState(false);
  const [salvandoWafly, setSalvandoWafly] = useState(false);
  const [waflyForm, setWaflyForm] = useState({
    clientToken: '',
    instance: '',
    token: '',
    connectedPhone: '',
    webhookSecret: ''
  });
  const [erroWaflyModal, setErroWaflyModal] = useState(null);
  const [webhookCopiado, setWebhookCopiado] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query?.onboarding === 'wablast_complete') {
      executarSincronizacaoWaBlast();
    } else {
      carregarConfiguracao();
    }
  }, [router.isReady, router.query]);

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

  const handleIniciarOnboardingWaBlast = async () => {
    try {
      setIniciandoWablast(true);
      setMensagemStatus(null);

      const res = await fetch('/api/whatsapp-business/wablast-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.embed_url) {
        throw new Error(data.error || 'Não foi possível gerar a sessão de onboarding do WaBlast');
      }

      setMensagemStatus({
        tipo: 'sucesso',
        texto: 'Sessão de onboarding gerada com sucesso! Redirecionando para a conexão oficial...'
      });

      // Abre a tela oficial do Embedded Signup do WaBlast
      window.location.href = data.embed_url;
    } catch (err) {
      setMensagemStatus({
        tipo: 'erro',
        texto: err.message || 'Falha ao iniciar onboarding WaBlast'
      });
    } finally {
      setIniciandoWablast(false);
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

  const handleAbrirModalWafly = () => {
    setWaflyForm({
      clientToken: '',
      instance: config?.waflyDetails?.instance || '',
      token: '',
      connectedPhone: config?.waflyDetails?.phoneNumber || '',
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
    const cleanPhone = String(waflyForm.connectedPhone || '').replace(/\D+/g, '');
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
        texto: 'Configuração da WAFLY salva com sucesso! Selecione a WAFLY como provedor ativo quando desejar.'
      });

      // Recarrega o estado atual da configuração
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
              Configuração e seleção centralizada do provedor oficial de WhatsApp para envios e atendimentos.
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

          {/* CARD NOVO: Seletor Central de Provedor */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opção META */}
                <div
                  onClick={() => handleTrocarProvedor('META')}
                  className={`p-5 rounded-xl border-2 transition cursor-pointer relative ${
                    providerAtivo === 'META'
                      ? 'border-teal-600 bg-teal-50/30 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="provider_choice"
                        checked={providerAtivo === 'META'}
                        onChange={() => handleTrocarProvedor('META')}
                        disabled={changing}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <h5 className="font-bold text-gray-800 text-sm">Meta Cloud API</h5>
                        <p className="text-xs text-gray-500">Conexão oficial direta via Embedded Signup da Meta</p>
                      </div>
                    </div>
                    {providerAtivo === 'META' && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-teal-600 text-white rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Opção YCLOUD */}
                <div
                  onClick={() => handleTrocarProvedor('YCLOUD')}
                  className={`p-5 rounded-xl border-2 transition cursor-pointer relative ${
                    providerAtivo === 'YCLOUD'
                      ? 'border-teal-600 bg-teal-50/30 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="provider_choice"
                        checked={providerAtivo === 'YCLOUD'}
                        onChange={() => handleTrocarProvedor('YCLOUD')}
                        disabled={changing}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <h5 className="font-bold text-gray-800 text-sm">YCloud</h5>
                        <p className="text-xs text-gray-500">Provedor oficial com autenticação via X-API-Key</p>
                      </div>
                    </div>
                    {providerAtivo === 'YCLOUD' && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-teal-600 text-white rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Opção WABLAST (Conta Direta) */}
                {(() => {
                  const isWablastConnected = Boolean(
                    config?.wablastDetails?.connected || 
                    config?.availableProviders?.WABLAST || 
                    config?.provider === 'WABLAST'
                  );
                  const isWablastAtivo = providerAtivo === 'WABLAST';
                  const wablastPhone = config?.wablastDetails?.phoneNumber || (isWablastAtivo ? config?.displayPhoneNumber : null);
                  const wablastWaba = config?.wablastDetails?.wabaId;

                  return (
                    <div
                      onClick={() => {
                        if (isWablastConnected) {
                          handleTrocarProvedor('WABLAST');
                        }
                      }}
                      className={`p-5 rounded-xl border-2 transition relative md:col-span-2 ${
                        isWablastConnected ? 'cursor-pointer hover:border-gray-300' : ''
                      } ${
                        isWablastAtivo
                          ? 'border-teal-600 bg-teal-50/30 shadow-sm'
                          : 'border-gray-200 bg-gray-50/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="provider_choice"
                            checked={isWablastAtivo}
                            onChange={() => handleTrocarProvedor('WABLAST')}
                            disabled={changing || !isWablastConnected}
                            className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                          />
                          <div className="p-2.5 bg-teal-100/60 text-teal-700 rounded-lg shrink-0">
                            <FontAwesomeIcon icon={faMobileAlt} className="text-lg" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-gray-800 text-sm">WaBlast API</h5>
                              {isWablastAtivo ? (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-teal-600 text-white rounded">
                                  Ativo
                                </span>
                              ) : isWablastConnected ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                  Conectado
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-500">Conexão direta oficial via WaBlast API</p>

                            {isWablastConnected && (wablastPhone || wablastWaba) && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white/70 px-3 py-1.5 rounded-lg border border-teal-100">
                                {wablastPhone && (
                                  <span className="flex items-center gap-1">
                                    <strong>Número:</strong> {wablastPhone}
                                  </span>
                                )}
                                {wablastWaba && (
                                  <span className="flex items-center gap-1">
                                    <strong>WABA ID:</strong> {wablastWaba}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isWablastConnected ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                executarSincronizacaoWaBlast();
                              }}
                              disabled={loading || changing}
                              className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-teal-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                              title="Sincronizar dados da conta WaBlast"
                            >
                              <FontAwesomeIcon icon={faSyncAlt} className={`text-[10px] text-teal-600 ${loading ? 'animate-spin' : ''}`} />
                              Sincronizar dados
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIniciarOnboardingWaBlast();
                              }}
                              disabled={iniciandoWablast || changing}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                            >
                              {iniciandoWablast ? (
                                <>
                                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xs" />
                                  Gerando sessão...
                                </>
                              ) : (
                                <>
                                  <FontAwesomeIcon icon={faPlug} className="text-xs" />
                                  Conectar WABLAST
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Opção WAFLY (Conta Direta via Bridge API) */}
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
                  const waflyStatus = config?.waflyDetails?.status || (isWaflyConnected ? 'ATIVO' : 'INATIVO');

                  return (
                    <div
                      onClick={() => {
                        if (isWaflyConnected) {
                          handleTrocarProvedor('WAFLY');
                        }
                      }}
                      className={`p-5 rounded-xl border-2 transition relative md:col-span-2 ${
                        isWaflyConnected ? 'cursor-pointer hover:border-gray-300' : ''
                      } ${
                        isWaflyAtivo
                          ? 'border-teal-600 bg-teal-50/30 shadow-sm'
                          : 'border-gray-200 bg-gray-50/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="provider_choice"
                            checked={isWaflyAtivo}
                            onChange={() => handleTrocarProvedor('WAFLY')}
                            disabled={changing || !isWaflyConnected}
                            className="w-4 h-4 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                          />
                          <div className="p-2.5 bg-teal-100/60 text-teal-700 rounded-lg shrink-0">
                            <FontAwesomeIcon icon={faMobileAlt} className="text-lg" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-gray-800 text-sm">WAFLY</h5>
                              {isWaflyAtivo ? (
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-teal-600 text-white rounded">
                                  Ativo
                                </span>
                              ) : isWaflyConnected ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                  Conectado / Pronto
                                </span>
                              ) : isWaflyConfigured ? (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                  Configuração Incompleta
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                                  Não Configurado
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">Conexão direta oficial via WAFLY Bridge API</p>

                            {(isWaflyConfigured || isWaflyConnected) && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white/70 px-3 py-1.5 rounded-lg border border-teal-100">
                                {waflyInstance && (
                                  <span className="flex items-center gap-1">
                                    <strong>Instância:</strong> {waflyInstance}
                                  </span>
                                )}
                                {waflyPhone && (
                                  <span className="flex items-center gap-1">
                                    <strong>Número:</strong> {waflyPhone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <strong>Status:</strong> {waflyStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirModalWafly();
                            }}
                            disabled={changing}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <FontAwesomeIcon icon={isWaflyConfigured ? faCog : faPlug} className="text-xs" />
                            {isWaflyConfigured ? 'Configurar WAFLY' : 'Conectar WAFLY'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

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
                          ? 'WAFLY Bridge API (Conexão Direta)'
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
                      value={config?.displayPhoneNumber || 'Nenhum número ativo identificado'}
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

          {/* Modal de Configuração WAFLY */}
          {modalWaflyAberto && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
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
                      value={waflyForm.phoneNumber}
                      onChange={(e) => setWaflyForm({ ...waflyForm, phoneNumber: e.target.value })}
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
