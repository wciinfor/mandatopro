import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import AIChatWidget from './AIChatWidget';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faLandmark, faChevronDown, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';

function obterModuloAtivo(path = '') {
  if (path === '/dashboard') return 'Dashboard';
  if (path.startsWith('/cadastros/eleitores')) return 'Cadastros - Eleitores';
  if (path.startsWith('/cadastros/liderancas')) return 'Cadastros - Lideranças';
  if (path.startsWith('/cadastros/funcionarios')) return 'Cadastros - Funcionários';
  if (path.startsWith('/cadastros/atendimentos')) return 'Cadastros - Atendimentos';
  if (path.startsWith('/cadastros/campanhas')) return 'Cadastros - Campanhas';
  if (path.startsWith('/emendas/orgaos')) return 'Emendas - Órgãos';
  if (path.startsWith('/emendas/responsaveis')) return 'Emendas - Responsáveis';
  if (path.startsWith('/emendas/emendas')) return 'Emendas - Emendas';
  if (path.startsWith('/emendas/repasses')) return 'Emendas - Repasses';
  if (path.startsWith('/financeiro/lancamentos')) return 'Financeiro - Lançamentos';
  if (path.startsWith('/financeiro/receitas')) return 'Financeiro - Receitas';
  if (path.startsWith('/financeiro/despesas')) return 'Financeiro - Despesas';
  if (path.startsWith('/financeiro/caixa')) return 'Financeiro - Caixa / Saldo';
  if (path.startsWith('/financeiro/doadores')) return 'Financeiro - Doadores / Parceiros';
  if (path.startsWith('/financeiro/relatorios')) return 'Financeiro - Relatórios';
  if (path.startsWith('/geolocalizacao')) return 'Geolocalização';
  if (path.startsWith('/comunicacao-oficial/dashboard')) return 'Comunicação - Dashboard';
  if (path.startsWith('/comunicacao-oficial/publicos') || path.startsWith('/comunicacao-oficial/contatos')) return 'Comunicação - Públicos';
  if (path.startsWith('/comunicacao-oficial/campanhas') && path.includes('canal=sms')) return 'Comunicação - SMS (SMSDev) - Campanhas';
  if (path.startsWith('/comunicacao-oficial/campanhas')) return 'Comunicação - Disparos Oficiais';
  if (path.startsWith('/comunicacao-oficial/templates')) return 'Comunicação - Templates Oficiais';
  if (path.startsWith('/comunicacao-oficial/whatsapp-business')) return 'Comunicação - Definir Provedor';
  if (path.startsWith('/comunicacao-oficial/sms/carteira')) return 'Comunicação - SMS (SMSDev) - Carteira';
  if (path.startsWith('/comunicacao-oficial/sms')) return 'Comunicação - SMS (SMSDev) - Visão Geral';
  if (path.startsWith('/comunicacao-oficial/central-atendimento') || path.startsWith('/atendimento-connect')) return 'Comunicação - Central de Atendimento';
  if (path.startsWith('/comunicacao-oficial/insights')) return 'Comunicação - Dashboard';
  if (path.startsWith('/comunicacao')) return 'Notificações';
  if (path.startsWith('/configuracoes')) return 'Configurações';
  if (path.startsWith('/disparos')) return 'Comunicação - Disparos Oficiais';
  return 'Dashboard';
}

