import Head from 'next/head';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faLock,
  faUserShield,
  faFileContract,
  faBuildingColumns,
  faEnvelope,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function PoliticaPrivacidade() {
  return (
    <>
      <Head>
        <title>Política de Privacidade — MandatoPro</title>
        <meta
          name="description"
          content="Política de Privacidade do MandatoPro. Saiba como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais de acordo com a LGPD."
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
              <FontAwesomeIcon icon={faShieldHalved} />
              Transparência e Segurança de Dados
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              Política de Privacidade
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
              Esta política estabelece os compromissos do MandatoPro com a proteção dos seus dados pessoais, em total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Última atualização: 20 de Agosto de 2026
            </p>
          </div>
        </section>

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 space-y-8">
          {/* Seção 1: Apresentação */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">1</span>
              Apresentação e Identificação
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              O <strong className="text-white">MandatoPro</strong> é uma plataforma de gestão estratégica e atendimento para gabinetes institucionais e lideranças. Esta Política de Privacidade descreve como os dados pessoais são coletados, utilizados, armazenados e protegidos ao utilizar a plataforma, seus módulos ou suas integrações oficiais.
            </p>
          </div>

          {/* Seção 2: Dados Trancados */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">2</span>
              Dados Pessoais Tratados
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Para o adequado funcionamento dos serviços, o MandatoPro pode tratar as seguintes categorias de dados pessoais:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 text-sm md:text-base">
              <li><strong className="text-white">Dados Cadastrais dos Usuários da Plataforma:</strong> Nome completo, e-mail institucional, telefone de contato, nível de acesso/perfil e logs de autenticação.</li>
              <li><strong className="text-white">Dados de Contato de Atendimentos:</strong> Nome, número de telefone WhatsApp, histórico de conversas e solicitações registradas no Atendimento Connect.</li>
              <li><strong className="text-white">Dados Operacionais e Tecnológicos:</strong> Endereço IP, tipo de navegador, registros de data/hora de acesso e identificadores de sessão.</li>
            </ul>
          </div>

          {/* Seção 3: Finalidade do Tratamento */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">3</span>
              Finalidade do Tratamento dos Dados
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Os dados tratados na plataforma destinam-se estritamente às seguintes finalidades:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 text-sm md:text-base">
              <li>Prestação dos serviços de atendimento individualizado e organização de demandas de gabinetes;</li>
              <li>Envio de comunicações institucionais solicitadas ou autorizadas pelos titulares;</li>
              <li>Operação das integrações de mensagens via Meta Cloud API / WhatsApp Business API;</li>
              <li>Garantia da segurança da informação, auditoria de acessos e prevenção contra fraude e uso indevido;</li>
              <li>Cumprimento de obrigações legais e regulatórias.</li>
            </ul>
          </div>

          {/* Seção 4: Integração com WhatsApp / Meta Cloud API */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">4</span>
              Uso da Integração com WhatsApp e Serviços Meta
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              O MandatoPro utiliza as APIs oficiais da Meta (WhatsApp Business Cloud API) para o envio de respostas e mensagens de atendimento. O tratamento de dados por meio dessas ferramentas obedece rigorosamente às diretrizes da Meta Cloud API e aos termos previstos na LGPD. O MandatoPro não comercializa, não aluga e não compartilha dados de usuários ou contatos com terceiros para fins publicitários.
            </p>
          </div>

          {/* Seção 5: Armazenamento e Segurança */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">5</span>
              Armazenamento e Segurança das Informações
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              As informações são armazenadas em infraestrutura de nuvem segura com criptografia em trânsito (TLS/HTTPS) e em repouso. Adotamos rigorosos controles de acesso baseados em perfis de permissão (RBAC), auditoria de logs e isolamento de ambientes para evitar acessos não autorizados, vazamentos ou perdas acidentais.
            </p>
          </div>

          {/* Seção 6: Direitos do Titular */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">6</span>
              Direitos do Titular dos Dados (LGPD)
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Nos termos do Art. 18 da LGPD, o titular dos dados pessoais possui o direito de solicitar a qualquer momento:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 text-sm md:text-base">
              <li>Confirmação da existência de tratamento e acesso aos dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou exclusão de dados desnecessários ou excessivos;</li>
              <li>Eliminação dos dados pessoais tratados com o consentimento do titular;</li>
              <li>Revogação do consentimento.</li>
            </ul>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base mt-2">
              Para solicitar a exclusão de seus dados, consulte também nossa página específica de{' '}
              <Link href="/exclusao-de-dados" className="text-teal-400 font-semibold underline hover:text-teal-300">
                Solicitação de Exclusão de Dados
              </Link>.
            </p>
          </div>

          {/* Seção 7: Contato do Encarregado (DPO) */}
          <div className="bg-slate-800/50 border border-teal-500/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <FontAwesomeIcon icon={faEnvelope} />
              Canal de Contato e DPO
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Para exercer seus direitos de titular ou esclarecer dúvidas sobre a nossa Política de Privacidade, entre em contato pelo e-mail oficial:
            </p>
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/80 inline-block text-teal-400 font-mono font-semibold text-sm md:text-base">
              privacidade@mandatopro.org
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
