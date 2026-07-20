import { useState } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileSignature, faSyncAlt, faPlus, faInbox, faSearch } from '@fortawesome/free-solid-svg-icons';
import { TemplateVisualizerCard } from '@/components/TemplateVisualizerCard';

// Mocks de templates oficiais contendo Cabeçalho, Corpo, Rodapé, Botões e Variáveis
const MOCK_TEMPLATES = [
  {
    id: 'tmpl-1',
    nome: 'convite_gabinete_bairro',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    status: 'APPROVED',
    canal: 'whatsapp',
    ultima_sincronizacao: new Date().toISOString(),
    componentes: [
      { type: 'HEADER', format: 'TEXT', text: '📢 Convite Especial' },
      { type: 'BODY', text: 'Olá {{1}},\n\nGostaríamos de convidar você e sua família para o nosso Gabinete Itinerante neste sábado, às 10h, na Praça Principal do bairro {{2}}.\n\nContamos com a sua presença!' },
      { type: 'FOOTER', text: 'Mandato Proativo - Canal Oficial' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver Localização' }] }
    ]
  },
  {
    id: 'tmpl-2',
    nome: 'atualizacao_solicitacao_status',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    status: 'PENDING',
    canal: 'whatsapp',
    ultima_sincronizacao: new Date(Date.now() - 3600000).toISOString(),
    componentes: [
      { type: 'BODY', text: 'Olá {{1}},\n\nInformamos que a sua solicitação nº {{2}} mudou de status para: *{{3}}*.\n\nAcompanhe os detalhes em nossa plataforma.' }
    ]
  }
];

export default function TemplatesOficiaisPage() {
  const [templates, setTemplates] = useState(MOCK_TEMPLATES);
  const [busca, setBusca] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const handleSincronizar = () => {
    setSincronizando(true);
    setTimeout(() => {
      setSincronizando(false);
      alert('Templates oficiais sincronizados com sucesso com o Meta Business Suite!');
    }, 1500);
  };

  const filtrarTemplates = templates.filter((t) => 
    t.nome.toLowerCase().includes(busca.toLowerCase()) ||
    t.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <ProtectedRoute>
      <Layout titulo="Templates de Mensagem (Meta HSM)">
        <div className="space-y-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 shadow-sm border border-teal-100/50 gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Modelos de Mensagem (HSM)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Modelos de mensagens pré-aprovados pela Meta para abertura de janelas de conversação ativa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSincronizar}
                disabled={sincronizando}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faSyncAlt} className={sincronizando ? 'animate-spin' : ''} />
                Sincronizar Meta
              </button>
              <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center gap-2 shadow-sm">
                <FontAwesomeIcon icon={faPlus} />
                Novo Modelo
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative w-full md:w-80">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar template..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Grid de Templates */}
          {filtrarTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtrarTemplates.map((tmpl) => (
                <TemplateVisualizerCard key={tmpl.id} template={tmpl} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-200 mb-3" />
              <p className="text-sm">Nenhum template oficial sincronizado ou criado.</p>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
