import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function BuscaLideranca({ onSelecionarLideranca, liderancaSelecionada, label = 'BUSCAR LIDERANÇA' }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const buscarLideranca = async (termo) => {
    setBusca(termo);
    
    if (termo.length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`/api/atendimentos/liderancas?q=${encodeURIComponent(termo)}`);
      const data = await response.json();
      setResultados(data || []);
      setMostrarResultados(true);
    } catch (error) {
      console.error('Erro ao buscar lideranças:', error);
      setResultados([]);
      setMostrarResultados(true);
    } finally {
      setCarregando(false);
    }
  };

  const selecionarLideranca = (lideranca) => {
    onSelecionarLideranca(lideranca);
    setBusca('');
    setResultados([]);
    setMostrarResultados(false);
  };

  const limparSelecao = () => {
    onSelecionarLideranca(null);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label} <span className="text-red-600">*</span>
      </label>

      {!liderancaSelecionada ? (
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={busca}
              onChange={(e) => buscarLideranca(e.target.value)}
              disabled={carregando}
              className="w-full px-4 py-2 pl-10 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder="Digite o nome da liderança..."
            />
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            {carregando && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin">
                  <FontAwesomeIcon icon={faSearch} className="text-green-500" />
                </div>
              </div>
            )}
          </div>

          {/* Resultados da Busca */}
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {resultados.map((lideranca) => (
                <button
                  key={lideranca.id}
                  type="button"
                  onClick={() => selecionarLideranca(lideranca)}
                  className="w-full p-3 hover:bg-green-50 border-b border-gray-200 text-left transition-colors"
                >
                  <div className="font-bold text-gray-800">{lideranca.nome}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="mr-4">📱 {lideranca.telefone || '-'}</span>
                    <span>🎯 {lideranca.influencia || '-'}</span>
                  </div>
                  {lideranca.area_atuacao && (
                    <div className="text-xs text-gray-500 mt-1">
                      Área: {lideranca.area_atuacao}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {mostrarResultados && resultados.length === 0 && !carregando && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-xl p-3 text-center text-gray-600 text-sm">
              <FontAwesomeIcon icon={faSearch} className="text-gray-400 mb-1" />
              <p>Nenhuma liderança encontrada</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1">
            Digite pelo menos 2 caracteres para buscar
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 mt-1" />
              <div>
                <div className="font-bold text-gray-800">{liderancaSelecionada.nome}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {liderancaSelecionada.telefone && <span>📱 {liderancaSelecionada.telefone}</span>}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={limparSelecao}
              className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faTimes} />
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