export default function Layout({ children, titulo = 'MandatoPro' }) {
  const router = useRouter();
  const { user, loading, updateUser, mandatoAtivoId, setMandatoAtivoId } = useAuth();
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const moduloAtivo = obterModuloAtivo(router.asPath || router.pathname);

  // Carrega preferência de sidebar do localStorage se disponível no cliente
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('sidebar_recolhida');
      if (salvo !== null) {
        setSidebarRecolhida(salvo === 'true');
      }
    } catch {
      // silencioso
    }
  }, []);

  const handleToggleRecolhida = (novoEstado) => {
    const estado = typeof novoEstado === 'boolean' ? novoEstado : !sidebarRecolhida;
    setSidebarRecolhida(estado);
    try {
      localStorage.setItem('sidebar_recolhida', String(estado));
    } catch {
      // silencioso
    }
  };

  // Mostrar seletor de mandato apenas se o usuário tiver acesso a múltiplos mandatos ou for ADMIN
  const temAcessoMultiplo = user?.nivel === 'ADMINISTRADOR' || (Array.isArray(user?.mandatos) && user.mandatos.length > 1);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (router.pathname !== '/login') {
        router.push('/login');
      }
      return;
    }

    fetch('/api/usuarios/me')
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        if (body?.data?.nome) {
          const atualizado = { ...user, nome: body.data.nome };
          if (user?.nome !== body.data.nome) {
            updateUser(atualizado);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, router.pathname, user?.id]);

  // Inicial do nome do usuário para o avatar circular azul
  const inicialUsuario = (user?.nome || 'Admin').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F9FE] flex selection:bg-[#087CFA] selection:text-white">
      <Sidebar
        sidebarAberto={sidebarAberto}
        setSidebarAberto={setSidebarAberto}
        moduloAtivo={moduloAtivo}
        setModuloAtivo={() => {}}
        sidebarRecolhida={sidebarRecolhida}
        setSidebarRecolhida={handleToggleRecolhida}
      />

      <main className="flex-1 transition-all duration-300 ease-in-out flex flex-col min-w-0">
        {/* Header Superior Claro conforme Mockup */}
        <header className="relative bg-white/95 backdrop-blur-md border-b border-[#CBDCEC] px-4 lg:px-7 py-3 lg:py-3.5 shrink-0 z-30 shadow-xs overflow-hidden">
          {/* Ilustração arquitetônica sutil ao fundo à direita idêntica ao mockup */}
          <div className="absolute right-0 top-0 bottom-0 w-72 pointer-events-none opacity-25 hidden xl:block overflow-hidden">
            <Image
              src="/IMG/bg_menu1.png"
              alt="Arquitetura de Fundo"
              fill
              className="object-cover object-bottom"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/40 to-white" />
          </div>

          <div className="relative z-10 flex justify-between items-center gap-4">
            {/* Lado Esquerdo: Menu Hamburger (mobile) / Toggle Expand (desktop) + Saudação + Versão */}
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                onClick={() => setSidebarAberto(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#10254B] hover:text-[#087CFA] hover:bg-blue-50 transition-colors lg:hidden shrink-0 border border-[#CBDCEC]"
                aria-label="Abrir menu lateral"
              >
                <FontAwesomeIcon icon={faBars} className="text-base" />
              </button>

              {/* Botão de expandir visível no desktop se a sidebar estiver recolhida */}
              {sidebarRecolhida && (
                <button
                  type="button"
                  onClick={() => handleToggleRecolhida(false)}
                  className="hidden lg:flex w-8 h-8 rounded-xl bg-white hover:bg-blue-50 text-[#087CFA] border border-[#CBDCEC] items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
                  title="Expandir menu lateral"
                  aria-label="Expandir menu lateral"
                >
                  <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                </button>
              )}

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-[#10254B] tracking-tight truncate leading-tight">
                  {titulo}
                </h1>
                <p className="text-[11px] sm:text-xs font-semibold text-[#087CFA] tracking-wide">
                  MandatoPro v2.0
                </p>
              </div>
            </div>

            {/* Lado Direito: Mandato Ativo + Notificações + Usuário */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              {temAcessoMultiplo && (
                <div className="flex items-center gap-2 bg-white border border-[#CBDCEC] hover:border-blue-300 px-3 py-1.5 rounded-xl shadow-xs transition-colors">
                  <span className="hidden md:inline text-xs font-semibold text-[#536987]">
                    Mandato Ativo:
                  </span>
                  <div className="relative flex items-center">
                    <FontAwesomeIcon icon={faLandmark} className="text-xs text-[#087CFA] mr-1.5" />
                    <select
                      value={mandatoAtivoId || 1}
                      onChange={(e) => setMandatoAtivoId(Number(e.target.value))}
                      className="bg-transparent text-xs text-[#10254B] font-bold focus:outline-none cursor-pointer pr-4 appearance-none"
                    >
                      <option value={1}>Deputado Estadual</option>
                      <option value={2}>Deputada Federal</option>
                    </select>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className="text-[9px] text-slate-400 pointer-events-none absolute right-0"
                    />
                  </div>
                </div>
              )}

              {/* Botão de Notificações */}
              <div className="relative flex items-center justify-center">
                <NotificationBell />
              </div>

              {/* Card do Usuário com Avatar Circular Azul */}
              <div className="flex items-center gap-2 pl-1 sm:pl-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#087CFA] text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm ring-2 ring-blue-100">
                  {inicialUsuario}
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-[#10254B] max-w-[120px] truncate">
                    {user?.nome || 'Administrador'}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className="text-[10px] text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <div className="p-4 sm:p-5 lg:p-7 flex-1 flex flex-col min-h-0 bg-[#F4F9FE]">
          {children}
        </div>

        <AIChatWidget />
      </main>
    </div>
  );
}
