import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faArrowLeft,
  faChartLine,
  faFilter,
  faHistory,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
import { LinhaTempoJornada } from '@/components/LinhaTempoJornada';
import { AcompanhamentoExecucao } from '@/components/AcompanhamentoExecucao';
import { FunilResultadosCampanha } from '@/components/FunilResultadosCampanha';

// Mocks de campanhas detalhadas para jornada
const JORNADA_CAMPANHA_MOCK = {
  id: 'camp-1',
  nome: 'Informativo Obras Verão',
  canal: 'whatsapp',
  template: 'obras_praca_central',
  publico: 'Bairro Centro - Opt-in',
  status: 'enviando',
  agendamento: null,
  total_destinatarios: 450,
  enviadas: 380,
  entregues: 375,
  lidas: 290,
  falhas: 5,
  created_at: new Date().toISOString()
};

// Histórico de logs simulados de webhook e disparos locais
const FILA_EXECUCAO_MOCK = [
  { contact_id: '+5591999998888', status: 'lida', updated_at: new Date().toISOString(), attempts: 1, last_error: null },
  { contact_id: '+5591999997777', status: 'entregue', updated_at: new Date(Date.now() - 30000).toISOString(), attempts: 1, last_error: null },
  { contact_id: '+5591999996666', status: 'falhou', updated_at: new Date(Date.now() - 60000).toISOString(), attempts: 3, last_error: 'Meta API: Sandbox limit exceeded' },
  { contact_id: '+5591999995555', status: 'enviada', updated_at: new Date(Date.now() - 120000).toISOString(), attempts: 1, last_error: null }
];

const RESULTADOS_MOCK = {
  campaign_id: 'camp-1',
  cliques_botoes: 45,
  cliques_links: 32,
  respostas_recebidas: 85,
  conversas_iniciadas: 110,
  conversoes: 62,
  taxa_conversao: 13.7,
  custo_por_conversa: 0.15
};

export default function JornadaCampanhaPage() {
  const router = useRouter();
  const { id } = router.query;

  const [campanha, setCampanha] = useState(JORNADA_CAMPANHA_MOCK);
  const [filaLogs, setFilaLogs] = useState(FILA_EXECUCAO_MOCK);
  
  // Filtros Operacionais solicitados
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroCanal, setFiltroCanal] = useState('all');
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');
  const [filtroPublico, setFiltroPublico] = useState('all');

  const filtrarLogs = filaLogs.filter((log) => {
    const bateStatus = filtroStatus === 'all' || log.status === filtroStatus;
    return bateStatus;
  });

  return (
    <ProtectedRoute>
      <Layout titulo={`Jornada: ${campanha.nome}`}>
        <div className="space-y-6">
          
          {/* Header e Ações */}
          <div className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <button
              onClick={() => router.push('/comunicacao-oficial/campanhas')}
              className="text-gray-500 hover:text-teal-600 font-bold flex items-center gap-1 text-xs"
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Voltar para Campanhas
            </button>
            <span className="bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200 px-3 py-1 rounded-full uppercase tracking-wider">
              {campanha.status}
            </span>
          </div>

          {/* Resumo executivo e Barra de Progresso do motor */}
          <AcompanhamentoExecucao
            progresso={{
              total: campanha.total_destinatarios,
              enviados: campanha.enviadas,
              entregues: campanha.entregues,
              falhas: campanha.falhas,
              pendentes: campanha.total_destinatarios - (campanha.enviadas + campanha.falhas)
            }}
            statusCampanha={campanha.status}
          />

          {/* Painel de Filtros de Jornada */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FontAwesomeIcon icon={faFilter} className="text-teal-600 text-sm" />
              <h4 className="font-bold text-xs text-gray-800">Filtros da Jornada</h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="lida">Lida</option>
                  <option value="entregue">Entregue</option>
                  <option value="enviada">Enviada</option>
                  <option value="falhou">Falhou</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Canal</label>
                <select
                  value={filtroCanal}
                  onChange={(e) => setFiltroCanal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="whatsapp">WhatsApp Business Cloud</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Período</label>
                <select
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="all">Hoje</option>
                  <option value="last_7">Últimos 7 dias</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Público</label>
                <select
                  value={filtroPublico}
                  onChange={(e) => setFiltroPublico(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="all">Todos os destinatários</option>
                </select>
              </div>
            </div>
          </div>

          {/* Exibição em duas colunas: Gráficos de Evolução de Status e Log de Webhooks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Funil de Resultados da Campanha */}
            <FunilResultadosCampanha
              funil={{
                enviadas: campanha.enviadas,
                entregues: campanha.entregues,
                lidas: campanha.lidas
              }}
              resultados={RESULTADOS_MOCK}
            />

            {/* Linha do Tempo e Log Cronológico Completo */}
            <LinhaTempoJornada eventosFila={filtrarLogs} />

          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
