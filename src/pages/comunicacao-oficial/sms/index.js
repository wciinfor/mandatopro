import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCommentSms,
  faCoins,
  faWallet,
  faPlus,
  faPaperPlane,
  faCheckDouble,
  faBan,
  faClock,
  faSpinner,
  faArrowRight,
  faSyncAlt,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { CampanhaCard } from '@/components/CampanhaCard';
import AssistenteCampanha from '@/components/AssistenteCampanha';

export default function SmsCentralPage() {
  const router = useRouter();
  const [saldo, setSaldo] = useState(null);
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaldo, setLoadingSaldo] = useState(true);
  const [erro, setErro] = useState(null);
  const [criando, setCriando] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    setLoadingSaldo(true);
    setErro(null);

    try {
      // 1. Carregar Saldo SMS
      const resSaldo = await fetch('/api/sms/saldo');
      if (resSaldo.ok) {
        const dataSaldo = await resSaldo.json();
        setSaldo(dataSaldo?.saldo || dataSaldo);
      } else {
        console.warn('Não foi possível carregar o saldo SMS');
      }
    } catch (err) {
      console.error('Erro ao consultar saldo SMS:', err);
    } finally {
      setLoadingSaldo(false);
    }

    try {
      // 2. Carregar Campanhas Oficiais e filtrar por canal SMS
      const resCamp = await fetch('/api/comunicacao-oficial/salvar-comunicacao');
      if (resCamp.ok) {
        const todasCampanhas = await resCamp.json();
        const campanhasSms = (todasCampanhas || []).filter(
          (c) =>
            String(c.canal || '').toLowerCase() === 'sms' ||
            String(c.metadata?.provider || '').toUpperCase() === 'SMSDEV'
        );
        setCampanhas(campanhasSms);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas SMS:', err);
      setErro('Falha ao carregar as campanhas SMS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
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
        await carregarDados();
      }
    } catch (err) {
      console.error('Erro ao salvar comunicação SMS:', err);
    }
    setCriando(false);
  };

  // Métricas agregadas de SMS
  const totalCampanhas = campanhas.length;
  const totalEnviados = campanhas.reduce((acc, c) => acc + Number(c.total_enviados || 0), 0);
  const totalEntregues = campanhas.reduce((acc, c) => acc + Number(c.total_entregues || 0), 0);
  const totalFalhas = campanhas.reduce((acc, c) => acc + Number(c.total_falhas || 0), 0);
  const totalConsumidos = campanhas.reduce(
    (acc, c) => acc + Number(c.creditos_consumidos || c.total_enviados || 0),
    0
  );

  return (
    <ProtectedRoute>
      <Layout titulo="SMS (SMSDev) - Central de Comunicação">
        {criando ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCommentSms} className="text-blue-600" />
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
                    <FontAwesomeIcon icon={faCommentSms} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-800">SMS (SMSDev)</h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        SMS • SMSDev
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Central de comunicação por SMS direta, rápida e com taxa de entrega comprovada.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => router.push('/comunicacao-oficial/sms/carteira')}
                  className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-xs shadow-xs"
                >
                  <FontAwesomeIcon icon={faWallet} className="text-blue-600" />
                  Ver Carteira
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

            {/* Grid de Métricas e Saldo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card Saldo Disponível */}
              <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
                    Saldo Disponível
                  </span>
                  <FontAwesomeIcon icon={faCoins} className="text-blue-200 text-base" />
                </div>
                <div className="my-3">
                  {loadingSaldo ? (
                    <div className="flex items-center gap-2 text-blue-200 text-sm">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Consultando...</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight">
                        {saldo?.saldo_disponivel ?? 0}
                      </span>
                      <span className="text-xs text-blue-200 font-medium">créditos</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-100/90 pt-2 border-t border-blue-500/40">
                  <span>Status: <strong>{saldo?.status || 'ATIVO'}</strong></span>
                  <button
                    onClick={() => router.push('/comunicacao-oficial/sms/carteira')}
                    className="underline hover:text-white flex items-center gap-1 font-semibold"
                  >
                    Detalhes <FontAwesomeIcon icon={faArrowRight} className="text-[9px]" />
                  </button>
                </div>
              </div>

              {/* Card Créditos Consumidos */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Consumidos</span>
                  <FontAwesomeIcon icon={faCoins} className="text-amber-500 text-sm" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-bold text-gray-800">{totalConsumidos}</span>
                  <span className="text-xs text-gray-400 block mt-0.5">créditos debitados</span>
                </div>
                <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Total em campanhas
                </div>
              </div>

              {/* Card SMS Enviados */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">SMS Enviados</span>
                  <FontAwesomeIcon icon={faPaperPlane} className="text-blue-500 text-sm" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-bold text-gray-800">{totalEnviados}</span>
                  <span className="text-xs text-gray-400 block mt-0.5">disparados ao provider</span>
                </div>
                <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Processados na fila
                </div>
              </div>

              {/* Card SMS Entregues */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Entregues</span>
                  <FontAwesomeIcon icon={faCheckDouble} className="text-emerald-500 text-sm" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-bold text-emerald-600">{totalEntregues}</span>
                  <span className="text-xs text-gray-400 block mt-0.5">
                    {totalEnviados > 0 ? `${Math.round((totalEntregues / totalEnviados) * 100)}% de entrega` : 'DLR confirmado'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Confirmação de operadora
                </div>
              </div>

              {/* Card SMS Falhas */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Falhas</span>
                  <FontAwesomeIcon icon={faBan} className="text-rose-500 text-sm" />
                </div>
                <div className="my-2">
                  <span className="text-2xl font-bold text-rose-600">{totalFalhas}</span>
                  <span className="text-xs text-gray-400 block mt-0.5">números rejeitados</span>
                </div>
                <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  Estorno automático
                </div>
              </div>
            </div>

            {/* Seção Campanhas SMS Recentes */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Campanhas SMS Recentes</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Histórico de transmissões e disparos realizados via SMSDev.
                  </p>
                </div>
                <button
                  onClick={carregarDados}
                  disabled={loading}
                  className="text-xs font-bold text-gray-600 hover:text-blue-600 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <FontAwesomeIcon icon={faSyncAlt} className={loading ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-600" />
                  <span className="text-xs font-medium">Carregando campanhas SMS...</span>
                </div>
              ) : erro ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>{erro}</span>
                </div>
              ) : campanhas.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl">
                    <FontAwesomeIcon icon={faCommentSms} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Nenhuma campanha SMS encontrada</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-md">
                      Crie sua primeira transmissão de SMS para se comunicar diretamente com seus eleitores e contatos.
                    </p>
                  </div>
                  <button
                    onClick={() => setCriando(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center gap-2 shadow-xs"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Criar Primeira Campanha SMS
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                  {campanhas.map((campanha) => (
                    <CampanhaCard key={campanha.id} campanha={campanha} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
}
