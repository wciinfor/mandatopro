import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import AIChatWidget from './AIChatWidget';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faUserTie } from '@fortawesome/free-solid-svg-icons';

function obterModuloAtivo(path = '') {
  if (path === '/dashboard') return 'Dashboard';
  if (path.startsWith('/cadastros/eleitores')) return 'Cadastros - Eleitores';
  if (path.startsWith('/cadastros/liderancas')) return 'Cadastros - Lideranças';
  if (path.startsWith('/cadastros/funcionarios')) return 'Cadastros - Funcionários';
  if (path.startsWith('/cadastros/atendimentos')) return 'Cadastros - Atendimentos';
  if (path.startsWith('/emendas/orgaos')) return 'Emendas - Órgãos';
  if (path.startsWith('/emendas/responsaveis')) return 'Emendas - Responsáveis';
  if (path.startsWith('/emendas/emendas')) return 'Emendas - Emendas';
  if (path.startsWith('/emendas/repasses')) return 'Emendas - Repasses';
  if (path.startsWith('/financeiro/lancamentos')) return 'Financeiro - Lancamentos';
  if (path.startsWith('/financeiro/receitas')) return 'Financeiro - Receitas';
  if (path.startsWith('/financeiro/despesas')) return 'Financeiro - Despesas';
  if (path.startsWith('/financeiro/caixa')) return 'Financeiro - Caixa / Saldo';
  if (path.startsWith('/financeiro/doadores')) return 'Financeiro - Doadores / Parceiros';
  if (path.startsWith('/financeiro/relatorios')) return 'Financeiro - Relatórios Financeiros';
  if (path.startsWith('/geolocalizacao')) return 'Geolocalização';
  if (path.startsWith('/comunicacao')) return 'Notificações';
  if (path.startsWith('/configuracoes')) return 'Configurações';
  return 'Dashboard';
}

export default function Layout({ children, titulo = 'MandatoPro' }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const moduloAtivo = obterModuloAtivo(router.pathname);

  useEffect(() => {
    try {
      const usuarioStr = localStorage.getItem('usuario');
      setUsuario(usuarioStr ? JSON.parse(usuarioStr) : null);
    } catch {
      setUsuario(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!usuario) {
      if (router.pathname !== '/login') {
        router.push('/login');
      }
      return;
    }

    // Buscar nome atualizado do Supabase — roda apenas uma vez após authReady,
    // sem depender de `usuario` para evitar loop: setUsuario → usuario muda → fetch → loop.
    fetch('/api/usuarios/me')
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        if (body?.data?.nome) {
          setUsuario(prev => {
            if (prev?.nome === body.data.nome) return prev; // sem mudança, não re-renderiza
            const atualizado = { ...prev, nome: body.data.nome };
            localStorage.setItem('usuario', JSON.stringify(atualizado));
            return atualizado;
          });
        }
      })
      .catch(() => {}); // falha silenciosa, exibe o cache
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, router.pathname]);

  return (
    <div className="min-h-screen bg-teal-50 flex">
      {/* Sidebar Component */}
      <Sidebar 
        sidebarAberto={sidebarAberto}
        setSidebarAberto={setSidebarAberto}
        moduloAtivo={moduloAtivo}
        setModuloAtivo={() => {}}
      />

      {/* Main Content */}
      <main className="flex-1 transition-all duration-300 ease-in-out lg:ml-0">
        {/* Header */}
        <div className="bg-white shadow-sm p-3 lg:p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* Botão hambúrguer para mobile */}
              <button
                onClick={() => setSidebarAberto(true)}
                className="lg:hidden text-teal-700 hover:text-teal-900 p-2"
              >
                <FontAwesomeIcon icon={faBars} className="text-lg" />
              </button>

              <div>
                <h2 className="text-lg lg:text-xl font-bold text-teal-800">
                  {titulo}
                </h2>
                <p className="text-xs text-gray-600">MandatoPro v2.0</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-4">
              <NotificationBell />
              <div className="flex items-center gap-2 bg-teal-100 px-3 py-2 rounded-lg">
                <FontAwesomeIcon icon={faUserTie} className="text-sm text-teal-700" />
                <span className="font-semibold text-teal-800 text-sm">{usuario?.nome || 'Admin'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
        <AIChatWidget />
      </main>
    </div>
  );
}
