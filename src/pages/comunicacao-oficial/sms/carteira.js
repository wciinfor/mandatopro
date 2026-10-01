import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet,
  faCoins,
  faLock,
  faExclamationCircle,
  faCheckCircle,
  faPlus,
  faArrowLeft,
  faSpinner,
  faSyncAlt,
  faInfoCircle,
  faHistory,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import AssistenteCampanha from '@/components/AssistenteCampanha';

export default function SmsCarteiraPage() {
  const router = useRouter();
  const [saldo, setSaldo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [criando, setCriando] = useState(false);

  const carregarSaldo = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch('/api/sms/saldo');
      if (!res.ok) {
        throw new Error('Falha ao carregar informações da carteira SMS.');
      }
      const data = await res.json();
      setSaldo(data?.saldo || data);
    } catch (err) {
      console.error('Erro ao consultar carteira SMS:', err);
      setErro(err.message || 'Erro ao consultar saldo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSaldo();
  }, []);

  const handleSalvarNovaCampanha = async (novaCamp) => {
    try {
      const res = await fetch('/api/comunicacao-oficial/salvar-comunicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaCamp)
      });
      if (res.ok) {
        const criada = await res.json();
        if (criada?.id) {
          router.push(`/comunicacao-oficial/campanhas/${criada.id}`);
          return;
        }
        await carregarSaldo();
      }
    } catch (err) {
      console.error('Erro ao salvar comunicação SMS:', err);
    }
    setCriando(false);
  };

  const statusAtivo = (saldo?.status || 'ATIVO').toUpperCase() === 'ATIVO';

  return (
    <ProtectedRoute>
      <Layout titulo="Carteira de Créditos SMS - SMSDev">
        {criando ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faWallet} className="text-blue-600" />
                <h3 className="font-bold text-gray-800 text-sm">Criar Nova Campanha SMS (SMSDev)</h3>
              </div>
            </div>
            <AssistenteCampanha
              canalInicial="sms"
              onCancel={() => setCriando(false)}
              onSave={handleSalvarNovaCampanha}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white rounded-2xl p-6 shadow-sm border border-blue-100 gap-4">
              <div>
                <button
                  onClick={() => router.push('/comunicacao-oficial/sms')}
                  className="text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1.5 mb-2 transition"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Voltar para Central SMS
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
                    <FontAwesomeIcon icon={faWallet} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Carteira de Créditos SMS</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Gestão de saldo, limites operacionais e acompanhamento financeiro de disparos SMS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={carregarSaldo}
                  disabled={loading}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-xs shadow-xs"
                >
                  <FontAwesomeIcon icon={faSyncAlt} className={loading ? 'animate-spin text-blue-600' : ''} />
                  Atualizar Saldo
                </button>
                <button
                  onClick={() => setCriando(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Nova Campanha SMS
                </button>
              </div>
            </div>

            {/* Grid de Cards da Carteira */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Saldo Disponível */}
              <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
                    Saldo Disponível
                  </span>
                  <FontAwesomeIcon icon={faCoins} className="text-blue-200 text-lg" />
                </div>
                <div className="my-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-blue-200 text-sm">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Consultando carteira...</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black tracking-tight">
                        {saldo?.saldo_disponivel ?? 0}
                      </span>
                      <span className="text-sm text-blue-200 font-medium">créditos</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-blue-100/80 pt-2 border-t border-blue-500/40">
                  Pronto para uso imediato em novas campanhas
                </p>
              </div>

              {/* Créditos Totais */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Créditos Totais</span>
                  <FontAwesomeIcon icon={faCoins} className="text-gray-400" />
                </div>
                <div className="my-3">
                  <span className="text-3xl font-bold text-gray-800">
                    {saldo?.saldo_creditos ?? 0}
                  </span>
                  <span className="text-xs text-gray-400 block mt-0.5">saldo bruto na conta</span>
                </div>
                <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Total adquirido
                </p>
              </div>

              {/* Créditos Reservados */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Créditos Reservados</span>
                  <FontAwesomeIcon icon={faLock} className="text-amber-500" />
                </div>
                <div className="my-3">
                  <span className="text-3xl font-bold text-amber-600">
                    {saldo?.saldo_reservado ?? 0}
                  </span>
                  <span className="text-xs text-gray-400 block mt-0.5">alocados em fila de envio</span>
                </div>
                <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Bloqueados transacionalmente
                </p>
              </div>

              {/* Status da Carteira */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Status Operacional</span>
                  <FontAwesomeIcon
                    icon={statusAtivo ? faCheckCircle : faExclamationCircle}
                    className={statusAtivo ? 'text-emerald-500' : 'text-rose-500'}
                  />
                </div>
                <div className="my-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      statusAtivo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {saldo?.status || 'ATIVO'}
                  </span>
                  <span className="text-xs text-gray-400 block mt-1">
                    Alerta mínimo: <strong>{saldo?.alerta_saldo_minimo ?? 20} créditos</strong>
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Tenant #{saldo?.tenant_id || 1}
                </p>
              </div>
            </div>

            {/* Informações de Regra de Negócio & Segurança */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                  <FontAwesomeIcon icon={faShieldAlt} className="text-blue-600" />
                  <h4>Proteção e Reserva Transacional</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Cada envio de SMS reserva 1 crédito por destinatário no momento do disparo. 
                  O débito definitivo ocorre após a confirmação de entrega pela SMSDev, e em caso de falha irreversível, o crédito reservado é automaticamente estornado para o saldo disponível.
                </p>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    Regra de Tarifação:
                  </div>
                  <div>• 1 crédito = 1 mensagem SMS de até 160 caracteres.</div>
                  <div>• Variáveis como <code>{'{nome}'}</code> são computadas no limite final.</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                  <FontAwesomeIcon icon={faHistory} className="text-blue-600" />
                  <h4>Extrato & Histórico de Movimentações</h4>
                </div>
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-4">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 text-lg" />
                  <p className="text-xs text-gray-500 max-w-xs">
                    O extrato detalhado de recargas e movimentações financeiras da carteira será disponibilizado em atualizações futuras.
                  </p>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Consulte os relatórios por campanha para verificar consumos por lote.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
