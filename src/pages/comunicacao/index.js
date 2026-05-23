import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import useModal from '@/hooks/useModal';
import { ROLES } from '@/utils/permissions';

function lerUsuarioAtual() {
  if (typeof window === 'undefined') return null;
  try {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    return u?.id ? { id: u.id, nome: u.nome, nivel: u.nivel } : null;
  } catch {
    return null;
  }
}

function formatarData(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

export default function Comunicacao() {
  const { showSuccess } = useModal();
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  const nivel = useMemo(() => String(usuarioAtual?.nivel || '').toUpperCase(), [usuarioAtual?.nivel]);
  const podeEnviar = nivel === ROLES.ADMINISTRADOR || nivel === ROLES.LIDERANCA;

  const [loadingLista, setLoadingLista] = useState(false);
  const [configurado, setConfigurado] = useState(true);
  const [notificacoes, setNotificacoes] = useState([]);

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);

  const naoLidas = useMemo(
    () => (Array.isArray(notificacoes) ? notificacoes.filter(n => !n?.lida).length : 0),
    [notificacoes]
  );

  useEffect(() => {
    const t = setTimeout(() => setUsuarioAtual(lerUsuarioAtual()), 0);
    return () => clearTimeout(t);
  }, []);

  const carregarNotificacoes = async () => {
    if (!usuarioAtual?.id) return;
    setLoadingLista(true);
    try {
      const resp = await fetch('/api/notificacoes?limit=200', {
        headers: { usuario: JSON.stringify(usuarioAtual) }
      });
      const payload = await resp.json();
      if (!resp.ok) throw payload;
      setConfigurado(payload?.configurado !== false);
      setNotificacoes(payload?.data || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
      setNotificacoes([]);
      setConfigurado(true);
      showSuccess(err?.message || 'Erro ao carregar notificações', 'error');
    } finally {
      setLoadingLista(false);
    }
  };

  useEffect(() => {
    if (!usuarioAtual?.id) return;
    carregarNotificacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioAtual?.id]);

  const marcarComoLida = async (id) => {
    if (!usuarioAtual?.id || !id) return;
    try {
      const resp = await fetch('/api/notificacoes/marcar-lidas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          usuario: JSON.stringify(usuarioAtual)
        },
        body: JSON.stringify({ ids: [id] })
      });
      const payload = await resp.json();
      if (!resp.ok) throw payload;

      setNotificacoes(prev => (Array.isArray(prev) ? prev.map(n => n?.id === id ? { ...n, lida: true } : n) : prev));
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
      showSuccess(err?.message || 'Erro ao marcar como lida', 'error');
    }
  };

  const marcarTodasComoLidas = async () => {
    if (!usuarioAtual?.id) return;
    try {
      const resp = await fetch('/api/notificacoes/marcar-lidas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          usuario: JSON.stringify(usuarioAtual)
        },
        body: JSON.stringify({ all: true })
      });
      const payload = await resp.json();
      if (!resp.ok) throw payload;
      setNotificacoes(prev => (Array.isArray(prev) ? prev.map(n => ({ ...n, lida: true })) : prev));
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
      showSuccess(err?.message || 'Erro ao marcar todas como lidas', 'error');
    }
  };

  const enviarNotificacao = async () => {
    if (!usuarioAtual?.id) {
      showSuccess('Não autenticado', 'error');
      return;
    }

    if (!podeEnviar) {
      showSuccess('Sem permissão para enviar notificações', 'error');
      return;
    }

    if (!mensagem.trim()) {
      showSuccess('Preencha a mensagem', 'error');
      return;
    }

    setSending(true);
    try {
      const resp = await fetch('/api/notificacoes/enviar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          usuario: JSON.stringify(usuarioAtual)
        },
        body: JSON.stringify({
          titulo: titulo.trim() || undefined,
          mensagem: mensagem.trim()
        })
      });

      const payload = await resp.json();
      if (!resp.ok) throw payload;

      showSuccess(payload?.message || 'Notificações enviadas');
      setTitulo('');
      setMensagem('');
      await carregarNotificacoes();
    } catch (err) {
      console.error('Erro ao enviar notificações:', err);
      showSuccess(err?.message || 'Erro ao enviar notificações', 'error');
    } finally {
      setSending(false);
    }
  };

  // ============ CHAT ============
  const destinoLabel = nivel === ROLES.ADMINISTRADOR
    ? 'Lideranças e Operadores'
    : nivel === ROLES.LIDERANCA
      ? 'Meus Operadores'
      : 'Apenas visualização';

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
          <div className="flex items-center gap-4">
            <FontAwesomeIcon icon={faBell} size="2x" />
            <div>
              <h1 className="text-3xl font-bold">Notificações</h1>
              <p className="text-teal-100 mt-1">Avisos internos (sem respostas)</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Minhas Notificações</h2>
              <div className="text-sm text-gray-500">{naoLidas} não lidas</div>
            </div>

            {!configurado && (
              <div className="p-4 mb-4 border border-yellow-300 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                Notificações ainda não estão configuradas no banco. Execute a migration <b>002_create_notificacoes.sql</b> no Supabase.
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <button
                onClick={carregarNotificacoes}
                disabled={loadingLista}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-800 rounded-lg transition"
              >
                {loadingLista ? 'Atualizando...' : 'Atualizar'}
              </button>
              <button
                onClick={marcarTodasComoLidas}
                disabled={loadingLista || notificacoes.length === 0 || naoLidas === 0}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-lg transition flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faCheck} />
                Marcar todas como lidas
              </button>
            </div>

            {loadingLista ? (
              <div className="text-sm text-gray-500">Carregando...</div>
            ) : notificacoes.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhuma notificação por aqui.</div>
            ) : (
              <div className="space-y-3">
                {notificacoes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.lida && marcarComoLida(n.id)}
                    className={`w-full text-left p-4 rounded-lg border transition hover:bg-gray-50 ${
                      n.lida ? 'border-gray-200 bg-white' : 'border-teal-200 bg-teal-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${n.lida ? 'bg-gray-100 text-gray-600' : 'bg-teal-600 text-white'}`}>
                            {n.lida ? 'LIDA' : 'NOVA'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatarData(n.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="font-bold text-gray-800 truncate">
                            {n.titulo || 'Aviso'}
                          </p>
                          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                            {n.mensagem}
                          </p>
                          {(n.remetenteNome || n.remetenteNivel) && (
                            <p className="text-xs text-gray-500 mt-2">
                              Enviado por: {n.remetenteNome || 'Sistema'}{n.remetenteNivel ? ` (${n.remetenteNivel})` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-24">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Enviar Notificação</h2>
            <p className="text-xs text-gray-500 mb-4">Destino: {destinoLabel}</p>

            {!podeEnviar ? (
              <div className="text-sm text-gray-600">
                Apenas <b>Administradores</b> e <b>Lideranças</b> podem enviar.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Título (opcional)</label>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Aviso importante"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem *</label>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    rows={6}
                    placeholder="Digite o aviso que será enviado..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">Caracteres: {mensagem.length}</p>
                </div>

                <button
                  onClick={enviarNotificacao}
                  disabled={sending}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
