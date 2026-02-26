import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faTimes, faArrowLeft, faSearch, faTrash, faPlus, faMapMarkerAlt, faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

export default function NovaCampanha() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning, showConfirm } = useModal();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    local: '',
    dataCampanha: '',
    horaInicio: '',
    horaFim: '',
    status: 'PLANEJAMENTO',
    observacoes: ''
  });

  const [liderancasBuscador, setLiderancasBuscador] = useState('');
  const [liderancasEncontradas, setLiderancasEncontradas] = useState([]);
  const [liderancasSelecionadas, setLiderancasSelecionadas] = useState([]);
  const [buscandoLiderancas, setBuscandoLiderancas] = useState(false);

  const [servicos, setServicos] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);
  const [novoServico, setNovoServico] = useState('');
  const [descricaoServico, setDescricaoServico] = useState('');

  const [loading, setLoading] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(!!id);

  // Carregar dados se estiver editando
  useEffect(() => {
    if (id) {
      carregarCampanha();
    }
    carregarServicos();
  }, [id]);

  // Buscar lideranças quando o texto do buscador muda
  useEffect(() => {
    if (liderancasBuscador.trim().length > 0) {
      buscarLiderancas();
    } else {
      setLiderancasEncontradas([]);
    }
  }, [liderancasBuscador]);

  const carregarCampanha = async () => {
    try {
      setCarregandoDados(true);
      const response = await fetch(`/api/cadastros/campanhas/${id}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar campanha');
      }

      const { data } = await response.json();
      
      setFormData({
        nome: data.nome || '',
        descricao: data.descricao || '',
        local: data.local || '',
        dataCampanha: data.data_campanha || '',
        horaInicio: data.hora_inicio || '',
        horaFim: data.hora_fim || '',
        status: data.status || 'PLANEJAMENTO',
        observacoes: data.observacoes || ''
      });

      // Carregar lideranças associadas
      if (data.campanhas_liderancas) {
        setLiderancasSelecionadas(data.campanhas_liderancas.map(cl => ({
          id: cl.lideranca_id,
          nome: cl.liderancas.nome,
          cpf: cl.liderancas.cpf,
          papel: cl.papel || 'APOIO'
        })));
      }

      // Carregar serviços associados
      if (data.campanhas_servicos) {
        setServicosSelecionados(data.campanhas_servicos.map(cs => ({
          id: cs.categoria_servico_id,
          nome: cs.categorias_servicos.nome,
          quantidade: cs.quantidade || 0
        })));
      }
    } catch (error) {
      showError('Erro ao carregar campanha: ' + error.message);
    } finally {
      setCarregandoDados(false);
    }
  };

  const carregarServicos = async () => {
    try {
      const response = await fetch('/api/cadastros/campanhas/servicos');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar serviços');
      }

      const { data } = await response.json();
      setServicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    }
  };

  const buscarLiderancas = async () => {
    try {
      setBuscandoLiderancas(true);
      const params = new URLSearchParams({
        search: liderancasBuscador,
        limit: 10
      });

      const response = await fetch(`/api/cadastros/campanhas/liderancas?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar lideranças');
      }

      const { data } = await response.json();
      
      // Filtrar lideranças já selecionadas
      const liderancasDisponiveis = data.filter(lid => 
        !liderancasSelecionadas.some(selecionada => selecionada.id === lid.id)
      );
      
      setLiderancasEncontradas(liderancasDisponiveis);
    } catch (error) {
      console.error('Erro ao buscar lideranças:', error);
    } finally {
      setBuscandoLiderancas(false);
    }
  };

  const adicionarLideranca = (lideranca) => {
    if (!liderancasSelecionadas.some(l => l.id === lideranca.id)) {
      setLiderancasSelecionadas([
        ...liderancasSelecionadas,
        { ...lideranca, papel: 'APOIO' }
      ]);
      setLiderancasBuscador('');
      setLiderancasEncontradas([]);
    }
  };

  const removerLideranca = (id) => {
    setLiderancasSelecionadas(liderancasSelecionadas.filter(l => l.id !== id));
  };

  const atualizarPapelLideranca = (id, papel) => {
    setLiderancasSelecionadas(liderancasSelecionadas.map(l => 
      l.id === id ? { ...l, papel } : l
    ));
  };

  const criarNovoServico = async () => {
    if (!novoServico.trim()) {
      showWarning('Nome do serviço é obrigatório');
      return;
    }

    try {
      const response = await fetch('/api/cadastros/campanhas/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoServico.trim(),
          descricao: descricaoServico.trim() || null
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        const mensagemErro = responseData.error || responseData.message || 'Erro ao criar serviço';
        throw new Error(mensagemErro);
      }

      const novaCategoria = responseData.data;
      
      // Adicionar ao estado
      setServicos([...servicos, novaCategoria]);
      setServicosSelecionados([
        ...servicosSelecionados,
        { id: novaCategoria.id, nome: novaCategoria.nome, quantidade: 0 }
      ]);

      setNovoServico('');
      setDescricaoServico('');
      showSuccess('Serviço criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar serviço:', error);
      showError('Erro ao criar serviço: ' + error.message);
    }
  };

  const adicionarServico = (servico) => {
    if (!servicosSelecionados.some(s => s.id === servico.id)) {
      setServicosSelecionados([
        ...servicosSelecionados,
        { id: servico.id, nome: servico.nome, quantidade: 0 }
      ]);
    }
  };

  const removerServico = (id) => {
    setServicosSelecionados(servicosSelecionados.filter(s => s.id !== id));
  };

  const atualizarQuantidadeServico = (id, quantidade) => {
    setServicosSelecionados(servicosSelecionados.map(s =>
      s.id === id ? { ...s, quantidade: parseInt(quantidade) || 0 } : s
    ));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (!formData.nome.trim()) {
      showWarning('Nome da campanha é obrigatório');
      return;
    }

    if (!formData.dataCampanha) {
      showWarning('Data da campanha é obrigatória');
      return;
    }

    if (!formData.local.trim()) {
      showWarning('Local da campanha é obrigatório');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        liderancos: liderancasSelecionadas,
        servicos: servicosSelecionados
      };

      const method = id ? 'PUT' : 'POST';
      const url = id 
        ? `/api/cadastros/campanhas/${id}`
        : '/api/cadastros/campanhas';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar campanha');
      }

      const { data: campanhaSalva } = await response.json();

      showSuccess(
        id ? 'Campanha atualizada com sucesso!' : 'Campanha criada com sucesso!',
        () => {
          router.push('/cadastros/campanhas');
        }
      );
    } catch (error) {
      showError('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (carregandoDados) {
    return (
      <Layout titulo="Carregando...">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout titulo={id ? "Editar Campanha" : "Nova Campanha"}>
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {/* Botão Voltar */}
      <button
        onClick={() => router.back()}
        className="mb-6 text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        Voltar para Campanhas
      </button>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faCalendarAlt} className="text-teal-600 text-xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Informações da Campanha</h2>
                  <p className="text-sm text-gray-600">Dados principais da campanha</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome da Campanha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Ex: Campanha de Saúde - Bairro Centro"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Descrição
                  </label>
                  <textarea
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Descreva os objetivos e detalhes da campanha..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Local */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2" />
                    Local <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="local"
                    value={formData.local}
                    onChange={handleInputChange}
                    placeholder="Ex: Praça Central, Bairro Centro"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>


              </div>
            </div>

            {/* Data e Horário */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Data e Horário</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data da Campanha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dataCampanha"
                    value={formData.dataCampanha}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hora Início
                  </label>
                  <input
                    type="time"
                    name="horaInicio"
                    value={formData.horaInicio}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hora Fim
                  </label>
                  <input
                    type="time"
                    name="horaFim"
                    value={formData.horaFim}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Lideranças Envolvidas */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🤝 Lideranças Envolvidas</h3>

              {/* Buscador de Lideranças */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Buscar Liderança
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={liderancasBuscador}
                    onChange={(e) => setLiderancasBuscador(e.target.value)}
                    placeholder="Digite nome ou CPF da liderança..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  
                  {/* Indicador de carregamento */}
                  {buscandoLiderancas && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}

                  {/* Mensagem se está buscando */}
                  {liderancasBuscador.trim().length > 0 && !buscandoLiderancas && liderancasEncontradas.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 p-4 text-center text-gray-600">
                      Nenhuma liderança encontrada
                    </div>
                  )}

                  {/* Dropdown com resultados */}
                  {liderancasEncontradas.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {liderancasEncontradas.map(lid => (
                        <button
                          key={lid.id}
                          type="button"
                          onClick={() => adicionarLideranca(lid)}
                          className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b last:border-b-0 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{lid.nome}</div>
                            <div className="text-xs text-gray-600">{lid.cpf} • {lid.telefone}</div>
                          </div>
                          <span className="ml-2 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FontAwesomeIcon icon={faPlus} className="text-lg" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela de Lideranças Selecionadas */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">CPF</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Papel</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liderancasSelecionadas.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-4 text-center text-gray-600 text-sm">
                          Nenhuma liderança selecionada ainda
                        </td>
                      </tr>
                    ) : (
                      liderancasSelecionadas.map(lid => (
                        <tr key={lid.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{lid.nome}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lid.cpf}</td>
                          <td className="px-4 py-3">
                            <select
                              value={lid.papel}
                              onChange={(e) => atualizarPapelLideranca(lid.id, e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500"
                            >
                              <option value="APOIO">🤝 Apoio</option>
                              <option value="COORDENADOR">📋 Coordenador</option>
                              <option value="SUPERVISOR">👁️ Supervisor</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removerLideranca(lid.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remover"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Serviços Oferecidos */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Serviços Oferecidos</h3>

              {/* Select de Serviços */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adicionar Serviço
                </label>
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const servico = servicos.find(s => s.id === e.target.value);
                        if (servico) adicionarServico(servico);
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Selecione um serviço...</option>
                    {servicos.filter(s => !servicosSelecionados.some(ss => ss.id === s.id)).map(serv => (
                      <option key={serv.id} value={serv.id}>{serv.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Novo Serviço */}
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  Criar Novo Serviço
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={novoServico}
                    onChange={(e) => setNovoServico(e.target.value)}
                    placeholder="Nome do serviço..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <input
                    type="text"
                    value={descricaoServico}
                    onChange={(e) => setDescricaoServico(e.target.value)}
                    placeholder="Descrição (opcional)"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={criarNovoServico}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Criar Serviço
                </button>
              </div>

              {/* Tabela de Serviços Selecionados */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Serviço</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Quantidade</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicosSelecionados.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-4 text-center text-gray-600 text-sm">
                          Nenhum serviço selecionado ainda
                        </td>
                      </tr>
                    ) : (
                      servicosSelecionados.map(serv => (
                        <tr key={serv.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{serv.nome}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              value={serv.quantidade}
                              onChange={(e) => atualizarQuantidadeServico(serv.id, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-teal-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removerServico(serv.id)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Remover"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Coluna Lateral */}
          <div className="space-y-6">
            {/* Status e Observações */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Configurações</h3>

              <div className="space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="PLANEJAMENTO">📋 Planejamento</option>
                    <option value="EXECUCAO">🚀 Em Execução</option>
                    <option value="CONCLUIDA">✅ Concluída</option>
                    <option value="CANCELADA">❌ Cancelada</option>
                  </select>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Anotações sobre a campanha..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-teal-900 mb-4">📊 Resumo</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Lideranças:</span>
                  <span className="font-bold text-teal-600">{liderancasSelecionadas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Serviços:</span>
                  <span className="font-bold text-teal-600">{servicosSelecionados.length}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-teal-200">
                  <span className="text-gray-700">Status:</span>
                  <span className="font-bold text-teal-600">{formData.status}</span>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                {loading ? 'Salvando...' : id ? 'Atualizar Campaign' : 'Criar Campanha'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faTimes} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
