import { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { registrarLogin } from '@/services/logService';
import { createClient } from '@/lib/supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faChartLine,
  faUsers,
  faBullhorn,
  faShieldHalved,
  faArrowRight,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // Fazer login via API (que tem acesso às variáveis de ambiente)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao fazer login');
      }

      const { user, session } = await response.json();

      if (session?.access_token && session?.refresh_token) {
        const supabase = createClient();
        if (supabase?.auth) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          });
          if (sessionError) {
            console.warn('Erro ao definir sessao Supabase:', sessionError);
          }
        }
      }
      
      // Fazer login no contexto
      login(user);
      
      // Registra o login bem-sucedido
      registrarLogin(user).catch((err) => {
        console.warn('Erro ao registrar login:', err);
      });
      
      const nivel = String(user?.nivel || '').toUpperCase();
      const destino = ['ATENDENTE_CONNECT', 'SUPERVISOR_CONNECT', 'ANALISTA_META'].includes(nivel)
        ? '/atendimento-connect'
        : '/dashboard';
      router.push(destino);
    } catch (error) {
      setErro(error.message);
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Acesso Administrativo | MandatoPRO</title>
        <meta
          name="description"
          content="Painel de acesso restrito aos operadores e gestores do sistema MandatoPRO."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden bg-[#001020] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
        {/* Imagem de Fundo Parlamentar Cinematográfica com Overlays */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/landing/login_background.jpg"
            alt="Gabinete Parlamentar MandatoPRO"
            fill
            className="object-cover object-center scale-105 transform motion-safe:animate-pulse [animation-duration:8s]"
            priority
          />
          {/* Camada de Gradiente Tecnológico Azul-Marinho / Ciano idêntica à referência visual */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001020]/95 via-[#00172e]/85 to-[#001224]/75 backdrop-blur-[2px]" />
          
          {/* Malha sutil de pontos e brilho ambiental */}
          <div className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Topo / Header da Página de Login */}
        <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/img/logoh.png"
              alt="MandatoPRO"
              width={200}
              height={50}
              className="h-11 w-auto object-contain"
              priority
            />
          </div>

          <a
            href="https://mandatopro.com"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-cyan-800/50 text-xs font-semibold text-cyan-300 hover:text-white transition-all shadow-sm backdrop-blur-sm"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Voltar para o site
          </a>
        </header>

        {/* Corpo Principal: Duas Colunas (Hero Institucional à esquerda + Card de Login flutuante à direita) */}
        <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 lg:py-10 flex-1 flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Coluna Esquerda: Apresentação Institucional de Alto Impacto */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Painel Parlamentar Unificado
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
                  Bem-vindo ao <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                    Ambiente Parlamentar
                  </span>{' '}
                  MandatoPRO
                </h1>
                <p className="text-base sm:text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
                  Gestão centralizada do mandato, relacionamento com eleitores, articulação de lideranças e inteligência territorial e estratégica em um só lugar.
                </p>
              </div>

              {/* 4 Cards Informativos Translúcidos (como na referência) */}
              <div className="space-y-3 max-w-lg">
                <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-cyan-900/40 backdrop-blur-md transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <FontAwesomeIcon icon={faChartLine} className="text-sm" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">Visão Estratégica & Inteligência Territorial</span>
                </div>

                <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-cyan-900/40 backdrop-blur-md transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <FontAwesomeIcon icon={faUsers} className="text-sm" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">Gestão de Eleitores, Equipes & Lideranças</span>
                </div>

                <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-cyan-900/40 backdrop-blur-md transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <FontAwesomeIcon icon={faBullhorn} className="text-sm" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">Comunicação Oficial & Atendimento Integrado</span>
                </div>

                <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-cyan-900/40 backdrop-blur-md transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-sm" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">Auditoria Rígida & Conformidade Eleitoral</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium italic pt-2">
                — Tecnologia a serviço de uma liderança de excelência.
              </div>
            </div>

            {/* Coluna Direita: Card de Login Flutuante (Estilo Branco Premium da referência) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[430px] bg-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/60 border border-slate-100 text-slate-900 relative">
                
                {/* Ícone de Topo Centralizado */}
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-sm">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-2xl" />
                  </div>
                </div>

                {/* Título e Subtítulo do Card */}
                <div className="text-center space-y-1.5 mb-8">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Acesso Parlamentar
                  </h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Entre com seu e-mail de operador para acessar o sistema.
                  </p>
                </div>

                {/* Formulário de Login */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      E-mail de Operador da Plataforma
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FontAwesomeIcon icon={faEnvelope} className="text-sm" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:opacity-50"
                        placeholder="operador@mandatopro.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Senha de Acesso
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FontAwesomeIcon icon={faLock} className="text-sm" />
                      </div>
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:opacity-50"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha(!mostrarSenha)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        <FontAwesomeIcon icon={mostrarSenha ? faEyeSlash : faEye} className="text-sm" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Para redefinição de credenciais, solicite suporte ao Administrador do Mandato.');
                      }}
                      className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
                    >
                      Esqueceu sua senha?
                    </a>
                  </div>

                  {erro && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                      {erro}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        Entrar no Sistema
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                      </>
                    )}
                  </button>
                </form>

                {/* Aviso de Segurança e Privacidade no Card */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center font-medium">
                  <FontAwesomeIcon icon={faShieldHalved} className="text-cyan-500 text-xs" />
                  Área estritamente restrita a operadores autorizados.
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* Rodapé da Página de Login */}
        <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 border-t border-cyan-950/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">MandatoPRO</span>
            <span>— Tecnologia para quem representa, inteligência para quem decide.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://mandatopro.com" className="hover:text-cyan-400 transition-colors">
              Início
            </a>
            <a href="https://mandatopro.com#contato" className="hover:text-cyan-400 transition-colors">
              Suporte
            </a>
            <span className="text-slate-500">© {new Date().getFullYear()} MandatoPRO. Todos os direitos reservados.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
