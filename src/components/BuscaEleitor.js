import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faUser, faIdCard, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function BuscaEleitor({ onSelecionarEleitor, eleitorSelecionado }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const buscarEleitor = async (termo) => {
    setBusca(termo);
    
    if (termo.length < 3) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`/api/cadastros/eleitores/buscar?q=${encodeURIComponent(termo)}`);
      const data = await response.json();
      setResultados(data || []);
      setMostrarResultados(true);
    } catch (error) {
      console.error('Erro ao buscar eleitores:', error);
      setResultados([]);
      setMostrarResultados(true);
    } finally {
      setCarregando(false);
    }
  };

  const selecionarEleitor = (eleitor) => {
    onSelecionarEleitor(eleitor);
    setBusca('');
    setResultados([]);
    setMostrarResultados(false);
  };

  const limparSelecao = () => {
    onSelecionarEleitor(null);
  };

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-600">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faSearch} className="text-blue-600" />
        BUSCAR ELEITOR CADASTRADO
      </h3>

      {!eleitorSelecionado ? (
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => buscarEleitor(e.target.value)}
                disabled={carregando}
                className="w-full px-4 py-3 pl-10 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Digite o nome ou CPF do eleitor..."
              />
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              {carregando && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin">
                    <FontAwesomeIcon icon={faSearch} className="text-blue-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resultados da Busca */}
          {mostrarResultados && resultados.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-300 rounded-lg shadow-xl max-h-96 overflow-y-auto">
              {resultados.map((eleitor) => (
                <button
                  key={eleitor.id}
                  type="button"
                  onClick={() => selecionarEleitor(eleitor)}
                  className="w-full p-4 hover:bg-blue-50 border-b border-gray-200 text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {eleitor.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">{eleitor.nome}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="mr-4">
                          <FontAwesomeIcon icon={faIdCard} className="mr-1 text-blue-600" />
                          CPF: {eleitor.cpf}
                        </span>
                        {eleitor.titulo_eleitoral && (
                          <span>
                            <FontAwesomeIcon icon={faUser} className="mr-1 text-blue-600" />
                            Título: {eleitor.titulo_eleitoral}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {eleitor.cidade}/{eleitor.uf} - {eleitor.bairro}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mostrarResultados && resultados.length === 0 && !carregando && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-300 rounded-lg shadow-xl p-4 text-center text-gray-600">
              <FontAwesomeIcon icon={faSearch} className="text-3xl text-gray-400 mb-2" />
              <p className="font-semibold">Nenhum eleitor encontrado</p>
              <p className="text-sm">Tente buscar por nome ou CPF</p>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-2">
            Digite pelo menos 3 caracteres para buscar
          </p>
        </div>
      ) : (
        <div className="bg-white border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                {eleitorSelecionado.nome.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                  <span className="font-bold text-lg text-gray-800">
                    ELEITOR SELECIONADO
                  </span>
                </div>
                <div className="font-bold text-xl text-gray-900 mb-2">
                  {eleitorSelecionado.nome}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>
                    <FontAwesomeIcon icon={faIdCard} className="mr-2 text-blue-600" />
                    <strong>CPF:</strong> {eleitorSelecionado.cpf}
                  </div>
                  {eleitorSelecionado.titulo_eleitoral && (
                    <div>
                      <FontAwesomeIcon icon={faUser} className="mr-2 text-blue-600" />
                      <strong>Título:</strong> {eleitorSelecionado.titulo_eleitoral}
                    </div>
                  )}
                  {eleitorSelecionado.logradouro && (
                    <div className="md:col-span-2">
                      <strong>Endereço:</strong> {eleitorSelecionado.logradouro}, {eleitorSelecionado.numero} - {eleitorSelecionado.bairro}, {eleitorSelecionado.cidade}/{eleitorSelecionado.uf}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={limparSelecao}
              className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
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
