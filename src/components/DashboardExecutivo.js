import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faPaperPlane,
  faCheckCircle,
  faEye,
  faTimesCircle,
  faPercentage,
  faClock,
  faInbox,
  faUserClock,
  faUserTie
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';

// Mock de dados consolidados locais para o Dashboard Executivo
const DASHBOARD_KPES = {
  campanhasAtivas: 3,
  mensagensEnviadasHoje: 1450,
  entregues: 1420,
  lidas: 1100,
  falhas: 30,
  taxaEntrega: 97.9,
  taxaLeitura: 77.4,
  tempoMedioResposta: '4m 32s',
  conversasAbertas: 24,
  conversasAguardando: 5
};

const CHART_DIARIO_ENVIO = [
  { dia: 'Seg', total: 400 },
  { dia: 'Ter', total: 800 },
  { dia: 'Qua', total: 1200 },
  { dia: 'Qui', total: 1100 },
  { dia: 'Sex', total: 1450 }
];

const CANAL_STATS = [
  { canal: 'WhatsApp Business', total: 1100, icon: faWhatsapp, bg: 'bg-emerald-500' },
  { canal: 'WhatsApp Legacy', total: 250, icon: faWhatsapp, bg: 'bg-teal-600' },
  { canal: 'Instagram Direct', total: 100, icon: faInstagram, bg: 'bg-pink-600' }
];

const RANKING_CAMPANHAS = [
  { id: '1', nome: 'Informativo Obras Verão', taxa: 98.2, total: 450 },
  { id: '2', nome: 'Gabinete Itinerante - Convite', taxa: 96.5, total: 1200 }
];

const RANKING_OPERADORES = [
  { id: '1', nome: 'Rodrigo Lima', atendimentos: 45, tempo: '3m 15s' },
  { id: '2', nome: 'Fernanda Costa', atendimentos: 38, tempo: '5m 02s' }
];

export default function DashboardExecutivo() {
  return (
    <div className="space-y-6">
      
      {/* Grid de KPIs - Indicadores Operacionais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Campanhas Ativas</p>
            <p className="text-base font-bold text-gray-800">{DASHBOARD_KPES.campanhasAtivas}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Enviadas Hoje</p>
            <p className="text-base font-bold text-gray-800">{DASHBOARD_KPES.mensagensEnviadasHoje}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-green-50 text-green-600 rounded-xl">
            <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Entregues</p>
            <p className="text-base font-bold text-green-700">{DASHBOARD_KPES.entregues}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FontAwesomeIcon icon={faEye} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Lidas</p>
            <p className="text-base font-bold text-emerald-700">{DASHBOARD_KPES.lidas}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 text-xs">
          <span className="p-3 bg-red-50 text-red-600 rounded-xl">
            <FontAwesomeIcon icon={faTimesCircle} className="text-sm" />
          </span>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Falhas</p>
            <p className="text-base font-bold text-red-600">{DASHBOARD_KPES.falhas}</p>
          </div>
        </div>

      </div>

      {/* Grid de Taxas e Tempos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-teal-800 uppercase">Taxa de Entrega</p>
          <p className="text-2xl font-bold text-teal-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faPercentage} className="text-sm" /> {DASHBOARD_KPES.taxaEntrega}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/20 border border-blue-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-blue-800 uppercase">Taxa de Leitura</p>
          <p className="text-2xl font-bold text-blue-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faPercentage} className="text-sm" /> {DASHBOARD_KPES.taxaLeitura}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50/60 to-yellow-50/20 border border-amber-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-amber-800 uppercase">Tempo de Resposta</p>
          <p className="text-2xl font-bold text-amber-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faClock} className="text-sm" /> {DASHBOARD_KPES.tempoMedioResposta}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50/60 to-purple-100/20 border border-purple-100 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-[10px] font-bold text-purple-800 uppercase">Aguardando Atend.</p>
          <p className="text-2xl font-bold text-purple-900 mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={faUserClock} className="text-sm" /> {DASHBOARD_KPES.conversasAguardando} / {DASHBOARD_KPES.conversasAbertas}
          </p>
        </div>
      </div>

      {/* Gráficos e Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico Diário de Envios */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-gray-800">Volumetria Diária de Envios</h4>
          <div className="h-48 flex items-end gap-3 justify-between pt-6 border-b border-gray-100 px-2">
            {CHART_DIARIO_ENVIO.map((item, idx) => {
              const max = 1500;
              const heightPct = Math.round((item.total / max) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[9px] font-bold text-teal-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.total}
                  </span>
                  <div
                    className="w-full bg-teal-600/80 hover:bg-teal-600 rounded-t-lg transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] font-medium text-gray-500">{item.dia}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico por Canal */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <h4 className="font-bold text-sm text-gray-800">Distribuição por Canal</h4>
          <div className="space-y-3.5">
            {CANAL_STATS.map((c, idx) => {
              const totalGeral = CANAL_STATS.reduce((acc, curr) => acc + curr.total, 0);
              const pct = totalGeral > 0 ? Math.round((c.total / totalGeral) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <FontAwesomeIcon icon={c.icon} className="text-gray-400" />
                      {c.canal}
                    </span>
                    <span className="font-bold">{c.total} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${c.bg} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ranking de Campanhas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-gray-800">Ranking de Campanhas Eficientes</h4>
          <div className="divide-y divide-gray-100 text-xs">
            {RANKING_CAMPANHAS.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{c.nome}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Envios: {c.total}</p>
                </div>
                <span className="bg-green-50 text-green-700 font-bold border border-green-200 px-2.5 py-1 rounded-lg">
                  {c.taxa}% sucesso
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking de Operadores */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-gray-800">Desempenho da Equipe (Operadores)</h4>
          <div className="divide-y divide-gray-100 text-xs">
            {RANKING_OPERADORES.map((op) => (
              <div key={op.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px]">
                    {op.nome.charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-800">{op.nome}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Atendimentos: {op.atendimentos}</p>
                  </div>
                </div>
                <span className="text-gray-500 font-semibold flex items-center gap-1">
                  <FontAwesomeIcon icon={faClock} className="text-teal-600 text-[10px]" /> {op.tempo}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
