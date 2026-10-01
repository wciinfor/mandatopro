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
  faHeadset,
  faCommentSms
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
    nome: 'Comunicação',
    icone: faPaperPlane,
    submenu: [
      'Dashboard',
      'Públicos',
      'Disparos Oficiais',
      'Templates Oficiais',
      'Definir Provedor',
      {
        nome: 'SMS (SMSDev)',
        icone: faCommentSms,
        subitens: [
          { nome: 'Visão Geral', rota: '/comunicacao-oficial/sms' },
          { nome: 'Campanhas', rota: '/comunicacao-oficial/campanhas?canal=sms' },
          { nome: 'Carteira', rota: '/comunicacao-oficial/sms/carteira' }
        ]
      },
      'Central de Atendimento',
      'Relatórios de Atendimento'
    ],
    rota: '/comunicacao-oficial/dashboard'
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

  'Comunicação - Dashboard': '/comunicacao-oficial/dashboard',
  'Comunicação - Públicos': '/comunicacao-oficial/publicos',
  'Comunicação - Disparos Oficiais': '/comunicacao-oficial/campanhas',
  'Comunicação - Templates Oficiais': '/comunicacao-oficial/templates',
  'Comunicação - Definir Provedor': '/comunicacao-oficial/whatsapp-business',
  'Definir Provedor': '/comunicacao-oficial/whatsapp-business',
  'Comunicação - WhatsApp Business Oficial': '/comunicacao-oficial/whatsapp-business',
  'WhatsApp Business Oficial': '/comunicacao-oficial/whatsapp-business',
  'Comunicação - Central de Atendimento': '/atendimento-connect',
  'Comunicação - Relatórios de Atendimento': '/atendimento-connect/relatorios',

  // SMS (SMSDev)
  'Comunicação - SMS (SMSDev) - Visão Geral': '/comunicacao-oficial/sms',
  'Comunicação - SMS (SMSDev) - Campanhas': '/comunicacao-oficial/campanhas?canal=sms',
  'Comunicação - SMS (SMSDev) - Carteira': '/comunicacao-oficial/sms/carteira',
  'SMS (SMSDev) - Visão Geral': '/comunicacao-oficial/sms',
  'SMS (SMSDev) - Campanhas': '/comunicacao-oficial/campanhas?canal=sms',
  'SMS (SMSDev) - Carteira': '/comunicacao-oficial/sms/carteira',
  'SMS - Visão Geral': '/comunicacao-oficial/sms',
  'SMS - Campanhas': '/comunicacao-oficial/campanhas?canal=sms',
  'SMS - Carteira': '/comunicacao-oficial/sms/carteira',
  'SMS (SMSDev)': '/comunicacao-oficial/sms',

  // Alias para retrocompatibilidade
  'Dashboard': '/comunicacao-oficial/dashboard',
  'Públicos': '/comunicacao-oficial/publicos',
  'Disparos Oficiais': '/comunicacao-oficial/campanhas',
  'Central de Atendimento': '/atendimento-connect',
  'Relatórios de Atendimento': '/atendimento-connect/relatorios',
  'Dashboard Oficial': '/comunicacao-oficial/dashboard',
  'Comunicação - Dashboard Oficial': '/comunicacao-oficial/dashboard',
  'Comunicação - Contatos Oficiais': '/comunicacao-oficial/publicos',
  'Comunicação - Públicos Oficiais': '/comunicacao-oficial/publicos',
  'Comunicação - Comunicações Oficiais': '/comunicacao-oficial/campanhas',
  'Comunicação - Insights Oficiais': '/comunicacao-oficial/dashboard',
  'Atendimento Connect': '/atendimento-connect',
  'Mandato Connect': '/comunicacao-oficial/campanhas'
};

function isRotaSms(asPath = '') {
  return asPath.startsWith('/comunicacao-oficial/sms') ||
    (asPath.startsWith('/comunicacao-oficial/campanhas') && asPath.includes('canal=sms'));
}

function obterMenusAbertosIniciais(moduloAtivo, asPath = '') {
  if (isRotaSms(asPath) || (moduloAtivo && moduloAtivo.startsWith('Comunicação'))) {
    return { 'Comunicação': true };
  }

  const moduloAtual = modulosBase.find((modulo) =>
    modulo.submenu && modulo.submenu.length > 0 && moduloAtivo.startsWith(`${modulo.nome} - `)
  );

  return moduloAtual ? { [moduloAtual.nome]: true } : {};
}

