import Head from 'next/head';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserSlash,
  faBuildingColumns,
  faEnvelope,
  faCheckCircle,
  faListCheck,
  faShieldHalved,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function ExclusaoDeDados() {
  return (
    <>
      <Head>
        <title>Solicitação de Exclusão de Dados — MandatoPro</title>
        <meta
          name="description"
          content="Instruções para solicitação de exclusão de dados pessoais no MandatoPro e procedimentos exigidos pela Meta / LGPD."
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-gray-100 flex flex-col">
        {/* Header Institucional */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/30">
                <FontAwesomeIcon icon={faBuildingColumns} className="text-white text-lg" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Mandato<span className="text-teal-400">PRO</span>
              </span>
            </Link>

            <Link
              href="/login"
              className="text-sm font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-2 transition"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Acessar Sistema
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-12 bg-slate-900/40 border-b border-slate-800/80">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-4">
              <FontAwesomeIcon icon={faUserSlash} />
              Direito de Eliminação de Dados (LGPD & Meta)
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              Solicitação de Exclusão de Dados
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
              Veja abaixo as instruções simples de como você pode solicitar a remoção permanente dos seus dados pessoais e de atendimento da plataforma MandatoPro.
            </p>
          </div>
        </section>

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 space-y-8">
          {/* Seção Destacada Obrigatória Meta */}
          <div className="bg-teal-950/60 border-2 border-teal-500/40 rounded-2xl p-6 md:p-8 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <FontAwesomeIcon icon={faShieldHalved} className="text-teal-400" />
              Solicitação de exclusão de dados
            </h2>
            <p className="text-slate-200 leading-relaxed text-sm md:text-base">
              Em conformidade com as diretrizes de privacidade da <strong className="text-white">Meta (Facebook/WhatsApp)</strong> e com a <strong className="text-white">Lei Geral de Proteção de Dados (LGPD)</strong>, qualquer usuário ou contato cadastrado pode solicitar a exclusão total ou parcial de suas informações mantidas pela plataforma.
            </p>
          </div>

          {/* Passo a Passo */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <FontAwesomeIcon icon={faListCheck} />
              Como realizar a solicitação (Passo a Passo)
            </h2>
            <div className="space-y-4 text-slate-300 text-sm md:text-base">
              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Envie um e-mail para o canal de privacidade</h3>
                  <p>Envie sua mensagem para o endereço institucional oficial: <strong className="text-teal-400 font-mono">privacidade@mandatopro.com.br</strong> ou <strong className="text-teal-400 font-mono">contato@mandatopro.com.br</strong>.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Informe os dados para identificação</h3>
                  <p>No corpo do e-mail, insira o assunto <strong className="text-white">&quot;Solicitação de Exclusão de Dados — [Seu Nome]&quot;</strong> e forneça:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400 text-xs md:text-sm">
                    <li>Nome completo;</li>
                    <li>Número de telefone com DDD (vinculado às mensagens/atendimentos);</li>
                    <li>E-mail cadastrado (caso seja usuário do sistema);</li>
                    <li>Descrição simplificada da solicitação (ex: &quot;Desejo remover meu histórico de mensagens e cadastro&quot;).</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <h3 className="font-bold text-white mb-1">Confirmação e Processamento</h3>
                  <p>Sua solicitação será analisada pela equipe encarregada. Você receberá uma confirmação de recebimento em até 24 horas úteis e o parecer final sobre a exclusão no prazo máximo de 15 dias corridos.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Exceções Legais */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <FontAwesomeIcon icon={faCheckCircle} />
              Retenção e Exceções Legais
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Ressaltamos que a exclusão dos dados será efetuada de forma definitiva, exceto nos casos em que a retenção das informações for necessária para o cumprimento de obrigação legal ou regulatória, nos termos previstos pelo Artigo 16 da LGPD.
            </p>
          </div>

          {/* Canal de Contato */}
          <div className="bg-slate-800/50 border border-teal-500/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl text-center">
            <h2 className="text-xl font-bold text-teal-300">Canal Exclusivo para Privacidade</h2>
            <p className="text-slate-300 text-sm md:text-base">
              Se tiver qualquer dúvida sobre o processo de exclusão, entre em contato direto pelo e-mail:
            </p>
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-700/80 inline-block text-teal-400 font-mono font-bold text-base md:text-lg">
              privacidade@mandatopro.com.br
            </div>
          </div>
        </main>

        {/* Footer Institucional */}
        <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-xs text-slate-500">
          <div className="max-w-5xl mx-auto px-4 space-y-3">
            <div className="flex justify-center gap-6 text-slate-400 font-medium">
              <Link href="/politica-privacidade" className="hover:text-teal-400 transition">Política de Privacidade</Link>
              <span>•</span>
              <Link href="/termos" className="hover:text-teal-400 transition">Termos de Serviço</Link>
              <span>•</span>
              <Link href="/exclusao-de-dados" className="hover:text-teal-400 transition">Exclusão de Dados</Link>
            </div>
            <p>© 2026 MandatoPro. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
