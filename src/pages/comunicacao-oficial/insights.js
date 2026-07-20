import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faInbox, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { InsightCard } from '@/components/InsightCard';
import { InsightsComunicacaoService } from '@/services/insightsComunicacaoService';

// Dados locais simulados para rodar a análise offline no serviço
const DADOS_ANALISE_MOCK = {
  campanhas: [
    { id: '1', nome: 'Informativo Obras Verão', total_destinatarios: 450, entregues: 380 } // Entrega baixa (84%)
  ],
  templates: [
    { nome: 'convite_gabinete_bairro', taxaLeitura: 84.5 } // Melhor taxa
  ],
  operadores: [
    { id: '1', nome: 'Fernanda Costa', minutosResposta: 18 } // Tempo alto (>15m)
  ]
};

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [analisando, setAnalisando] = useState(false);

  const executarAnalise = () => {
    setAnalisando(true);
    setTimeout(() => {
      const resultados = InsightsComunicacaoService.gerarInsightsLocais(DADOS_ANALISE_MOCK);
      setInsights(resultados);
      setAnalisando(false);
    }, 1000);
  };

  useEffect(() => {
    executarAnalise();
  }, []);

  return (
    <ProtectedRoute>
      <Layout titulo="Insights & Recomendações Automáticas">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Insights do Canal</h3>
              <p className="text-sm text-gray-500 mt-1">
                Recomendações e análises inteligentes baseadas no tráfego local, taxas de engajamento e atendimento.
              </p>
            </div>
            <div>
              <button
                onClick={executarAnalise}
                disabled={analisando}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faRefresh} className={analisando ? 'animate-spin' : ''} />
                Recalcular Análise
              </button>
            </div>
          </div>

          {/* Lista de Insights */}
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((ins) => (
                <InsightCard key={ins.id} insight={ins} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
              <p className="text-sm">Nenhum insight gerado. Clique em Recalcular.</p>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
