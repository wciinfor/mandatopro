import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileSignature, faSyncAlt, faPlus, faInbox, faSearch } from '@fortawesome/free-solid-svg-icons';
import { TemplateVisualizerCard } from '@/components/TemplateVisualizerCard';

export default function TemplatesOficiaisPage() {
  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const carregarTemplatesReais = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp-business/templates');
      if (res.ok) {
        const body = await res.json();
        const lista = body?.templates || body?.data || (Array.isArray(body) ? body : []);
        setTemplates(lista);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Falha ao carregar templates da conta oficial.');
      }
    } catch (err) {
      console.error('Erro ao carregar templates oficiais:', err);
      setErro(err.message || 'Erro ao carregar templates oficiais.');
      setTemplates([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTemplatesReais();
  }, []);

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      await carregarTemplatesReais();
    } finally {
      setSincronizando(false);
    }
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

          {/* Erro ao carregar */}
          {erro && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-700">
              <span>{erro}</span>
              <button
                onClick={carregarTemplatesReais}
                className="font-bold underline hover:text-red-900 cursor-pointer ml-2 shrink-0"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Loading */}
          {carregando ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100 flex flex-col items-center justify-center gap-3">
              <FontAwesomeIcon icon={faSyncAlt} className="text-3xl text-teal-600 animate-spin" />
              <p className="text-sm">Carregando templates homologados da conta oficial...</p>
            </div>
          ) : filtrarTemplates.length > 0 ? (
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
