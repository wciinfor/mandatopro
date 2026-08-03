import { useState } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveMapaCalor } from '@/hooks/useLiveMapaCalor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkedAlt, 
  faChartLine, 
  faExclamationTriangle, 
  faTrophy,
  faBuilding,
  faUserTie,
  faClock,
  faTimesCircle,
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';

export default function MapaWidget() {
  const [tabRanking, setTabRanking] = useState('ELEITORES'); // 'ELEITORES' | 'CRESCIMENTO' | 'ESTAGNADOS'
  const [municipioSelecionado, setMunicipioSelecionado] = useState(null);

  const { 
    metricasTerritoriais, 
    municipios, 
    top10Eleitores, 
    top10Crescimento, 
    top10Estagnados, 
    loading, 
    error, 
    empty, 
    ultimaAtualizacao, 
    refetch 
  } = useLiveMapaCalor({ pollingIntervalMs: 15000 });

  const formatarData = (isoString) => {
    if (!isoString) return 'Sem registro';
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const renderClassificacaoBadge = (classificacao) => {
    switch (classificacao) {
      case 'CRESCIMENTO':
        return <span className="text-emerald-400 font-bold">🟢 Crescimento</span>;
      case 'ESTAVEL':
        return <span className="text-amber-400 font-bold">🟡 Estável</span>;
      case 'SEM_MOVIMENTACAO':
      default:
        return <span className="text-rose-400 font-bold">🔴 Sem movimentação</span>;
    }
  };

  // Determina lista ativa no ranking lateral
  const rankingExibido = 
    tabRanking === 'ELEITORES' 
      ? top10Eleitores 
      : tabRanking === 'CRESCIMENTO' 
      ? top10Crescimento 
      : top10Estagnados;

  return (
    <LiveWidget
      titulo="Mapa de Calor da Base Eleitoral"
      subtitulo="Distribuição territorial, densidade e presença nos municípios"
      icone={faMapMarkedAlt}
      badgeTag="Geolocalização"
      corBadge="emerald"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhum dado geográfico encontrado para os municípios."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
    >
      <div className="flex flex-col h-full gap-3">
        
        {/* Faixa Superior: Indicadores Territoriais */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block">Municípios Atendidos</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {metricasTerritoriais?.municipiosComPresenca || 0} / {metricasTerritoriais?.totalMunicipiosPA || 144}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-lg font-bold">
              <FontAwesomeIcon icon={faBuilding} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block">Cobertura Territorial</span>
              <span className="text-2xl font-black text-teal-300 font-mono">
                {metricasTerritoriais?.coberturaTerritorialPercent || 0}%
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center justify-center text-lg font-bold">
              <FontAwesomeIcon icon={faMapMarkedAlt} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block">Sem Liderança</span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {metricasTerritoriais?.municipiosSemLideranca || 0}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center text-lg font-bold">
              <FontAwesomeIcon icon={faUserTie} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider block">Sem Movimento (30d)</span>
              <span className="text-2xl font-black text-rose-400 font-mono">
                {metricasTerritoriais?.municipiosSemMovimentacao30Dias || 0}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center text-lg font-bold">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
          </div>
        </div>

        {/* Área Principal: Mapa do Pará (60%) vs Rankings & Painel Detalhado (40%) */}
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          
          {/* Lado Esquerdo: Área do Mapa de Calor (GeoJSON SVG do Estado do Pará) */}
          <div className="col-span-7 bg-slate-950/50 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-emerald-400" />
                Mapa do Estado do Pará (Heatmap)
              </span>
              <span className="text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                GeoJSON SVG Ready
              </span>
            </div>

            {/* Representação SVG do Mapa de Calor Pronta para Renderizar Polígonos do Pará */}
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-lg bg-slate-900/60 p-4 relative">
              <div className="w-full h-full flex flex-col items-center justify-center text-center">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-emerald-500/30 text-7xl mb-3" />
                <h4 className="text-slate-200 font-bold text-base">Visualização Territorial de Densidade</h4>
                <p className="text-slate-400 text-xs mt-1 max-w-sm">
                  Intensidade de cor ajustada proporcionalmente pelo volume de eleitores por município.
                </p>

                {/* Legenda do Heatmap */}
                <div className="flex items-center gap-4 mt-6 bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 font-semibold">Densidade:</span>
                  <span className="flex items-center gap-1 text-slate-300"><span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-800"></span> Baixa</span>
                  <span className="flex items-center gap-1 text-slate-300"><span className="w-3 h-3 rounded bg-emerald-600"></span> Média</span>
                  <span className="flex items-center gap-1 text-teal-300 font-bold"><span className="w-3 h-3 rounded bg-emerald-400 animate-pulse"></span> Alta</span>
                </div>
              </div>
            </div>

            {/* Painel Detalhado Modal de Município Selecionado (Arquitetura Pronta) */}
            {municipioSelecionado && (
              <div className="absolute inset-0 bg-slate-950/95 border border-emerald-500/40 p-4 rounded-xl flex flex-col justify-between backdrop-blur z-20">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <h3 className="text-lg font-black text-emerald-400">{municipioSelecionado.nome}</h3>
                    <p className="text-xs text-slate-400">Código IBGE: {municipioSelecionado.id_ibge || 'N/D'}</p>
                  </div>
                  <button 
                    onClick={() => setMunicipioSelecionado(null)}
                    className="text-slate-400 hover:text-white text-sm bg-slate-800 px-3 py-1 rounded-lg"
                  >
                    Fechar ✖
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 my-2 text-center">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Eleitores</span>
                    <span className="text-xl font-bold text-white font-mono">{municipioSelecionado.totalEleitores}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Cadastros Mês</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">+{municipioSelecionado.cadastrosMes}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Lideranças</span>
                    <span className="text-xl font-bold text-amber-400 font-mono">{municipioSelecionado.liderancasCount}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800 pt-2">
                  <span>Classificação: {renderClassificacaoBadge(municipioSelecionado.classificacao)}</span>
                  <span>Último Cadastro: <strong>{formatarData(municipioSelecionado.ultimoCadastro)}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Lado Direito: Rankings Top 10 & Seleção de Abas (5 Colunas) */}
          <div className="col-span-5 bg-slate-950/50 border border-slate-800/90 rounded-xl p-3 flex flex-col min-h-0">
            {/* Seletor de Abas de Ranking */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTabRanking('ELEITORES')}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
                    tabRanking === 'ELEITORES'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Top 10 Base
                </button>
                <button
                  onClick={() => setTabRanking('CRESCIMENTO')}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
                    tabRanking === 'CRESCIMENTO'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Cresceram
                </button>
                <button
                  onClick={() => setTabRanking('ESTAGNADOS')}
                  className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
                    tabRanking === 'ESTAGNADOS'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Estagnados
                </button>
              </div>
            </div>

            {/* Lista dos Rankings de Municípios */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {rankingExibido.map((m, idx) => (
                <div
                  key={m.key}
                  onClick={() => setMunicipioSelecionado(m)}
                  className="bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/40 p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-100 block">
                        {m.nome}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {m.liderancasCount} líderes • {renderClassificacaoBadge(m.classificacao)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-black text-emerald-400 font-mono block">
                      {m.totalEleitores}
                    </span>
                    {m.cadastrosMes > 0 && (
                      <span className="text-[10px] text-teal-300 font-semibold">
                        +{m.cadastrosMes} mês
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
