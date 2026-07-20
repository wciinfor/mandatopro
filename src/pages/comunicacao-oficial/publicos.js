import { useState } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faPlus, faFilter, faSearch, faInbox } from '@fortawesome/free-solid-svg-icons';
import { PublicoCard } from '@/components/PublicoCard';

// Mocks de públicos normalizados com segmentação
const MOCK_PUBLICOS = [
  {
    id: 'pub-1',
    nome: 'Lideranças de Bairro - Centro',
    descricao: 'Eleitores cadastrados com nível de liderança no Bairro Centro com WhatsApp ativo.',
    canal: 'whatsapp',
    quantidade_contatos: 38,
    origem: 'Filtro Dinâmico',
    ultima_atualizacao: new Date().toISOString(),
    filtros_ativos: {
      tags: ['liderança'],
      bairro: 'Centro',
      situacao: 'regular'
    }
  },
  {
    id: 'pub-2',
    nome: 'Jovens Eleitores 16-24 anos',
    descricao: 'Eleitores jovens para campanhas de engajamento social nas redes e mídias.',
    canal: 'instagram',
    quantidade_contatos: 850,
    origem: 'Tags',
    ultima_atualizacao: new Date(Date.now() - 86400000).toISOString(),
    filtros_ativos: {
      faixa_etaria: '16-24',
      cidade: 'Belém'
    }
  }
];

export default function PublicosOficiaisPage() {
  const [publicos, setPublicos] = useState(MOCK_PUBLICOS);
  const [busca, setBusca] = useState('');

  // Estados dos filtros de segmentação solicitados
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroFaixaEtaria, setFiltroFaixaEtaria] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  const handleRecalcular = (id) => {
    // Apenas simula a chamada
    alert('Recalculando audiência de contatos com base nos filtros ativos...');
  };

  const filtrarPublicos = publicos.filter((p) => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.descricao.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <Layout titulo="Públicos & Audiências - WhatsApp Cloud API Oficial">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Audiências & Segmentações</h3>
              <p className="text-sm text-gray-500 mt-1">
                Defina públicos reutilizáveis e dinâmicos para suas campanhas de marketing oficial.
              </p>
            </div>
            <div>
              <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm">
                <FontAwesomeIcon icon={faPlus} />
                Criar Público
              </button>
            </div>
          </div>

          {/* Filtros de Segmentação Preparados */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <FontAwesomeIcon icon={faFilter} className="text-teal-600" />
              <h4 className="font-bold text-sm text-gray-800">Filtros de Segmentação (Audiência)</h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tags</label>
                <input
                  type="text"
                  value={filtroTag}
                  onChange={(e) => setFiltroTag(e.target.value)}
                  placeholder="Ex: saúde"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cidade</label>
                <input
                  type="text"
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Ex: Belém"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bairro</label>
                <input
                  type="text"
                  value={filtroBairro}
                  onChange={(e) => setFiltroBairro(e.target.value)}
                  placeholder="Ex: Centro"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sexo</label>
                <select
                  value={filtroSexo}
                  onChange={(e) => setFiltroSexo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Faixa Etária</label>
                <select
                  value={filtroFaixaEtaria}
                  onChange={(e) => setFiltroFaixaEtaria(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todas</option>
                  <option value="16-24">16-24 anos</option>
                  <option value="25-45">25-45 anos</option>
                  <option value="46+">46+ anos</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Liderança</label>
                <select
                  value={filtroLideranca}
                  onChange={(e) => setFiltroLideranca(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="yes">Apenas Lideranças</option>
                  <option value="no">Sem Liderança</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Situação</label>
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value="regular">Regular</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Busca Geral */}
          <div className="relative w-full md:w-80">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar público..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Lista de cards */}
          {filtrarPublicos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtrarPublicos.map((pub) => (
                <PublicoCard key={pub.id} publico={pub} onSync={handleRecalcular} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
              <p className="text-sm">Nenhum público localizado.</p>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
