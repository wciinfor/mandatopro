import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { registrarLogout } from '@/services/logService';
import {
  faChartBar,
  faClipboardList,
  faUniversity,
  faCoins,
  faMapMarkerAlt,
  faBullhorn,
  faCalendarAlt,
  faBirthdayCake,
  faFileAlt,
  faExclamationTriangle,
  faUsers,
  faChevronUp,
  faChevronDown,
  faSignOutAlt,
  faTimes,
  faCog,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';

export default function Sidebar({ sidebarAberto, setSidebarAberto, moduloAtivo, setModuloAtivo }) {
  const router = useRouter();
  const [menusAbertos, setMenusAbertos] = useState({});

  const modulos = [
    {
      nome: 'Dashboard',
      icone: faChartBar,
      submenu: [],
      rota: '/dashboard'
    },
    {
      nome: 'Cadastros',
      icone: faClipboardList,
      submenu: ['Eleitores', 'Lideranças', 'Funcionários', 'Atendimentos']
    },
    {
      nome: 'Emendas',
      icone: faUniversity,
      submenu: ['Órgãos', 'Responsáveis', 'Emendas', 'Repasses']
    },
    {
      nome: 'Financeiro',
      icone: faCoins,
      submenu: ['Lançamentos', 'Despesas', 'Caixa / Saldo', 'Doadores / Parceiros', 'Relatórios']
    },
    {
      nome: 'Geolocalização',
      icone: faMapMarkerAlt,
      submenu: [],
      rota: '/geolocalizacao'
    },
    {
      nome: 'Comunicação',
      icone: faBullhorn,
      submenu: [],
      rota: '/comunicacao'
    },
    {
      nome: 'Agenda',
      icone: faCalendarAlt,
      submenu: [],
      rota: '/agenda'
    },
    {
      nome: 'Aniversariantes',
      icone: faBirthdayCake,
      submenu: [],
      rota: '/aniversariantes'
    },
    {
      nome: 'Documentos',
      icone: faFileAlt,
      submenu: [],
      rota: '/documentos'
    },
    {
      nome: 'Solicitações',
      icone: faExclamationTriangle,
      submenu: ['Novos Pedidos', 'Pedidos Atendidos', 'Pedidos Recusados', 'Relatórios']
    },
    {
      nome: 'Usuários',
      icone: faUsers,
      submenu: ['Gerenciar Usuários'],
      rota: '/usuarios'
    },
    {
      nome: 'Auditoria',
      icone: faShieldAlt,
      submenu: ['Logs do Sistema'],
      rota: '/auditoria/logs'
    },
    {
      nome: 'Configurações',
      icone: faCog,
      submenu: ['Dados do Sistema'],
      rota: '/configuracoes/sistema'
    },
  ];

  // Mapeamento completo de rotas
  const routeMap = {
    // Cadastros
    'Eleitores': '/cadastros/eleitores',
    'Lideranças': '/cadastros/liderancas',
    'Funcionários': '/cadastros/funcionarios',
    'Atendimentos': '/cadastros/atendimentos',
    
    // Emendas
    'Órgãos': '/emendas/orgaos',
    'Responsáveis': '/emendas/responsaveis',
    'Emendas': '/emendas/emendas',
    'Repasses': '/emendas/repasses',
    
    // Financeiro
    'Lançamentos': '/financeiro/lancamentos',
    'Despesas': '/financeiro/despesas',
    'Caixa / Saldo': '/financeiro/caixa',
    'Doadores / Parceiros': '/financeiro/doadores',
    'Relatórios': '/financeiro/relatorios',
    
    // Agenda
    'Compromissos': '/agenda/compromissos',
    'Reuniões': '/agenda/reunioes',
    'Eventos': '/agenda/eventos',
    
    // Documentos
    // (Documentos agora é um único link direto, sem subitens)
    
    
    // Solicitações
    'Novos Pedidos': '/solicitacoes',
    'Pedidos Atendidos': '/solicitacoes/atendidos',
    'Pedidos Recusados': '/solicitacoes/recusados',
    'Relatórios': '/solicitacoes/relatorios',
    
    // Usuários
    'Gerenciar Usuários': '/usuarios',
    
    // Auditoria
    'Logs do Sistema': '/auditoria/logs',
    
    // Configurações
    'Dados do Sistema': '/configuracoes/sistema#dados'
  };

  const handleLogout = async () => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    
    // Registra o logout
    await registrarLogout(usuarioData);
    
    localStorage.removeItem('usuario');
    router.push('/login');
  };

  const handleModuloClick = (modulo) => {
    setModuloAtivo(modulo.nome);
    
    if (modulo.submenu.length > 0) {
      // Fecha todos os outros menus e abre/fecha o clicado
      setMenusAbertos(prev => {
        const novoEstado = {};
        // Se o menu já estava aberto, fecha ele. Senão, abre apenas ele
        if (!prev[modulo.nome]) {
          novoEstado[modulo.nome] = true;
        }
        return novoEstado;
      });
    } else {
      // Fecha todos os menus ao navegar para módulo sem submenu
      setMenusAbertos({});
      setSidebarAberto(false);
      if (modulo.rota) {
        router.push(modulo.rota).catch(err => console.error('Erro ao navegar:', err));
      }
    }
  };

  const handleSubmenuClick = (modulo, subitem) => {
    setModuloAtivo(`${modulo.nome} - ${subitem}`);
    setSidebarAberto(false);
    
    const rota = routeMap[subitem];
    
    if (rota) {
      router.push(rota).catch(err => console.error('Erro ao navegar:', err));
    }
  };

  return (
    <>
      {/* Overlay para mobile */}
      {sidebarAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#0A4C53] text-white flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          sidebarAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-[#054248] flex justify-between items-center">
            <h1 className="text-2xl font-bold">MandatoPro</h1>
            <button
              onClick={() => setSidebarAberto(false)}
              className="lg:hidden text-white hover:text-gray-300"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Menu */}
          <nav className="p-4">
            {modulos.map((modulo, idx) => (
              <div key={modulo.nome} className="mb-2">
                <button
                  type="button"
                  onClick={() => handleModuloClick(modulo)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between ${
                    moduloAtivo === modulo.nome || moduloAtivo.startsWith(modulo.nome + ' - ')
                      ? 'bg-white text-[#0A4C53] font-bold shadow-lg'
                      : 'hover:bg-[#054248] hover:translate-x-1 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={modulo.icone} className="w-5" />
                    <span>{modulo.nome}</span>
                  </div>
                  {modulo.submenu.length > 0 && (
                    <FontAwesomeIcon 
                      icon={menusAbertos[modulo.nome] ? faChevronUp : faChevronDown} 
                      className={`text-sm transition-transform duration-200 ${
                        menusAbertos[modulo.nome] ? 'rotate-180' : 'rotate-0'
                      }`}
                    />
                  )}
                </button>

                {/* Submenu */}
                {modulo.submenu.length > 0 && (
                  <div className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
                    menusAbertos[modulo.nome] 
                      ? 'max-h-96 opacity-100 translate-y-0' 
                      : 'max-h-0 opacity-0 -translate-y-2'
                  }`}>
                    <div className="bg-[#032E35] rounded-lg p-2 space-y-1 border-l-2 border-teal-400 ml-4">
                      {modulo.submenu.map((subitem, subIdx) => (
                        <button
                          key={subitem}
                          type="button"
                          onClick={() => handleSubmenuClick(modulo, subitem)}
                          className={`w-full text-left px-4 py-2.5 text-sm rounded-md transition-all duration-150 ${
                            moduloAtivo === `${modulo.nome} - ${subitem}`
                              ? 'bg-white text-[#0A4C53] font-bold shadow-md transform scale-105'
                              : 'hover:bg-[#0A4C53] hover:translate-x-2 text-gray-300'
                          }`}
                          style={{
                            transitionDelay: menusAbertos[modulo.nome] ? `${subIdx * 30}ms` : '0ms'
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                            {subitem}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Botão Sair - Fixo no final */}
        <div className="border-t border-[#054248] p-4">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
