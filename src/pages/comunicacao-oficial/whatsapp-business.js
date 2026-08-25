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
  faMobileAlt
} from '@fortawesome/free-solid-svg-icons';
import { MODULES } from '@/utils/permissions';

export default function WhatsAppBusinessOficial() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [iniciandoWablast, setIniciandoWablast] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState(null);

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
          texto: 'WhatsApp WABLAST conectado com sucesso.'
        });
      } else if (data?.status === 'PENDING') {
        setMensagemStatus({
          tipo: 'info',
          texto: 'O WhatsApp foi conectado, mas a confirmação da WaBlast ainda está sendo processada. Tente novamente em alguns instantes.'
        });
      } else if (data?.status === 'NO_SESSION') {
        // Nenhuma sessão pendente, apenas carrega configuração
        setMensagemStatus(null);
      } else {
        setMensagemStatus({
          tipo: 'erro',
          texto: 'Não foi possível sincronizar a conexão WABLAST.'
        });
      }
    } catch (syncErr) {
      console.error('Erro ao sincronizar retorno WaBlast:', syncErr);
      setMensagemStatus({
        tipo: 'erro',
        texto: 'Não foi possível sincronizar a conexão WABLAST.'
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

                {/* Opção WABLAST (Partner Onboarding) */}
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
                              <h5 className="font-bold text-gray-800 text-sm">WaBlast Partner API</h5>
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
                            <p className="text-xs text-gray-500">Conexão simplificada e homologação WABA integrada</p>

                            {isWablastConnected && (wablastPhone || wablastWaba) && (
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-600 font-medium">
                                {wablastPhone && (
                                  <span className="flex items-center gap-1">
                                    <strong>Número:</strong> {wablastPhone}
                                  </span>
                                )}
                                {wablastWaba && (
                                  <span className="flex items-center gap-1">
                                    <strong>WABA:</strong> {wablastWaba}
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
                                handleIniciarOnboardingWaBlast();
                              }}
                              disabled={iniciandoWablast || changing}
                              className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                              title="Reconectar ou alterar número WaBlast"
                            >
                              <FontAwesomeIcon icon={faPlug} className="text-[10px] text-teal-600" />
                              Reconectar
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
                        providerAtivo === 'WABLAST'
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
