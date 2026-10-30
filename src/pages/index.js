import { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserTie,
  faLandmark,
  faBuildingColumns,
  faScaleUnbalanced,
  faAward,
  faUsers,
  faClipboardList,
  faCoins,
  faComments,
  faBullseye,
  faShieldHalved,
  faArrowRight,
  faPlay,
  faGlobeAmericas,
  faDatabase,
  faChartPie,
  faFileLines,
  faBolt,
  faCommentDots,
  faLock,
  faCheckCircle,
  faBars,
  faTimes,
  faCalendarCheck,
  faHeadset,
  faMapMarkedAlt,
  faChartLine,
  faPaperPlane,
  faCalendarDay,
  faSliders,
  faUser,
  faBriefcase,
  faLocationDot,
  faEnvelope
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modalDemonstracaoOpen, setModalDemonstracaoOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    gabinete: '',
    municipio: '',
    uf: '',
    email: '',
    whatsapp: '',
    mensagem: '',
    consentimento: true,
    website: '' // Honeypot antispam invisivel
  });
  const [formEnviado, setFormEnviado] = useState(false);
  const [formCarregando, setFormCarregando] = useState(false);
  const [formErro, setFormErro] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormCarregando(true);
    setFormErro('');

    try {
      const response = await fetch('/api/comercial/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Falha ao processar solicitação. Tente novamente.');
      }

      // Somente exibe sucesso após persistência real no banco de dados
      setFormEnviado(true);
    } catch (err) {
      setFormErro(err.message || 'Erro inesperado ao registrar solicitação.');
    } finally {
      setFormCarregando(false);
    }
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      <Head>
        <title>MandatoPRO | Tecnologia e Inteligência para Lideranças Políticas</title>
        <meta
          name="description"
          content="O MandatoPRO é a plataforma completa para gestão de mandatos, relacionamento com a população, comunicação estratégica e inteligência eleitoral com Insystens.AI."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MandatoPRO | Tecnologia para quem representa, inteligência para quem decide" />
        <meta
          property="og:description"
          content="Plataforma de gestão política, inteligência territorial, comunicação com eleitores e assistente inteligente para mandatos em todo o Brasil."
        />
        <meta property="og:url" content="https://mandatopro.com" />
      </Head>

      {/* =========================================================
          1. HEADER (Design translúcido moderno com efeito glassmorphism)
      ========================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#001428]/60 backdrop-blur-xl border-b border-cyan-800/20 shadow-lg shadow-black/20 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-22 flex items-center justify-between">
          {/* Logo MandatoPRO */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center group py-1.5">
              <Image
                src="/img/logohb.png"
                alt="MandatoPRO"
                width={260}
                height={65}
                className="h-11 sm:h-13 w-auto object-contain group-hover:scale-[1.02] transition-transform drop-shadow"
                priority
              />
            </a>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-200">
            <button
              onClick={() => scrollToSection('hero')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Início
            </button>
            <button
              onClick={() => scrollToSection('para-quem')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Para quem é
            </button>
            <button
              onClick={() => scrollToSection('insystens')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Inteligência Eleitoral
            </button>
            <button
              onClick={() => scrollToSection('funcionalidades')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => scrollToSection('tai')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              TAI
            </button>
            <button
              onClick={() => scrollToSection('contato')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Contato
            </button>
          </nav>

          {/* CTAs Desktop - Apenas Entrar no Sistema */}
          <div className="hidden lg:flex items-center">
            <a
              href="https://app.mandatopro.com/login"
              className="px-6 py-2.5 rounded-xl border border-cyan-500/40 hover:border-cyan-400 bg-gradient-to-r from-cyan-500/10 to-blue-600/15 hover:from-cyan-500/25 hover:to-blue-600/30 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-cyan-500/20"
            >
              Entrar no Sistema
            </a>
          </div>

          {/* Botão Mobile Menu */}
          <div className="lg:hidden flex items-center gap-2.5">
            <a
              href="https://app.mandatopro.com/login"
              className="px-3.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-xs font-semibold text-white"
            >
              Entrar no Sistema
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white focus:outline-none"
              aria-label="Menu"
            >
              <FontAwesomeIcon icon={mobileMenuOpen ? faTimes : faBars} className="text-xl" />
            </button>
          </div>
        </div>

        {/* Menu Gaveta Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#001428]/95 backdrop-blur-2xl border-b border-cyan-900/60 px-6 py-6 space-y-4 animate-in slide-in-from-top">
            <button
              onClick={() => scrollToSection('hero')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              Início
            </button>
            <button
              onClick={() => scrollToSection('para-quem')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              Para quem é
            </button>
            <button
              onClick={() => scrollToSection('insystens')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              Inteligência Eleitoral
            </button>
            <button
              onClick={() => scrollToSection('funcionalidades')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => scrollToSection('tai')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              TAI — Assistente Inteligente
            </button>
            <button
              onClick={() => scrollToSection('contato')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-amber-400"
            >
              Contato
            </button>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
              <a
                href="https://app.mandatopro.com/login"
                className="w-full border border-slate-600 text-slate-200 font-bold py-3 rounded-xl text-center"
              >
                Entrar no Sistema
              </a>
              <button
                onClick={() => scrollToSection('contato')}
                className="w-full bg-[#f5a623] text-slate-950 font-bold py-3 rounded-xl text-center shadow-lg shadow-amber-500/25"
              >
                Solicitar Demonstração
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          2. HERO SECTION COM bg_hero3.png E COMPOSIÇÃO MODERNA
      ========================================================= */}
      <section
        id="hero"
        className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden bg-[#001020]"
      >
        {/* Imagem de Fundo Oficial do Hero (bg_hero3.png) */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/img/bg_hero3.png"
            alt="Hero Background MandatoPRO"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Overlays suaves para integração elegante com a barra superior e transição inferior */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001020]/90 via-[#001020]/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#ffffff] via-[#ffffff]/60 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl space-y-7 text-center lg:text-left">
            {/* Badge Tecnológica */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/60 border border-slate-600/50 backdrop-blur-md text-slate-200 text-xs font-bold tracking-wider shadow-sm uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Tecnologia a serviço do seu mandato
            </div>

            {/* Título Principal de Alto Impacto */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
              Mais organização. <br />
              Mais resultados. <br />
              <span className="text-[#f5a623]">
                Um mandato mais forte.
              </span>
            </h1>

            {/* Subtítulo Descritivo */}
            <p className="text-base sm:text-lg text-slate-200 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed drop-shadow-sm">
              O <strong className="text-white font-semibold">MandatoPRO</strong> é a plataforma completa para gestão de mandatos políticos, unindo organização, atendimento ao cidadão, comunicação e inteligência de dados em um só lugar.
            </p>

            {/* Botões de Ação Principais (Amber + Dark Translucent) */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-1">
              <button
                onClick={() => scrollToSection('contato')}
                className="w-full sm:w-auto bg-[#f5a623] hover:bg-[#ffb534] text-slate-950 font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                Solicitar demonstração
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </button>
              <button
                onClick={() => scrollToSection('funcionalidades')}
                className="w-full sm:w-auto bg-slate-900/60 hover:bg-slate-900/80 text-white border border-slate-600/70 backdrop-blur-md font-semibold px-7 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm"
              >
                <FontAwesomeIcon icon={faPlay} className="text-xs text-amber-400" />
                Conheça o sistema
              </button>
            </div>

            {/* 3 Pilares com Ícones Circulares (Implantação rápida / Suporte especializado / Dados seguros) */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 sm:gap-8 text-slate-200 text-xs sm:text-sm font-semibold">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full border border-slate-400/50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center text-amber-400 text-xs">
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <span>Implantação rápida</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full border border-slate-400/50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center text-amber-400 text-xs">
                  <FontAwesomeIcon icon={faHeadset} />
                </div>
                <span>Suporte especializado</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full border border-slate-400/50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center text-amber-400 text-xs">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <span>Dados seguros</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          FAIXA DE NÚMEROS / MÉTRICAS DE IMPACTO
      ========================================================= */}
      <section className="bg-white text-slate-900 py-10 sm:py-12 border-b border-slate-200 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl flex-shrink-0">
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  + 1.500
                </div>
                <div className="text-xs sm:text-sm text-slate-600 font-medium">
                  mandatos atendidos em todo o Brasil
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl flex-shrink-0">
                <FontAwesomeIcon icon={faMapMarkedAlt} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  26
                </div>
                <div className="text-xs sm:text-sm text-slate-600 font-medium">
                  estados com <strong className="text-slate-900 font-bold">clientes ativos</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl flex-shrink-0">
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  95%
                </div>
                <div className="text-xs sm:text-sm text-slate-600 font-medium">
                  de renovação dos mandatos
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl flex-shrink-0">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                  + 3 milhões
                </div>
                <div className="text-xs sm:text-sm text-slate-600 font-medium">
                  de atendimentos registrados
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. PARA QUEM É O MANDATOPRO
      ========================================================= */}
      <section id="para-quem" className="py-20 lg:py-28 bg-[#ffffff] text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header da Seção */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">
              Para quem é o MandatoPRO
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Uma plataforma para cada nível de liderança
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Do mandato municipal ao cenário nacional, o MandatoPRO atende às necessidades específicas de cada realidade, com ferramentas adequadas para cada nível de atuação.
            </p>
          </div>

          {/* Grid dos 4 Cards com Fotos Institucionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Card 1: Vereadores */}
            <div className="group relative bg-white rounded-2xl overflow-hidden border border-[#E2ECF7] shadow-sm hover:shadow-2xl hover:border-cyan-500/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col">
              <div className="relative h-48 sm:h-44 lg:h-48 overflow-hidden bg-slate-100">
                <Image
                  src="/landing/card_vereadores_hd.jpg"
                  alt="Vereadores no Plenário da Câmara Municipal"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />
                <span className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/95 backdrop-blur-md text-cyan-800 shadow-sm border border-white/60">
                  Municipal
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center mb-4 shadow-md shadow-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                  <FontAwesomeIcon icon={faUserTie} className="text-base" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight group-hover:text-cyan-700 transition-colors">
                  Vereadores
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mais proximidade, resolutividade nos bairros e resultados visíveis na sua cidade.
                </p>
              </div>
              <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 ease-out" />
            </div>

            {/* Card 2: Prefeitos */}
            <div className="group relative bg-white rounded-2xl overflow-hidden border border-[#E2ECF7] shadow-sm hover:shadow-2xl hover:border-blue-500/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col">
              <div className="relative h-48 sm:h-44 lg:h-48 overflow-hidden bg-slate-100">
                <Image
                  src="/landing/card_prefeitos_hd.jpg"
                  alt="Prefeitura e Gestão Municipal"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />
                <span className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/95 backdrop-blur-md text-blue-800 shadow-sm border border-white/60">
                  Executivo
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                  <FontAwesomeIcon icon={faLandmark} className="text-base" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight group-hover:text-blue-700 transition-colors">
                  Prefeitos
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Gestão eficiente, acompanhamento de demandas e relacionamento direto com a população.
                </p>
              </div>
              <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out" />
            </div>

            {/* Card 3: Deputados Estaduais e Federais */}
            <div className="group relative bg-white rounded-2xl overflow-hidden border border-[#E2ECF7] shadow-sm hover:shadow-2xl hover:border-sky-500/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col">
              <div className="relative h-48 sm:h-44 lg:h-48 overflow-hidden bg-slate-100">
                <Image
                  src="/landing/card_deputados_hd.jpg"
                  alt="Congresso Nacional e Assembleias Legislativas"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />
                <span className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/95 backdrop-blur-md text-sky-800 shadow-sm border border-white/60">
                  Estadual & Federal
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center mb-4 shadow-md shadow-sky-500/20 group-hover:scale-110 transition-transform duration-300">
                  <FontAwesomeIcon icon={faBuildingColumns} className="text-base" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight group-hover:text-sky-700 transition-colors">
                  Deputados Estaduais e Federais
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Atuação estratégica multirregional com dados e inteligência territorial de bases eleitorais.
                </p>
              </div>
              <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-sky-500 to-cyan-600 transition-all duration-500 ease-out" />
            </div>

            {/* Card 4: Senadores */}
            <div className="group relative bg-white rounded-2xl overflow-hidden border border-[#E2ECF7] shadow-sm hover:shadow-2xl hover:border-teal-500/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col">
              <div className="relative h-48 sm:h-44 lg:h-48 overflow-hidden bg-slate-100">
                <Image
                  src="/landing/card_senadores_hd.jpg"
                  alt="Senado Federal"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />
                <span className="absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/95 backdrop-blur-md text-teal-800 shadow-sm border border-white/60">
                  Senado Federal
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white flex items-center justify-center mb-4 shadow-md shadow-teal-500/20 group-hover:scale-110 transition-transform duration-300">
                  <FontAwesomeIcon icon={faScaleUnbalanced} className="text-base" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight group-hover:text-teal-700 transition-colors">
                  Senadores
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Visão ampla de federação, análise macrorregional e gestão integrada de emendas parlamentares.
                </p>
              </div>
              <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-teal-600 to-cyan-700 transition-all duration-500 ease-out" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          4. INSYSTENS.AI — INTELIGÊNCIA ELEITORAL
      ========================================================= */}
      <section
        id="insystens"
        className="py-20 lg:py-28 bg-[#001026] text-white relative overflow-hidden border-t border-b border-cyan-950/80"
      >
        {/* Imagem de Fundo Oficial do Card Insystens.AI */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/img/bg_cadai.png"
            alt="Insystens.AI Background"
            fill
            className="object-cover object-center"
          />
          {/* Overlays de contraste posicionados para proteger a figura da mulher/mapa à esquerda e dar legibilidade aos textos à direita */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#001026]/75 to-[#001026]/95" />
          <div className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:28px_28px] opacity-15 pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex justify-end">
          <div className="w-full lg:max-w-2xl space-y-6">
            <div className="inline-block">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                Inteligência que transforma dados em estratégia
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white flex items-center gap-2">
              Insystens.<span className="text-cyan-400">AI</span>
            </h2>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-200">
              Inteligência eleitoral a serviço do seu mandato.
            </h3>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Nosso motor analítico cruza dados das eleições anteriores, informações atualizadas do IBGE e os dados do seu mandato para identificar oportunidades, áreas prioritárias e estratégias de atuação com base em dados reais.
            </p>

            {/* 4 Cards / Pills de Recursos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faGlobeAmericas} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Análise territorial eleitoral
                </span>
              </div>

              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faDatabase} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Cruzamento com dados do IBGE
                </span>
              </div>

              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faChartPie} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Identificação de oportunidades
                </span>
              </div>

              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faFileLines} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Relatórios estratégicos para sua equipe
                </span>
              </div>
            </div>

            {/* CTA da Seção */}
            <div className="pt-4">
              <button
                onClick={() => scrollToSection('contato')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                Conheça o Insystens.AI
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          5. FUNCIONALIDADES
      ========================================================= */}
      <section id="funcionalidades" className="py-20 lg:py-28 bg-[#f8fbfe] text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header da Seção */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">
              Tudo o que o seu mandato precisa
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Funcionalidades que fazem a diferença
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Uma plataforma completa, integrada e intuitiva, desenvolvida para a realidade política brasileira.
            </p>
          </div>

          {/* Grid de 6 Cards Fiel ao Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Gestão de Pessoas */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Gestão de Pessoas</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cadastro de eleitores, lideranças, funcionários e equipes, com geolocalização, hierarquias territoriais e permissões de acesso.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>

            {/* Card 2: Atendimentos e Demandas */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faClipboardList} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Atendimentos e Demandas</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Organize solicitações da população, acompanhe o andamento, registre ações e mantenha a agenda do seu mandato integrada.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>

            {/* Card 3: Emendas e Financeiro */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faCoins} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Emendas e Financeiro</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Controle de emendas parlamentares, lançamentos financeiros, despesas, doações e relatórios administrativos completos.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>

            {/* Card 4: Comunicação Integrada */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faComments} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Comunicação Integrada</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Disparos e atendimento via WhatsApp e SMS, com automações, campanhas e gestão dos retornos pela equipe.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>

            {/* Card 5: Campanhas e Ações */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faBullseye} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Campanhas e Ações</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Planejamento e execução de campanhas, cadastro de pessoal, controle de eventos e acompanhamento de resultados.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>

            {/* Card 6: Segurança e Auditoria */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-4 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Segurança e Auditoria</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Controle de usuários por níveis de acesso, rastreabilidade de operações e total conformidade com a LGPD.
                </p>
              </div>
              <div className="pt-6 flex justify-end">
                <div className="w-8 h-8 rounded-full border border-cyan-200 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors">
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          6. TAI — ASSISTENTE INTELIGENTE
      ========================================================= */}
      <section
        id="tai"
        className="py-20 lg:py-28 bg-[#000f1f] text-white relative overflow-hidden border-t border-b border-cyan-950/90"
      >
        {/* Imagem de Fundo Oficial da Assistente TAI */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/img/bg_ia.png"
            alt="TAI Background"
            fill
            className="object-cover object-center"
          />
          {/* Overlays de contraste para legibilidade e visual moderno */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#000f1f]/90 via-[#000f1f]/70 to-[#000f1f]/40" />
          <div className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:28px_28px] opacity-15 pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl space-y-6 text-left">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              TAI — Sua Assistente Inteligente
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Pergunte. Analise. Decida.
            </h2>

            <p className="text-slate-300 text-base leading-relaxed">
              A TAI é o chat inteligente do MandatoPRO. Consulte informações do seu banco de dados em linguagem natural, gere relatórios, obtenha insights e agilize o trabalho da sua equipe.
            </p>

            {/* 3 Pills de Recursos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Respostas rápidas
                </span>
              </div>

              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faCommentDots} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Consultas em linguagem natural
                </span>
              </div>

              <div className="bg-[#021838]/85 backdrop-blur-md border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  Informações seguras e autorizadas
                </span>
              </div>
            </div>

            {/* CTA da TAI */}
            <div className="pt-4">
              <button
                onClick={() => scrollToSection('contato')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                Conheça a TAI
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          7. CONTATO COMERCIAL & DEMONSTRAÇÃO (Fiel ao Mockup Aprovado)
      ========================================================= */}
      <section
        id="contato"
        className="relative py-14 lg:py-16 overflow-hidden bg-gradient-to-b from-[#F5F9FD] via-white to-white text-slate-900 border-t border-slate-200/80"
      >
        <div className="relative max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fotografia Ampla Integrada ao Fundo no Topo Direito — Restrita ao Container Centralizado */}
          <div
            className="hidden lg:block absolute top-0 right-4 sm:right-6 lg:right-8 w-[58%] h-[420px] pointer-events-none z-0"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 15%, rgba(0,0,0,1) 38%), linear-gradient(to bottom, rgba(0,0,0,1) 68%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 15%, rgba(0,0,0,1) 38%), linear-gradient(to bottom, rgba(0,0,0,1) 68%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'destination-in'
            }}
          >
            <Image
              src="/img/bg_atendimento.png"
              alt="Equipe MandatoPRO em demonstração da plataforma"
              fill
              priority
              sizes="(max-width: 1320px) 58vw, 765px"
              className="object-cover object-right-top"
            />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] gap-8 lg:gap-12 items-start lg:items-stretch">
            {/* =========================================================
                COLUNA ESQUERDA: Formulário Comercial (Aprox. 42%)
            ========================================================= */}
            <div className="space-y-4 lg:space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-cyan-600 uppercase tracking-widest">
                  Conheça o MandatoPRO na prática
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-slate-900 tracking-tight leading-tight max-w-lg">
                  Solicite uma demonstração com nossa equipe.
                </h2>
              </div>

              {/* Formulário Comercial em Card Branco */}
              {formEnviado ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 text-emerald-900 space-y-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-xl text-emerald-600" />
                    <h3 className="text-base font-bold">Solicitação enviada com sucesso!</h3>
                  </div>
                  <p className="text-xs sm:text-sm">
                    Agradecemos pelo seu interesse. Nossa equipe de especialistas entrará em contato pelo WhatsApp e e-mail informados nas próximas horas.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleFormSubmit}
                  className="bg-white p-6 sm:p-7 rounded-2xl border border-[#CBDCEC] shadow-lg space-y-4"
                >
                  {formErro && (
                    <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-700 font-medium">
                      {formErro}
                    </div>
                  )}

                  {/* Campo Honeypot Oculto contra Bots/Spam */}
                  <div className="hidden" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex="-1"
                      autoComplete="off"
                      value={formData.website}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Linha 1: Nome Completo (Linha Inteira) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Nome Completo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FontAwesomeIcon icon={faUser} className="text-xs" />
                      </div>
                      <input
                        type="text"
                        name="nome"
                        required
                        value={formData.nome}
                        onChange={handleInputChange}
                        placeholder="Ex: Carlos Eduardo"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Linha 2: Cargo / Função e UF */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        Cargo / Função *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FontAwesomeIcon icon={faBriefcase} className="text-xs" />
                        </div>
                        <select
                          name="cargo"
                          required
                          value={formData.cargo}
                          onChange={handleInputChange}
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                        >
                          <option value="">Selecione...</option>
                          <option value="Vereador">Vereador(a)</option>
                          <option value="Prefeito">Prefeito(a)</option>
                          <option value="Deputado Estadual">Deputado(a) Estadual</option>
                          <option value="Deputado Federal">Deputado(a) Federal</option>
                          <option value="Senador">Senador(a)</option>
                          <option value="Presidente">Presidente</option>
                          <option value="Chefe de Gabinete">Chefe de Gabinete</option>
                          <option value="Assessor Parlamentar">Assessor(a) Parlamentar</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        UF *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FontAwesomeIcon icon={faLocationDot} className="text-xs" />
                        </div>
                        <input
                          type="text"
                          name="uf"
                          required
                          maxLength={2}
                          value={formData.uf}
                          onChange={handleInputChange}
                          placeholder="PA, SP..."
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm uppercase focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        Município
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FontAwesomeIcon icon={faLocationDot} className="text-xs" />
                        </div>
                        <input
                          type="text"
                          name="municipio"
                          value={formData.municipio}
                          onChange={handleInputChange}
                          placeholder="Ex: Belém"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        WhatsApp Oficial *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                          <FontAwesomeIcon icon={faWhatsapp} className="text-sm" />
                        </div>
                        <input
                          type="tel"
                          name="whatsapp"
                          required
                          value={formData.whatsapp}
                          onChange={handleInputChange}
                          placeholder="(91) 98765-4321"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      E-mail Institucional / Gabinete *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="seuemail@gabinete.leg.br"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Mensagem / Principais Demandas
                    </label>
                    <textarea
                      name="mensagem"
                      rows={2}
                      value={formData.mensagem}
                      onChange={handleInputChange}
                      placeholder="Descreva brevemente como podemos ajudar seu mandato ou gabinete..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition resize-none"
                    />
                  </div>

                  <div className="pt-0.5">
                    <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        name="consentimento"
                        required
                        checked={formData.consentimento}
                        onChange={handleInputChange}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="leading-tight text-[11px] sm:text-xs">
                        Concordo com o tratamento dos dados informados para fins de contato e demonstração comercial da plataforma MandatoPRO, em total conformidade com a LGPD.
                      </span>
                    </label>
                  </div>

                  <div className="pt-1.5">
                    <button
                      type="submit"
                      disabled={formCarregando}
                      className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold py-3.5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                    >
                      <FontAwesomeIcon icon={faCalendarCheck} />
                      {formCarregando ? 'Enviando...' : 'Solicitar Demonstração'}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                      Seus dados estão protegidos em conformidade com a LGPD e serão utilizados exclusivamente para retorno de contato comercial.
                    </p>
                  </div>
                </form>
              )}
            </div>

            {/* =========================================================
                COLUNA DIREITA: Fotografia no Topo e Benefícios Abaixo
            ========================================================= */}
            <div className="flex flex-col h-full justify-between">
              {/* No mobile: exibe a fotografia integrada antes dos benefícios */}
              <div className="lg:hidden relative w-full h-[240px] mb-6 overflow-hidden rounded-2xl">
                <Image
                  src="/img/bg_atendimento.png"
                  alt="Equipe MandatoPRO demonstrando a plataforma no notebook"
                  fill
                  sizes="100vw"
                  className="object-cover object-right-top"
                />
              </div>

              {/* No desktop: espaço reservado correspondente à altura da fotografia da equipe */}
              <div className="hidden lg:block h-[350px] w-full" aria-hidden="true" />

              {/* Bloco de Benefícios: Estritamente ABAIXO da fotografia no espaço claro, ocupando a altura para alinhar com o card */}
              <div className="space-y-6 pt-4 lg:pt-6">
                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl lg:text-[26px] font-black text-slate-900 tracking-tight leading-snug">
                    Uma demonstração completa,<br className="hidden sm:inline" /> online ou presencial, feita por especialistas.
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                    Conheça na prática como o MandatoPRO pode atender às necessidades reais do seu mandato ou gabinete.
                  </p>
                </div>

                {/* Grid Compacto de 6 Diferenciais em Duas Colunas com espaçamento respirável */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 pt-2">
                  {/* Diferencial 1 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faChartLine} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Visão completa da plataforma</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Conheça todos os módulos e funcionalidades.
                      </p>
                    </div>
                  </div>

                  {/* Diferencial 2 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Campanhas e comunicação</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Conheça o disparador multicanal (WhatsApp e SMS).
                      </p>
                    </div>
                  </div>

                  {/* Diferencial 3 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faUsers} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Dados reais do seu mandato</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Entenda como seus dados são organizados e protegidos.
                      </p>
                    </div>
                  </div>

                  {/* Diferencial 4 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faChartPie} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Relatórios e indicadores</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Acompanhe métricas e resultados em tempo real.
                      </p>
                    </div>
                  </div>

                  {/* Diferencial 5 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faCalendarDay} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Rotina de atendimento e agenda</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Veja na prática a gestão de eleitores, atendimentos e eventos.
                      </p>
                    </div>
                  </div>

                  {/* Diferencial 6 */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#E7F3FF] text-[#087CFA] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      <FontAwesomeIcon icon={faSliders} className="text-sm" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Tira-dúvidas personalizado</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Nossa equipe responde suas perguntas e mostra como aplicar no seu dia a dia.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          8. FOOTER
      ========================================================= */}
      <footer className="bg-[#000a14] text-slate-400 py-12 border-t border-cyan-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo e Slogan */}
            <div className="flex items-center gap-3">
              <Image
                src="/img/logohb.png"
                alt="MandatoPRO"
                width={480}
                height={120}
                className="h-24 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Links Institucionais e Legais */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium">
              <button
                onClick={() => scrollToSection('hero')}
                className="hover:text-cyan-400 transition-colors"
              >
                Início
              </button>
              <button
                onClick={() => scrollToSection('funcionalidades')}
                className="hover:text-cyan-400 transition-colors"
              >
                Funcionalidades
              </button>
              <button
                onClick={() => scrollToSection('insystens')}
                className="hover:text-cyan-400 transition-colors"
              >
                Insystens.AI
              </button>
              <a href="/politica-privacidade" className="hover:text-cyan-400 transition-colors">
                Política de Privacidade
              </a>
              <a href="/termos" className="hover:text-cyan-400 transition-colors">
                Termos de Uso
              </a>
              <a href="/exclusao-de-dados" className="hover:text-cyan-400 transition-colors">
                Exclusão de Dados
              </a>
              <a
                href="https://app.mandatopro.com/login"
                className="text-cyan-400 font-bold hover:underline"
              >
                Acesso ao Sistema
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} MandatoPRO. Todos os direitos reservados.</p>
            <p>Desenvolvido com tecnologia Insystens.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
