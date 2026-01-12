import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faUser, faIdCard, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function BuscaEleitor({ onSelecionarEleitor, eleitorSelecionado }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Simular banco de dados de eleitores
  // TODO: Substituir por chamada à API/Supabase
  const eleitoresCadastrados = [
    {
      id: 1,
      nome: 'JOÃO DA SILVA SANTOS',
      cpf: '123.456.789-00',
      tituloEleitoral: '1234567890123',
      rg: '12.345.678-9',
      orgaoEmissor: 'SSP/SP',
      dataNascimento: '1985-05-15',
      sexo: 'MASCULINO',
      nomeMae: 'MARIA DA SILVA',
      nomePai: 'JOSÉ SANTOS',
      telefone: '(11) 3333-3333',
      celular: '(11) 98888-8888',
      email: 'joao.silva@email.com',
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Apto 101',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      situacaoTSE: 'ATIVO',
      status: 'ATIVO'
    },
    {
      id: 2,
      nome: 'MARIA OLIVEIRA SANTOS',
      cpf: '987.654.321-00',
      tituloEleitoral: '9876543210987',
      rg: '98.765.432-1',
      orgaoEmissor: 'SSP/SP',
      dataNascimento: '1990-08-20',
      sexo: 'FEMININO',
      nomeMae: 'ANA OLIVEIRA',
      nomePai: 'CARLOS SANTOS',
      telefone: '(11) 2222-2222',
      celular: '(11) 97777-7777',
      email: 'maria.oliveira@email.com',
      cep: '04567-890',
      logradouro: 'Rua das Flores',
      numero: '500',
      complemento: '',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
      uf: 'SP',
      situacaoTSE: 'ATIVO',
      status: 'ATIVO'
    },
    {
      id: 3,
      nome: 'PEDRO HENRIQUE COSTA',
      cpf: '456.789.123-00',
      tituloEleitoral: '4567891230456',
      rg: '45.678.912-3',
      orgaoEmissor: 'SSP/RJ',
      dataNascimento: '1978-12-10',
      sexo: 'MASCULINO',
      nomeMae: 'HELENA COSTA',
      nomePai: 'ROBERTO COSTA',
      telefone: '(21) 3333-4444',
      celular: '(21) 99999-8888',
      email: 'pedro.costa@email.com',
      cep: '20040-020',
      logradouro: 'Avenida Rio Branco',
      numero: '123',
      complemento: 'Sala 5',
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      situacaoTSE: 'ATIVO',
      status: 'ATIVO'
    },
    {
      id: 4,
      nome: 'ANA PAULA FERREIRA',
      cpf: '321.654.987-00',
      tituloEleitoral: '3216549870321',
      rg: '32.165.498-7',
      orgaoEmissor: 'SSP/MG',
      dataNascimento: '1995-03-25',
      sexo: 'FEMININO',
      nomeMae: 'LUCIA FERREIRA',
      nomePai: 'MARCOS FERREIRA',
      telefone: '(31) 3555-6666',
      celular: '(31) 98888-7777',
      email: 'ana.ferreira@email.com',
      cep: '30130-100',
      logradouro: 'Avenida Afonso Pena',
      numero: '789',
      complemento: 'Apto 202',
      bairro: 'Centro',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      situacaoTSE: 'ATIVO',
      status: 'ATIVO'
    }
  ];

  const buscarEleitor = (termo) => {
    setBusca(termo);
    
    if (termo.length < 3) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    // Buscar por nome ou CPF
    const termoLower = termo.toLowerCase();
    const encontrados = eleitoresCadastrados.filter(eleitor => 
      eleitor.nome.toLowerCase().includes(termoLower) ||
      eleitor.cpf.includes(termo)
    );

    setResultados(encontrados);
    setMostrarResultados(true);
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
                className="w-full px-4 py-3 pl-10 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o nome ou CPF do eleitor..."
              />
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
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
                        <span>
                          <FontAwesomeIcon icon={faUser} className="mr-1 text-blue-600" />
                          Título: {eleitor.tituloEleitoral}
                        </span>
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

          {mostrarResultados && resultados.length === 0 && (
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
                  <div>
                    <FontAwesomeIcon icon={faUser} className="mr-2 text-blue-600" />
                    <strong>Título:</strong> {eleitorSelecionado.tituloEleitoral}
                  </div>
                  <div className="md:col-span-2">
                    <strong>Endereço:</strong> {eleitorSelecionado.logradouro}, {eleitorSelecionado.numero} - {eleitorSelecionado.bairro}, {eleitorSelecionado.cidade}/{eleitorSelecionado.uf}
                  </div>
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
