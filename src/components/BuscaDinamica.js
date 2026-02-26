import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';

/**
 * Componente de busca dinâmica com autocomplete
 * @param {string} value - Valor atual do campo
 * @param {function} onChange - Callback quando o valor muda
 * @param {function} onSelect - Callback quando um item é selecionado (recebe o objeto inteiro)
 * @param {string} endpoint - Endpoint da API para buscar dados (ex: /api/cadastros/liderancas/buscar)
 * @param {string} placeholder - Texto do placeholder
 * @param {string} displayField - Campo do objeto a ser exibido (ex: 'nome')
 * @param {bool} required - Campo obrigatório
 * @param {string} className - Classes CSS adicionais
 */
export default function BuscaDinamica({
  value,
  onChange,
  onSelect,
  endpoint,
  placeholder = 'Buscar...',
  displayField = 'nome',
  required = false,
  className = '',
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [mostraSugestoes, setMostraSugestoes] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);

  // Buscar sugestões
  const buscarSugestoes = async (textoBusca) => {
    if (textoBusca.trim().length < 1) {
      setSugestoes([]);
      setMostraSugestoes(false);
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(textoBusca)}`);
      
      if (response.ok) {
        const dados = await response.json();
        setSugestoes(dados);
        setMostraSugestoes(true);
      } else {
        setSugestoes([]);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      setSugestoes([]);
    } finally {
      setCarregando(false);
    }
  };

  // Debounce na busca
  const handleInputChange = (e) => {
    const novoValor = e.target.value;
    onChange(novoValor);
    setSelecionado(null);

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Novo timeout para busca (aguarda usuário parar de digitar por 300ms)
    timeoutRef.current = setTimeout(() => {
      buscarSugestoes(novoValor);
    }, 300);
  };

  // Selecionar item da lista
  const handleSelecionarItem = (item) => {
    setSelecionado(item);
    onChange(item[displayField]);
    setMostraSugestoes(false);
    setSugestoes([]);
    
    // Chamar callback com objeto completo
    if (onSelect) {
      onSelect(item);
    }
  };

  // Limpar seleção
  const handleLimpar = () => {
    onChange('');
    setSelecionado(null);
    setSugestoes([]);
    setMostraSugestoes(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickFora = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setMostraSugestoes(false);
      }
    };

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const baseInputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent';

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <FontAwesomeIcon 
          icon={faSearch} 
          className="absolute left-3 text-gray-400 pointer-events-none" 
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value && sugestoes.length > 0 && setMostraSugestoes(true)}
          placeholder={placeholder}
          required={required}
          className={`${baseInputClass} pl-10 ${value && 'pr-10'}`}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleLimpar}
            className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
            title="Limpar"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>

      {/* Spinner de carregamento */}
      {carregando && (
        <div className="absolute right-10 top-1/2 transform -translate-y-1/2 text-teal-600">
          <div className="animate-spin">⟳</div>
        </div>
      )}

      {/* Lista de sugestões */}
      {mostraSugestoes && sugestoes.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {sugestoes.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => handleSelecionarItem(item)}
              className="w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-semibold text-gray-800">
                {item[displayField]}
              </div>
              {item.email && (
                <div className="text-xs text-gray-500">
                  {item.email}
                </div>
              )}
              {item.profissao && (
                <div className="text-xs text-gray-500">
                  {item.profissao}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Mensagem de nenhum resultado */}
      {mostraSugestoes && !carregando && value && sugestoes.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3 text-center text-gray-500">
          Nenhuma liderança encontrada
        </div>
      )}
    </div>
  );
}
