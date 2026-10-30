import { useEffect, useState } from 'react';
import Image from 'next/image';
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
  faCommentSms,
  faChevronLeft,
  faChevronRight
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

export default function Sidebar({
  sidebarAberto,
  setSidebarAberto,
  moduloAtivo,
  setModuloAtivo,
  sidebarRecolhida = false,
  setSidebarRecolhida = () => {}
}) {
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
      // Se estiver recolhida e o usuário clicar em um item com submenu, expande a sidebar
      if (sidebarRecolhida) {
        setSidebarRecolhida(false);
      }
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
      {/* Overlay Escuro para Mobile */}
      {sidebarAberto && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      {/* 
        SIDEBAR FIXA À ALTURA DA VIEWPORT (100dvh / 100vh)
        3 Regiões Flex:
        1. Topo fixo com logo e botão de recolher/expandir
        2. Centro rolável independente (min-h-0 overflow-y-auto)
        3. Rodapé fixo com botão Sair sempre visível
      */}
      <aside
        className={`fixed lg:sticky top-0 h-screen h-[100dvh] max-h-screen text-[#15345F] flex flex-col z-50 transition-all duration-300 ease-in-out border-r border-[#BBD5EE] shadow-sm select-none shrink-0 ${
          sidebarRecolhida ? 'w-20' : 'w-64'
        } ${
          sidebarAberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          backgroundImage: 'linear-gradient(to bottom, #E7F3FF 0%, #D4E9FE 35%, #BEE0FD 65%, #9BCFFF 88%, rgba(142, 196, 250, 0.95) 100%), url("/img/bg_menu1.png")',
          backgroundBlendMode: 'soft-light, normal',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#E7F3FF'
        }}
      >
        {/* =========================================================================
            REGIÃO 1: CABEÇALHO FIXO COM LOGO E BOTÃO DE RECOLHER/EXPANDIR
           ========================================================================= */}
        <div className={`relative border-b border-[#BBD5EE]/80 flex items-center shrink-0 bg-white/60 backdrop-blur-xs transition-all ${
          sidebarRecolhida ? 'p-3 flex-col gap-2' : 'py-4 px-3.5 justify-between'
        }`}>
          {/* Logo Expandida vs Ícone Compacto */}
          {sidebarRecolhida ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#CBDCEC] flex items-center justify-center shadow-xs p-1">
                <Image
                  src="/img/logo1.png"
                  alt="MandatoPRO"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <button
                type="button"
                onClick={() => setSidebarRecolhida(false)}
                className="w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-[#087CFA] border border-[#CBDCEC] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                title="Expandir menu lateral"
                aria-label="Expandir menu lateral"
              >
                <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center min-w-0 pr-2 flex-1 justify-center">
                <Image
                  src="/img/logoh.png"
                  alt="MandatoPRO Gestão & Inteligência"
                  width={220}
                  height={56}
                  className="h-12 w-auto max-w-[190px] object-contain drop-shadow-xs"
                  priority
                />
              </div>
              <button
                type="button"
                onClick={() => setSidebarRecolhida(true)}
                className="hidden lg:flex w-7 h-7 rounded-lg bg-white/80 hover:bg-white text-[#15345F] hover:text-[#087CFA] border border-[#CBDCEC] items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Recolher menu lateral"
                aria-label="Recolher menu lateral"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              </button>
            </>
          )}

          {/* Botão de Fechar no Mobile (Drawer) */}
          <button
            onClick={() => setSidebarAberto(false)}
            className="lg:hidden absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Fechar menu"
          >
            <FontAwesomeIcon icon={faTimes} className="text-sm" />
          </button>
        </div>

        {/* =========================================================================
            REGIÃO 2: NAVEGAÇÃO CENTRAL COM ROLAGEM VERTICAL INDEPENDENTE
           ========================================================================= */}
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin scrollbar-thumb-blue-200/80 hover:scrollbar-thumb-blue-300 ${
          sidebarRecolhida ? 'px-2' : 'px-3'
        }`}>
          <nav className="space-y-1">
            {modulos.map((modulo) => {
              const menuAberto = Boolean(menusAbertos[modulo.nome]);
              const moduloSelecionado = moduloAtivo === modulo.nome || moduloAtivo.startsWith(`${modulo.nome} - `);

              // ----------------------------------------------------
              // Modo Recolhido: Botão compacto centralizado + Tooltip
              // ----------------------------------------------------
              if (sidebarRecolhida) {
                return (
                  <div key={modulo.nome} className="relative group flex justify-center mb-1">
                    <button
                      type="button"
                      onClick={() => handleModuloClick(modulo)}
                      className={`w-11 h-11 rounded-xl transition-all duration-200 flex items-center justify-center relative cursor-pointer ${
                        moduloSelecionado
                          ? 'bg-[#087CFA] text-white font-bold shadow-md shadow-blue-500/30 ring-1 ring-blue-600/30'
                          : 'text-[#15345F] hover:bg-white/70 hover:text-[#087CFA] hover:shadow-2xs'
                      }`}
                      aria-label={modulo.nome}
                    >
                      <FontAwesomeIcon icon={modulo.icone} className="text-base" />
                      {modulo.submenu.length > 0 && (
                        <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                          moduloSelecionado ? 'bg-white' : 'bg-[#087CFA]'
                        }`} />
                      )}
                    </button>

                    {/* Tooltip Lateral Elegante */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                      <div className="bg-[#10254B] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                        {modulo.nome}
                      </div>
                    </div>
                  </div>
                );
              }

              // ----------------------------------------------------
              // Modo Expandido: Item completo com label e submenus
              // ----------------------------------------------------
              return (
                <div key={modulo.nome} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => handleModuloClick(modulo)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-between group cursor-pointer ${
                      moduloSelecionado
                        ? 'bg-[#087CFA] text-white font-bold shadow-md shadow-blue-500/30 ring-1 ring-blue-600/25'
                        : 'text-[#15345F] hover:bg-white/60 hover:text-[#087CFA] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-5 flex items-center justify-center text-sm ${
                        moduloSelecionado ? 'text-white' : 'text-[#15345F]/75 group-hover:text-[#087CFA]'
                      }`}>
                        <FontAwesomeIcon icon={modulo.icone} />
                      </div>
                      <span className="text-sm truncate tracking-tight">{modulo.nome}</span>
                    </div>
                    {modulo.submenu.length > 0 && (
                      <FontAwesomeIcon
                        icon={menuAberto ? faChevronUp : faChevronDown}
                        className={`text-xs transition-transform duration-200 ${
                          moduloSelecionado ? 'text-white/80' : 'text-[#15345F]/60 group-hover:text-[#087CFA]'
                        }`}
                      />
                    )}
                  </button>

                  {modulo.submenu.length > 0 && (
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      menuAberto
                        ? 'max-h-[38rem] opacity-100 mt-1 mb-1'
                        : 'max-h-0 opacity-0'
                    }`}>
                      <div className="bg-white/90 backdrop-blur-xs rounded-xl p-1.5 space-y-0.5 border border-[#BBD5EE] ml-3 shadow-xs">
                        {modulo.submenu.map((subitem, subIdx) => {
                          // Submenu aninhado (ex: SMS)
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
                                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all duration-150 flex items-center justify-between cursor-pointer ${
                                    isAnyChildActive
                                      ? 'bg-blue-50 text-[#087CFA] font-bold border border-blue-200'
                                      : 'hover:bg-blue-50/60 text-[#15345F] hover:text-[#087CFA]'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={subitem.icone || faCommentSms} className="w-3 text-[#087CFA]" />
                                    <span>{subitem.nome}</span>
                                  </span>
                                  <FontAwesomeIcon
                                    icon={isNestedOpen ? faChevronUp : faChevronDown}
                                    className="text-[10px] text-slate-400"
                                  />
                                </button>

                                <div
                                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                    isNestedOpen
                                      ? 'max-h-48 opacity-100 mt-1'
                                      : 'max-h-0 opacity-0'
                                  }`}
                                >
                                  <div className="bg-slate-50/80 rounded-lg p-1 space-y-0.5 ml-2 border-l-2 border-blue-400">
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
                                          className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-all duration-150 flex items-center justify-between cursor-pointer ${
                                            childAtivo
                                              ? 'bg-[#087CFA] text-white font-bold shadow-xs'
                                              : 'hover:bg-white text-[#15345F] hover:text-[#087CFA]'
                                          }`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${childAtivo ? 'bg-white' : 'bg-blue-400'}`} />
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

                          // Subitem padrão
                          const rotaSubitem = routeMap[`${modulo.nome} - ${subitem}`] || routeMap[subitem];
                          const subitemAtivo = isRouteActive(rotaSubitem) || moduloAtivo === `${modulo.nome} - ${subitem}`;

                          return (
                            <button
                              key={subitem}
                              type="button"
                              onClick={() => handleSubmenuClick(modulo, subitem)}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all duration-150 flex items-center justify-between cursor-pointer ${
                                subitemAtivo
                                  ? 'bg-[#087CFA] text-white font-bold shadow-xs'
                                  : 'hover:bg-blue-50/70 text-[#15345F] hover:text-[#087CFA]'
                              }`}
                              style={{
                                transitionDelay: menusAbertos[modulo.nome] ? `${subIdx * 25}ms` : '0ms'
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${subitemAtivo ? 'bg-white' : 'bg-[#087CFA]'}`} />
                                <span>{subitem}</span>
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

        {/* =========================================================================
            REGIÃO 3: RODAPÉ FIXO COM O BOTÃO SAIR SEMPRE VISÍVEL
           ========================================================================= */}
        <div className={`border-t border-[#BBD5EE]/80 p-3 bg-white/50 backdrop-blur-xs shrink-0 ${
          sidebarRecolhida ? 'flex justify-center px-2' : ''
        }`}>
          {sidebarRecolhida ? (
            <div className="relative group">
              <button
                type="button"
                onClick={handleLogout}
                className="w-11 h-11 bg-white/95 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                title="Encerrar Sessão"
                aria-label="Encerrar Sessão"
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="text-sm" />
              </button>
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                <div className="bg-rose-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                  Encerrar Sessão
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full bg-white/95 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200/80 py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer backdrop-blur-xs"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="text-xs" />
              <span>Encerrar Sessão</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
