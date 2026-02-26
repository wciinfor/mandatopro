import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function BuscaCampanha({ onSelecionarCampanha, campanhaSelecionada }) {
  const [campanhas, setCampanhas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Carregar campanhas ativas ao montar
  useEffect(() => {
    carregarCampanhas();
  }, []);

  const carregarCampanhas = async () => {
    try {
      setCarregando(true);
      const response = await fetch('/api/cadastros/campanhas/ativas');
      const data = await response.json();
      setCampanhas(data || []);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      setCampanhas([]);
    } finally {
      setCarregando(false);
    }
  };

  const selecionarCampanha = (campanha) => {
    onSelecionarCampanha(campanha);
  };

  const selecionarAvulso = () => {
    onSelecionarCampanha({
      id: 'AVULSO',
      nome: 'ATENDIMENTO AVULSO',
      descricao: 'Atendimento não vinculado a nenhuma campanha',
      campanhas_servicos: [], // Sem serviços da campanha
      campanhas_liderancas: [] // Sem lideranças da campanha
    });
  };

  const limparSelecao = () => {
    onSelecionarCampanha(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-l-4 border-purple-600 shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faSearch} className="text-purple-600" />
          SELECIONAR CAMPANHA
        </h3>

      {!campanhaSelecionada ? (
        <div className="space-y-3">
          {carregando ? (
            <div className="text-center py-6">
              <p className="text-gray-600 text-base">Carregando campanhas...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                {campanhas.map((campanha) => (
                  <button
                    key={campanha.id}
                    type="button"
                    onClick={() => selecionarCampanha(campanha)}
                    className="p-3 border-2 border-purple-300 rounded-lg hover:bg-purple-100 hover:border-purple-500 text-left transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="font-bold text-gray-800 text-base">{campanha.nome}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      📍 {campanha.local || '-'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      📅 {new Date(campanha.data_campanha).toLocaleDateString('pt-BR')}
                    </div>
                  </button>
                ))}
              </div>

              {/* Atendimento Avulso */}
              <div className="pt-4 border-t-2 border-purple-200">
                <button
                  type="button"
                  onClick={selecionarAvulso}
                  className="w-full p-3 border-2 border-dashed border-orange-400 rounded-lg hover:bg-orange-50 hover:border-orange-500 transition-all duration-200 font-semibold text-gray-800 text-base"
                >
                  ➕ ATENDIMENTO AVULSO (Sem Campanha)
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border-2 border-green-400 rounded-lg p-4 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                {campanhaSelecionada.nome.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 text-lg" />
                  <span className="font-bold text-lg text-gray-800">
                    {campanhaSelecionada.nome}
                  </span>
                </div>
                {campanhaSelecionada.id !== 'AVULSO' && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>📍 {campanhaSelecionada.local || '-'}</div>
                    <div>📅 {new Date(campanhaSelecionada.data_campanha).toLocaleDateString('pt-BR')}</div>
                    <div>
                      Líderes: <span className="font-semibold text-purple-600">{campanhaSelecionada.campanhas_liderancas?.length || 0}</span> | 
                      Serviços: <span className="font-semibold text-purple-600">{campanhaSelecionada.campanhas_servicos?.length || 0}</span>
                    </div>
                  </div>
                )}
                {campanhaSelecionada.id === 'AVULSO' && (
                  <div className="text-sm text-orange-600 font-semibold">
                    ℹ️ Atendimento sem vínculo a campanha específica
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={limparSelecao}
              className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-2 font-semibold flex-shrink-0"
            >
              <FontAwesomeIcon icon={faTimes} />
              Limpar
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
