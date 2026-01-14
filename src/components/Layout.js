import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faBell, faUserTie } from '@fortawesome/free-solid-svg-icons';

export default function Layout({ children, titulo = 'MandatoPro' }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [hidratado, setHidratado] = useState(false);
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState('Dashboard');

  useEffect(() => {
    const usuarioStr = localStorage.getItem('usuario');
    console.log('[Layout] Verificando autenticação - usuarioStr:', usuarioStr ? 'existe' : 'não existe');
    console.log('[Layout] pathname:', router.pathname);
    
    if (usuarioStr) {
      try {
        const userData = JSON.parse(usuarioStr);
        console.log('[Layout] Usuário parseado com sucesso:', userData.email);
        setUsuario(userData);
      } catch (error) {
        console.error('[Layout] Erro ao parsear usuário:', error);
        localStorage.removeItem('usuario');
        router.push('/login');
      }
    } else {
      console.log('[Layout] Nenhum usuário no localStorage');
      // Se não houver usuário e não está na página de login, redirecionar
      if (router.pathname !== '/login') {
        console.log('[Layout] Redirecionando para login');
        router.push('/login');
      }
    }
    
    // Marcar como hidratado após verificar localStorage
    setHidratado(true);
  }, []); // Executar apenas uma vez na montagem

  useEffect(() => {
    // Determinar módulo ativo baseado na rota atual
    const path = router.pathname;
    if (path === '/dashboard') {
      setModuloAtivo('Dashboard');
    } else if (path.startsWith('/cadastros/eleitores')) {
      setModuloAtivo('Cadastros - Eleitores');
    } else if (path.startsWith('/cadastros/liderancas')) {
      setModuloAtivo('Cadastros - Lideranças');
    } else if (path.startsWith('/cadastros/funcionarios')) {
      setModuloAtivo('Cadastros - Funcionários');
    } else if (path.startsWith('/cadastros/atendimentos')) {
      setModuloAtivo('Cadastros - Atendimentos');
    } else if (path.startsWith('/emendas/orgaos')) {
      setModuloAtivo('Emendas - Órgãos');
    } else if (path.startsWith('/emendas/responsaveis')) {
      setModuloAtivo('Emendas - Responsáveis');
    } else if (path.startsWith('/emendas/emendas')) {
      setModuloAtivo('Emendas - Emendas');
    } else if (path.startsWith('/emendas/repasses')) {
      setModuloAtivo('Emendas - Repasses');
    } else if (path.startsWith('/financeiro/receitas')) {
      setModuloAtivo('Financeiro - Receitas');
    } else if (path.startsWith('/financeiro/despesas')) {
      setModuloAtivo('Financeiro - Despesas');
    } else if (path.startsWith('/financeiro/relatorios')) {
      setModuloAtivo('Financeiro - Relatórios Financeiros');
    } else if (path.startsWith('/comunicacao')) {
      setModuloAtivo('Comunicação');
    } else if (path.startsWith('/configuracoes')) {
      setModuloAtivo('Configurações');
    }
  }, [router.pathname]);

  // Apenas renderizar conteúdo após hidratação para evitar mismatch
  if (!hidratado) {
    return null;
  }

  return (
    <div className="min-h-screen bg-teal-50 flex">
      {/* Sidebar Component */}
      <Sidebar 
        sidebarAberto={sidebarAberto}
        setSidebarAberto={setSidebarAberto}
        moduloAtivo={moduloAtivo}
        setModuloAtivo={setModuloAtivo}
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

            <div className="flex items-center gap-2">
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
      </main>
    </div>
  );
}