export default function Sidebar({ sidebarAberto, setSidebarAberto, moduloAtivo, setModuloAtivo }) {
  const router = useRouter();
  const { logout } = useAuth();
  const currentPath = router.asPath || router.pathname || '';
  const [menusAbertos, setMenusAbertos] = useState(() => obterMenusAbertosIniciais(moduloAtivo, currentPath));
  const [nestedMenusAbertos, setNestedMenusAbertos] = useState(() => ({
    'SMS (SMSDev)': isRotaSms(currentPath)
  }));
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  useEffect(() => {
    if (isRotaSms(router.asPath || '')) {
      setMenusAbertos(prev => ({ ...prev, 'Comunicação': true }));
      setNestedMenusAbertos(prev => ({ ...prev, 'SMS (SMSDev)': true }));
    }
  }, [router.asPath]);

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
    const nomeSub = typeof subitem === 'string' ? subitem : subitem?.nome;
    setModuloAtivo(`${modulo.nome} - ${nomeSub}`);
    setSidebarAberto(false);

    const rota = typeof subitem === 'object' && subitem.rota
      ? subitem.rota
      : (routeMap[`${modulo.nome} - ${nomeSub}`] || routeMap[nomeSub]);

    if (rota) {
      router.push(rota).catch(err => console.error('Erro ao navegar:', err));
    }
  };

  const isRouteActive = (rota) => {
    if (!rota) return false;
    const asPath = router.asPath || router.pathname || '';
    if (rota.includes('?')) {
      const [pathPart, queryPart] = rota.split('?');
      return asPath.startsWith(pathPart) && asPath.includes(queryPart);
    }
    if (rota === '/comunicacao-oficial/campanhas') {
      return asPath.startsWith(rota) && !asPath.includes('canal=sms');
    }
    if (rota === '/comunicacao-oficial/sms') {
      return asPath === '/comunicacao-oficial/sms' || (asPath.startsWith('/comunicacao-oficial/sms') && !asPath.startsWith('/comunicacao-oficial/sms/carteira'));
    }
    return asPath.startsWith(rota);
  };

  const modulos = modulosBase
    .filter((modulo) => {
      if (nivelUsuario === 'ATENDENTE_CONNECT' || nivelUsuario === 'ANALISTA_META') {
        return ['Comunicação'].includes(modulo.nome);
      }
      if (nivelUsuario === 'SUPERVISOR_CONNECT') {
        return ['Comunicação'].includes(modulo.nome);
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
      if (modulo.nome === 'Comunicação') {
        if (nivelUsuario === 'ATENDENTE_CONNECT' || nivelUsuario === 'ANALISTA_META') {
          return { ...modulo, submenu: ['Central de Atendimento'] };
        }
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
                        ? 'max-h-[38rem] opacity-100 translate-y-0'
                        : 'max-h-0 opacity-0 -translate-y-2'
                    }`}>
                      <div className="bg-[#032E35] rounded-lg p-2 space-y-1 border-l-2 border-teal-400 ml-4">
                        {modulo.submenu.map((subitem, subIdx) => {
                          // Item com sub-menu aninhado (Ex: SMS (SMSDev))
                          if (typeof subitem === 'object' && subitem.subitens) {
                            const nestedNome = subitem.nome;
                            const isNestedOpen = Boolean(nestedMenusAbertos[nestedNome]);
                            const isAnyChildActive = subitem.subitens.some(child => isRouteActive(child.rota));

                            return (
                              <div key={nestedNome} className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNestedMenusAbertos(prev => ({
                                      ...prev,
                                      [nestedNome]: !prev[nestedNome]
                                    }));
                                  }}
                                  className={`w-full text-left px-3.5 py-2 text-xs rounded-md transition-all duration-150 flex items-center justify-between ${
                                    isAnyChildActive
                                      ? 'bg-[#054248] text-teal-200 font-bold border border-teal-500/40 shadow-xs'
                                      : 'hover:bg-[#0A4C53] text-gray-300'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={subitem.icone || faCommentSms} className="w-3.5 text-teal-400" />
                                    <span>{subitem.nome}</span>
                                  </span>
                                  <FontAwesomeIcon
                                    icon={isNestedOpen ? faChevronUp : faChevronDown}
                                    className={`text-[10px] text-gray-400 transition-transform duration-200 ${
                                      isNestedOpen ? 'rotate-180' : 'rotate-0'
                                    }`}
                                  />
                                </button>

                                {/* Sub-itens aninhados */}
                                <div
                                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                    isNestedOpen
                                      ? 'max-h-48 opacity-100 mt-1'
                                      : 'max-h-0 opacity-0'
                                  }`}
                                >
                                  <div className="bg-[#022227] rounded-md p-1.5 space-y-0.5 border-l-2 border-teal-400/80 ml-3">
                                    {subitem.subitens.map((child) => {
                                      const childAtivo = isRouteActive(child.rota);
                                      return (
                                        <button
                                          key={child.nome}
                                          type="button"
                                          onClick={() => {
                                            setModuloAtivo(`${modulo.nome} - ${subitem.nome} - ${child.nome}`);
                                            setSidebarAberto(false);
                                            router.push(child.rota).catch(err => console.error('Erro ao navegar:', err));
                                          }}
                                          className={`w-full text-left px-3 py-1.5 text-xs rounded transition-all duration-150 flex items-center justify-between ${
                                            childAtivo
                                              ? 'bg-white text-[#0A4C53] font-bold shadow-xs transform scale-[1.02]'
                                              : 'hover:bg-[#0A4C53] text-gray-300 hover:text-white'
                                          }`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${childAtivo ? 'bg-[#0A4C53]' : 'bg-teal-400'}`}></span>
                                            <span>{child.nome}</span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Subitem padrão (string)
                          const rotaSubitem = routeMap[`${modulo.nome} - ${subitem}`] || routeMap[subitem];
                          const subitemAtivo = isRouteActive(rotaSubitem) || moduloAtivo === `${modulo.nome} - ${subitem}`;

                          return (
                            <button
                              key={subitem}
                              type="button"
                              onClick={() => handleSubmenuClick(modulo, subitem)}
                              className={`w-full text-left px-4 py-2.5 text-sm rounded-md transition-all duration-150 ${
                                subitemAtivo
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
                          );
                        })}
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
