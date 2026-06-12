import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '@/contexts/AuthContext';
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
  faShieldAlt,
  faPaperPlane,
  faHeadset
} from '@fortawesome/free-solid-svg-icons';

const modulosBase = [
  {
    nome: 'Dashboard',
    icone: faChartBar,
    submenu: [],
    rota: '/dashboard'
  },
  {
    nome: 'Cadastros',
    icone: faClipboardList,
    submenu: ['Eleitores', 'Lideranças', 'Funcionários', 'Campanhas', 'Atendimentos']
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
    nome: 'Notificações',
    icone: faBullhorn,
    submenu: [],
    rota: '/comunicacao'
  },
  {
    nome: 'Mandato Connect',
    icone: faPaperPlane,
    submenu: [
      'Dashboard',
      'Contatos',
      'Instâncias',
      'Configurações',
      'Editar Campanha',
      'Progresso',
      'Resultados',
      'Histórico'
    ],
    rota: '/disparos'
  },
  {
    nome: 'Atendimento Connect',
    icone: faHeadset,
    submenu: [],
    rota: '/atendimento-connect'
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
    submenu: [],
    rota: '/solicitacoes'
  },
  {
    nome: 'Usuários',
    icone: faUsers,
    submenu: [],
    rota: '/usuarios'
  },
  {
    nome: 'Auditoria',
    icone: faShieldAlt,
    submenu: [],
    rota: '/auditoria/logs'
  },
  {
    nome: 'Configurações',
    icone: faCog,
    submenu: [],
    rota: '/configuracoes/sistema#dados'
  }
];

const routeMap = {
  Eleitores: '/cadastros/eleitores',
  Lideranças: '/cadastros/liderancas',
  Funcionários: '/cadastros/funcionarios',
  Atendimentos: '/cadastros/atendimentos',
  Campanhas: '/cadastros/campanhas',

  Órgãos: '/emendas/orgaos',
  Responsáveis: '/emendas/responsaveis',
  Emendas: '/emendas/emendas',
  Repasses: '/emendas/repasses',

  Lançamentos: '/financeiro/lancamentos',
  Despesas: '/financeiro/despesas',
  'Caixa / Saldo': '/financeiro/caixa',
  'Doadores / Parceiros': '/financeiro/doadores',
  'Financeiro - Relatórios': '/financeiro/relatorios',

  Compromissos: '/agenda/compromissos',
  Reuniões: '/agenda/reunioes',
  Eventos: '/agenda/eventos',

  'Gerenciar Usuários': '/usuarios',
  'Logs do Sistema': '/auditoria/logs',
  'Dados do Sistema': '/configuracoes/sistema#dados',
  IA: '/configuracoes/sistema#ia',

  'Mandato Connect - Dashboard': '/disparos?section=dashboard',
  'Mandato Connect - Contatos': '/disparos?section=contatos',
  'Mandato Connect - Instâncias': '/disparos?section=instancias',
  'Mandato Connect - Configurações': '/disparos?section=configuracoes',
  'Mandato Connect - Editar Campanha': '/disparos?section=campanha',
  'Mandato Connect - Progresso': '/disparos?section=progresso',
  'Mandato Connect - Resultados': '/disparos?section=resultados',
  'Mandato Connect - Histórico': '/disparos?section=historico'
};

function obterMenusAbertosIniciais(moduloAtivo) {
  const moduloAtual = modulosBase.find((modulo) =>
    modulo.submenu.length > 0 && moduloAtivo.startsWith(`${modulo.nome} - `)
  );

  return moduloAtual ? { [moduloAtual.nome]: true } : {};
}

export default function Sidebar({ sidebarAberto, setSidebarAberto, moduloAtivo, setModuloAtivo }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [menusAbertos, setMenusAbertos] = useState(() => obterMenusAbertosIniciais(moduloAtivo));
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  const lerUsuarioAtual = () => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setUsuarioAtual(lerUsuarioAtual());
    }, 0);

    return () => clearTimeout(t);
  }, []);

  const nivelUsuario = String(usuarioAtual?.nivel || '').toUpperCase();

  const handleLogout = async () => {
    await logout();
  };

  const handleModuloClick = (modulo) => {
    setModuloAtivo(modulo.nome);

    if (modulo.submenu.length > 0) {
      setMenusAbertos(prev => (prev[modulo.nome] ? {} : { [modulo.nome]: true }));
      return;
    }

    setMenusAbertos({});
    setSidebarAberto(false);
    if (modulo.rota) {
      router.push(modulo.rota).catch(err => console.error('Erro ao navegar:', err));
    }
  };

  const handleSubmenuClick = (modulo, subitem) => {
    setModuloAtivo(`${modulo.nome} - ${subitem}`);
    setSidebarAberto(false);

    const rota = routeMap[`${modulo.nome} - ${subitem}`] || routeMap[subitem];

    if (rota) {
      router.push(rota).catch(err => console.error('Erro ao navegar:', err));
    }
  };

  const modulos = modulosBase
    .filter((modulo) => {
      if (nivelUsuario === 'ATENDENTE_CONNECT') {
        return ['Atendimento Connect'].includes(modulo.nome);
      }
      if (nivelUsuario === 'SUPERVISOR_CONNECT') {
        return ['Mandato Connect', 'Atendimento Connect'].includes(modulo.nome);
      }
      if (nivelUsuario === 'OPERADOR') {
        return ['Dashboard', 'Cadastros', 'Geolocalização'].includes(modulo.nome);
      }
      if (nivelUsuario === 'LIDERANCA') {
        return !['Emendas', 'Financeiro', 'Auditoria', 'Configurações'].includes(modulo.nome);
      }
      return true;
    })
    .map((modulo) => {
      if (modulo.nome === 'Cadastros' && nivelUsuario !== 'ADMINISTRADOR') {
        return { ...modulo, submenu: modulo.submenu.filter(s => ['Eleitores', 'Atendimentos'].includes(s)) };
      }
      return modulo;
    });

  return (
    <>
      {sidebarAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#0A4C53] text-white flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          sidebarAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-[#054248] flex justify-between items-center">
            <h1 className="text-2xl font-bold">MandatoPro</h1>
            <button
              onClick={() => setSidebarAberto(false)}
              className="lg:hidden text-white hover:text-gray-300"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <nav className="p-4">
            {modulos.map((modulo) => {
              const menuAberto = Boolean(menusAbertos[modulo.nome]);
              const moduloSelecionado = moduloAtivo === modulo.nome || moduloAtivo.startsWith(`${modulo.nome} - `);

              return (
                <div key={modulo.nome} className="mb-2">
                  <button
                    type="button"
                    onClick={() => handleModuloClick(modulo)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between ${
                      moduloSelecionado
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
                        icon={menuAberto ? faChevronUp : faChevronDown}
                        className={`text-sm transition-transform duration-200 ${
                          menuAberto ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    )}
                  </button>

                  {modulo.submenu.length > 0 && (
                    <div className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
                      menuAberto
                        ? 'max-h-[34rem] opacity-100 translate-y-0'
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
              );
            })}
          </nav>
        </div>

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
