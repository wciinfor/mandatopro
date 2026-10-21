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
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

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
          1. HEADER
      ========================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#001428]/90 backdrop-blur-md border-b border-cyan-900/40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo MandatoPRO */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <span className="text-white font-black text-2xl tracking-tighter">M</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-white flex items-center">
                  Mandato<span className="text-cyan-400">PRO</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold -mt-1">
                  Gestão & Inteligência
                </span>
              </div>
            </a>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('hero')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Início
            </button>
            <button
              onClick={() => scrollToSection('para-quem')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Para quem é
            </button>
            <button
              onClick={() => scrollToSection('insystens')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Inteligência Eleitoral
            </button>
            <button
              onClick={() => scrollToSection('funcionalidades')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => scrollToSection('tai')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              TAI
            </button>
            <button
              onClick={() => scrollToSection('contato')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Contato
            </button>
          </nav>

          {/* CTAs Desktop */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="https://app.mandatopro.com/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 transition-colors"
            >
              Entrar
            </a>
            <button
              onClick={() => scrollToSection('contato')}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              Solicitar Demonstração
            </button>
          </div>

          {/* Botão Mobile Menu */}
          <div className="lg:hidden flex items-center gap-3">
            <a
              href="https://app.mandatopro.com/login"
              className="text-xs font-semibold text-cyan-400 border border-cyan-800 px-3 py-1.5 rounded-md"
            >
              Entrar
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
          <div className="lg:hidden bg-[#001428] border-b border-cyan-900/60 px-6 py-6 space-y-4 animate-in slide-in-from-top">
            <button
              onClick={() => scrollToSection('hero')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              Início
            </button>
            <button
              onClick={() => scrollToSection('para-quem')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              Para quem é
            </button>
            <button
              onClick={() => scrollToSection('insystens')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              Inteligência Eleitoral
            </button>
            <button
              onClick={() => scrollToSection('funcionalidades')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              Funcionalidades
            </button>
            <button
              onClick={() => scrollToSection('tai')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              TAI — Assistente Inteligente
            </button>
            <button
              onClick={() => scrollToSection('contato')}
              className="block w-full text-left text-base font-medium text-slate-200 hover:text-cyan-400"
            >
              Contato
            </button>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
              <button
                onClick={() => scrollToSection('contato')}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-lg text-center"
              >
                Solicitar Demonstração
              </button>
              <a
                href="https://app.mandatopro.com/login"
                className="w-full bg-slate-800 text-slate-200 font-bold py-3 rounded-lg text-center hover:bg-slate-700"
              >
                Acessar Sistema
              </a>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          2. HERO SECTION
      ========================================================= */}
      <section
        id="hero"
        className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-[#001124]"
      >
        {/* Imagem de Fundo Oficial do Hero */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/img/bg_hero.png"
            alt="Hero Background MandatoPRO"
            fill
            className="object-cover object-center"
            priority
          />
          {/* Overlays sutis para garantir legibilidade dos textos e transição suave para a próxima seção */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001124]/90 via-[#001124]/70 to-[#001124]/40" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#000a17] to-transparent" />
        </div>

        {/* Efeitos de Iluminação e Gradiente Tecnológico */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none z-[1]" />
        <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-[1]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Coluna Esquerda: Textos, Títulos e CTAs */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              {/* Badge de Categoria */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Gestão Política e Inteligência Eleitoral
              </div>

              {/* Título Principal Fiel ao Mockup */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
                Tecnologia para <br className="hidden sm:inline" />
                quem representa, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                  inteligência para <br className="hidden sm:inline" />
                  quem decide.
                </span>
              </h1>

              {/* Subtítulo Descritivo */}
              <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
                O MandatoPRO é uma plataforma completa para gestão de mandatos, relacionamento com a população, comunicação estratégica e inteligência eleitoral, com o poder da Insystens.AI.
              </p>

              {/* Lista dos 5 Públicos com Ícones no Hero */}
              <div className="pt-2 pb-4">
                <div className="grid grid-cols-5 gap-2 max-w-md mx-auto lg:mx-0 border-t border-b border-cyan-950/80 py-4">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400 text-sm">
                      <FontAwesomeIcon icon={faUserTie} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">Vereadores</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400 text-sm">
                      <FontAwesomeIcon icon={faLandmark} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">Prefeitos</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400 text-sm">
                      <FontAwesomeIcon icon={faBuildingColumns} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">Deputados</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400 text-sm">
                      <FontAwesomeIcon icon={faScaleUnbalanced} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">Senadores</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 flex items-center justify-center text-cyan-400 text-sm">
                      <FontAwesomeIcon icon={faAward} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-300">Presidentes</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  onClick={() => scrollToSection('contato')}
                  className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faCalendarCheck} />
                  Solicitar Demonstração
                </button>
                <button
                  onClick={() => scrollToSection('funcionalidades')}
                  className="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold px-7 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlay} className="text-xs text-cyan-400" />
                  Conheça a Plataforma
                </button>
              </div>
            </div>

            {/* Coluna Direita: Mockup do Laptop com Dashboard */}
            <div className="lg:col-span-6 relative flex justify-center items-center">
              <div className="relative w-full max-w-[560px] transform hover:scale-[1.01] transition-transform duration-500">
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/80 border border-cyan-800/40 bg-slate-900">
                  <Image
                    src="/landing/hero_laptop.png"
                    alt="Dashboard do MandatoPRO em Notebook"
                    width={560}
                    height={380}
                    className="w-full h-auto object-contain"
                    priority
                  />
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

          {/* Grid dos 5 Cards com Fotos Institucionais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Card 1: Vereadores */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <Image
                  src="/landing/lideranca_vereadores.png"
                  alt="Vereadores no Plenário"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faUserTie} className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Vereadores</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mais proximidade e resultados na sua cidade.
                </p>
              </div>
            </div>

            {/* Card 2: Prefeitos */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <Image
                  src="/landing/lideranca_prefeitos.png"
                  alt="Prefeitura e Gestão Municipal"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faLandmark} className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Prefeitos</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Gestão eficiente e relacionamento direto com a população.
                </p>
              </div>
            </div>

            {/* Card 3: Deputados Estaduais e Federais */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <Image
                  src="/landing/lideranca_deputados.png"
                  alt="Congresso e Assembleias Legislativas"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faBuildingColumns} className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Deputados Estaduais e Federais
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Atuação estratégica com dados e inteligência territorial.
                </p>
              </div>
            </div>

            {/* Card 4: Senadores */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <Image
                  src="/landing/lideranca_senadores.png"
                  alt="Senado Federal"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faScaleUnbalanced} className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Senadores</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Visão ampla, análise nacional e gestão de emendas.
                </p>
              </div>
            </div>

            {/* Card 5: Presidentes */}
            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
              <div className="relative h-40 overflow-hidden bg-slate-200">
                <Image
                  src="/landing/lideranca_presidentes.png"
                  alt="Palácio do Planalto e Liderança Maior"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faAward} className="text-sm" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Presidentes</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inteligência de dados para decisões de grande impacto.
                </p>
              </div>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Visual Esquerdo: Mapa do Brasil e Gráficos Analíticos */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl border border-cyan-800/40 bg-slate-950/80">
                <Image
                  src="/landing/insystens_map.png"
                  alt="Mapa territorial de inteligência Insystens.AI"
                  width={500}
                  height={340}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Conteúdo Direito: Textos e Pills */}
            <div className="lg:col-span-6 space-y-6">
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
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                    <FontAwesomeIcon icon={faGlobeAmericas} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Análise territorial eleitoral
                  </span>
                </div>

                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                    <FontAwesomeIcon icon={faDatabase} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Cruzamento com dados do IBGE
                  </span>
                </div>

                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                    <FontAwesomeIcon icon={faChartPie} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Identificação de oportunidades
                  </span>
                </div>

                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Coluna Esquerda: Textos, Título e Pills */}
            <div className="lg:col-span-6 space-y-6">
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
                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                    <FontAwesomeIcon icon={faBolt} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Respostas rápidas
                  </span>
                </div>

                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400 text-sm">
                    <FontAwesomeIcon icon={faCommentDots} />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    Consultas em linguagem natural
                  </span>
                </div>

                <div className="bg-[#021838]/80 border border-cyan-900/60 rounded-xl p-3 flex items-center gap-3">
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

            {/* Coluna Direita: Composição Visual do Chat + Robô TAI */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl border border-cyan-800/40 bg-slate-950">
                <Image
                  src="/landing/tai_robot_chat.png"
                  alt="Interface da TAI com robô assistente e chat interativo"
                  width={500}
                  height={340}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          7. CONTATO COMERCIAL & DEMONSTRAÇÃO
      ========================================================= */}
      <section id="contato" className="py-20 lg:py-28 bg-[#ffffff] text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Coluna Esquerda: Chamada e Formulário Comercial */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">
                Conheça o MandatoPRO na prática
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                Solicite uma demonstração com nossa equipe.
              </h2>

              <p className="text-base sm:text-lg text-slate-600">
                Descubra como o MandatoPRO pode transformar a gestão do seu mandato. Preencha o formulário e fale com um de nossos especialistas.
              </p>

              {/* Formulário Comercial */}
              {formEnviado ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 text-emerald-900 space-y-3">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-emerald-600" />
                    <h3 className="text-lg font-bold">Solicitação enviada com sucesso!</h3>
                  </div>
                  <p className="text-sm">
                    Agradecemos pelo seu interesse. Nossa equipe de especialistas entrará em contato pelo WhatsApp e e-mail informados nas próximas horas.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleFormSubmit}
                  className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm space-y-4"
                >
                  {formErro && (
                    <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-700 font-medium">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        name="nome"
                        required
                        value={formData.nome}
                        onChange={handleInputChange}
                        placeholder="Ex: Carlos Eduardo"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Cargo / Função *
                      </label>
                      <select
                        name="cargo"
                        required
                        value={formData.cargo}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Instituição / Gabinete *
                      </label>
                      <input
                        type="text"
                        name="gabinete"
                        required
                        value={formData.gabinete}
                        onChange={handleInputChange}
                        placeholder="Ex: Gabinete Deputado João"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        UF *
                      </label>
                      <input
                        type="text"
                        name="uf"
                        required
                        maxLength={2}
                        value={formData.uf}
                        onChange={handleInputChange}
                        placeholder="PA, SP, DF..."
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm uppercase focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Município
                      </label>
                      <input
                        type="text"
                        name="municipio"
                        value={formData.municipio}
                        onChange={handleInputChange}
                        placeholder="Ex: Belém"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        WhatsApp Oficial *
                      </label>
                      <input
                        type="tel"
                        name="whatsapp"
                        required
                        value={formData.whatsapp}
                        onChange={handleInputChange}
                        placeholder="(91) 98765-4321"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      E-mail Institucional / Gabinete *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="seuemail@gabinete.leg.br"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Mensagem / Principais Demandas
                    </label>
                    <textarea
                      name="mensagem"
                      rows={3}
                      value={formData.mensagem}
                      onChange={handleInputChange}
                      placeholder="Descreva brevemente como podemos ajudar seu mandato ou gabinete..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition resize-none"
                    />
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        name="consentimento"
                        required
                        checked={formData.consentimento}
                        onChange={handleInputChange}
                        className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>
                        Concordo com o tratamento dos dados informados para fins de contato e demonstração comercial da plataforma MandatoPRO, em total conformidade com a LGPD.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={formCarregando}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <FontAwesomeIcon icon={faCalendarCheck} />
                      {formCarregando ? 'Enviando...' : 'Solicitar Demonstração'}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                      Seus dados estão protegidos em conformidade com a LGPD e serão utilizados unicamente para retorno de contato comercial.
                    </p>
                  </div>
                </form>
              )}
            </div>

            {/* Coluna Direita: Foto da Equipe Comercial */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
                <Image
                  src="/landing/contato_equipe.png"
                  alt="Equipe MandatoPRO em atendimento com liderança política"
                  width={450}
                  height={320}
                  className="w-full h-auto object-cover"
                />
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="text-white font-black text-xl tracking-tighter">M</span>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center">
                  Mandato<span className="text-cyan-400">PRO</span>
                </span>
                <p className="text-xs text-slate-500">
                  Tecnologia e Inteligência Política
                </p>
              </div>
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
