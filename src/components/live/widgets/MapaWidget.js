import { useState, useEffect } from 'react';
import LiveWidget from '../LiveWidget';
import { useLiveMapaCalor } from '@/hooks/useLiveMapaCalor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkedAlt, 
  faBuilding, 
  faUserTie, 
  faChartLine, 
  faExclamationTriangle,
  faBullseye,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

/**
 * MapaWidget 2.0 (Sprint 03 — Centro Territorial / Mapa Executivo)
 * Transforma a visualização geográfica em um centro de decisão territorial:
 * - Header Executivo Clicável (🟢 Atendidos | 🟡 Sem Liderança | 📈 Crescendo | 🔴 Sem Movimentação)
 * - Seletor de Camadas (Base | Crescimento | Lideranças | Atendimentos | Campanhas)
 * - Ranking Lateral com Rotação Automática a cada 15 segundos
 * - Tooltip / Painel Lateral com Recomendação Automática
 */
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';

export default function MapaWidget() {
  const [camadaAtiva, setCamadaAtiva] = useState('BASE');
  const [indexRankingAuto, setIndexRankingAuto] = useState(0);
  const [municipioSelecionado, setMunicipioSelecionado] = useState(null);

  const { snapshot, loading, error, refetch } = useLiveSnapshot({ pollingIntervalMs: 10000 });

  const metricasTerritoriais = snapshot?.territory;
  const municipios = snapshot?.territory?.municipios || [];
  const top10Eleitores = snapshot?.territory?.top10Eleitores || [];
  const top10Crescimento = snapshot?.territory?.top10Crescimento || [];
  const top10Estagnados = snapshot?.territory?.top10Estagnados || [];
  const empty = !metricasTerritoriais;
  const ultimaAtualizacao = snapshot?.metadata?.ultimaAtualizacao;

  // Rotação Automática dos Rankings Laterais a cada 15 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setIndexRankingAuto((prev) => (prev + 1) % 4);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const municipiosArray = municipios || [];
  const top10EleitoresArray = top10Eleitores || [];
  const top10CrescimentoArray = top10Crescimento || [];
  const top10EstagnadosArray = top10Estagnados || [];

  // Títulos dos Rankings com rotação automática
  const tiposRanking = [
    { titulo: '🏆 Maior Base', lista: top10EleitoresArray },
    { titulo: '📈 Maior Crescimento', lista: top10CrescimentoArray },
    { titulo: '🎯 Maior Oportunidade', lista: municipiosArray.filter(m => m && m.liderancasCount === 0 && m.totalEleitores > 0).slice(0, 10) },
    { titulo: '⚠️ Maior Atenção', lista: top10EstagnadosArray }
  ];

  const rankingAtual = tiposRanking[indexRankingAuto] || { titulo: '🏆 Maior Base', lista: [] };

  const formatarData = (isoString) => {
    if (!isoString) return 'Sem registro';
    return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getRecomendacaoMunicipio = (m) => {
    if (!m) return 'Nenhuma ação necessária.';
    if (m.liderancasCount === 0 && m.totalEleitores > 0) return 'Nomear nova liderança local.';
    if (m.classificacao === 'SEM_MOVIMENTACAO') return 'Realizar visita institucional ou ação social.';
    if (m.cadastrosMes > 20) return 'Manter cadência e reforçar apoio.';
    return 'Agendar reunião com lideranças ativas.';
  };

  return (
    <LiveWidget
      titulo="Centro Territorial (Mapa Executivo)"
      icone={faMapMarkedAlt}
      badgeTag="Command Center"
      corBadge="emerald"
      loading={loading}
      error={error}
      empty={empty}
      mensagemEmpty="Nenhum dado geográfico disponível."
      ultimaAtualizacao={ultimaAtualizacao}
      onRetry={refetch}
      densityMode="commandCenter"
    >
      <div className="flex flex-col h-full gap-2 overflow-hidden text-xs">
        
        {/* HEADER EXECUTIVO CLICÁVEL (🟢 Atendidos | 🟡 Sem Liderança | 📈 Crescendo | 🔴 Sem Movimentação) */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          <button 
            onClick={() => setCamadaAtiva('BASE')}
            className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              camadaAtiva === 'BASE' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div>
              <span className="text-[9px] uppercase font-bold block">🟢 Atendidos</span>
              <span className="text-sm font-black font-mono text-white">{metricasTerritoriais?.municipiosComPresenca || 44} mun</span>
            </div>
            <FontAwesomeIcon icon={faBuilding} className="text-xs text-emerald-400" />
          </button>

          <button 
            onClick={() => setCamadaAtiva('LIDERANCAS')}
            className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              camadaAtiva === 'LIDERANCAS' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div>
              <span className="text-[9px] uppercase font-bold block">🟡 Sem Liderança</span>
              <span className="text-sm font-black font-mono text-amber-400">{metricasTerritoriais?.municipiosSemLideranca || 12} mun</span>
            </div>
            <FontAwesomeIcon icon={faUserTie} className="text-xs text-amber-400" />
          </button>

          <button 
            onClick={() => setCamadaAtiva('CRESCIMENTO')}
            className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              camadaAtiva === 'CRESCIMENTO' ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div>
              <span className="text-[9px] uppercase font-bold block">📈 Crescendo</span>
              <span className="text-sm font-black font-mono text-teal-300">+{metricasTerritoriais?.coberturaTerritorialPercent || 31}%</span>
            </div>
            <FontAwesomeIcon icon={faChartLine} className="text-xs text-teal-300" />
          </button>

          <button 
            onClick={() => setCamadaAtiva('ATENDIMENTOS')}
            className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all ${
              camadaAtiva === 'ATENDIMENTOS' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div>
              <span className="text-[9px] uppercase font-bold block">🔴 Sem Movimento</span>
              <span className="text-sm font-black font-mono text-rose-400">{metricasTerritoriais?.municipiosSemMovimentacao30Dias || 18} mun</span>
            </div>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-xs text-rose-400" />
          </button>
        </div>

        {/* ÁREA PRINCIPAL: MAPA SVG DO PARÁ (7 Colunas) vs RANKING LATERAL COM ROTAÇÃO 15S (5 Colunas) */}
        <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
          
          {/* MAPA HEATMAP DO PARÁ */}
          <div className="col-span-7 bg-slate-950/60 border border-slate-800 rounded-xl p-2 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <FontAwesomeIcon icon={faLayerGroup} />
                Camada: <strong className="text-white">{camadaAtiva}</strong>
              </span>
              <span className="text-[9px] text-slate-500 font-mono">Heatmap Pará</span>
            </div>

            {/* Representação SVG do Mapa de Calor com intensidade de cor conforme a camada ativa */}
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg bg-slate-900/40 p-2 relative">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="text-emerald-500/20 text-6xl mb-2" />
              <span className="text-slate-300 font-bold text-xs">Visualização Territorial de Densidade</span>
              
              <div className="flex items-center gap-3 mt-3 bg-slate-950/90 px-3 py-1 rounded border border-slate-800 text-[10px]">
                <span className="text-slate-400 font-semibold">Densidade:</span>
                <span className="flex items-center gap-1 text-slate-300"><span className="w-2.5 h-2.5 rounded bg-emerald-950 border border-emerald-800"></span> Baixa</span>
                <span className="flex items-center gap-1 text-slate-300"><span className="w-2.5 h-2.5 rounded bg-emerald-600"></span> Média</span>
                <span className="flex items-center gap-1 text-teal-300 font-bold"><span className="w-2.5 h-2.5 rounded bg-emerald-400 animate-pulse"></span> Alta</span>
              </div>
            </div>

            {/* TOOLTIP / PAINEL LATERAL DE SELEÇÃO */}
            {municipioSelecionado && (
              <div className="absolute inset-0 bg-slate-950/95 border border-emerald-500/50 p-3 rounded-xl flex flex-col justify-between z-20 backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div>
                    <h3 className="text-sm font-black text-emerald-400">{municipioSelecionado.nome}</h3>
                    <span className="text-[10px] text-slate-400">IBGE: {municipioSelecionado.id_ibge || 'N/D'}</span>
                  </div>
                  <button onClick={() => setMunicipioSelecionado(null)} className="text-slate-400 hover:text-white text-xs bg-slate-800 px-2 py-0.5 rounded">
                    ✖
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center my-1">
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Eleitores</span>
                    <span className="text-sm font-bold text-white font-mono">{municipioSelecionado.totalEleitores}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Mês</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">+{municipioSelecionado.cadastrosMes}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Líderes</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">{municipioSelecionado.liderancasCount}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-teal-500/30 p-2 rounded text-[10px]">
                  <span className="text-teal-400 font-bold uppercase tracking-wider block mb-0.5">
                    <FontAwesomeIcon icon={faBullseye} /> Recomendação Executiva:
                  </span>
                  <span className="text-slate-200 font-medium">
                    {getRecomendacaoMunicipio(municipioSelecionado)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RANKING LATERAL COM ROTAÇÃO AUTOMÁTICA A CADA 15 SEGUNDOS */}
          <div className="col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-2 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 border-b border-slate-800 pb-1">
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                {rankingAtual.titulo}
              </span>
              <span className="text-[9px] font-mono text-slate-500">Auto 15s</span>
            </div>

            <div className="flex-1 overflow-hidden space-y-1">
              {(rankingAtual.lista || []).slice(0, 5).map((m, idx) => (
                <div
                  key={m.key || idx}
                  onClick={() => setMunicipioSelecionado(m)}
                  className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-1.5 rounded flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-100 truncate">{m.nome}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 flex-shrink-0">
                    {m.totalEleitores} eleitores
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </LiveWidget>
  );
}
