import Head from 'next/head';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileContract,
  faBuildingColumns,
  faHandshake,
  faShieldHalved,
  faGavel,
  faEnvelope,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function TermosDeServico() {
  return (
    <>
      <Head>
        <title>Termos de Serviço — MandatoPro</title>
        <meta
          name="description"
          content="Termos de Serviço do MandatoPro. Condições de uso, responsabilidades e diretrizes para utilização da plataforma de gestão institucional."
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
              <FontAwesomeIcon icon={faFileContract} />
              Condições de Uso da Plataforma
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              Termos de Serviço
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
              Estes termos regem o acesso e a utilização dos serviços e ferramentas oferecidos pelo MandatoPro para gabinetes e equipes autorizadas.
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
              Apresentação e Objeto
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              O <strong className="text-white">MandatoPro</strong> é uma plataforma tecnológica projetada para a gestão de atendimentos, triagem de demandas e relacionamento institucional de mandatos. Ao acessar a plataforma ou utilizar suas funcionalidades integradas, o usuário declara ter lido e concordado integralmente com as condições dispostas nestes Termos de Serviço.
            </p>
          </div>

          {/* Seção 2: Regras de Uso */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">2</span>
              Regras e Condições de Uso
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Ao utilizar a plataforma MandatoPro, o usuário compromete-se a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 text-sm md:text-base">
              <li>Manter o sigilo e a confidencialidade de suas credenciais de acesso (login e senha);</li>
              <li>Utilizar as ferramentas de comunicação e envio de mensagens exclusivamente para finalidades legítimas e autorizadas;</li>
              <li>Não transmitir conteúdos ilícitos, ofensivos, inverídicos, spam ou materiais que violem direitos de terceiros;</li>
              <li>Respeitar as políticas oficiais dos provedores de comunicação, incluindo a política comercial e de WhatsApp da Meta.</li>
            </ul>
          </div>

          {/* Seção 3: Integração com Terceiros */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">3</span>
              Integração com Plataformas de Terceiros (Meta/WhatsApp)
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              A plataforma viabiliza a integração técnica com serviços de terceiros, como a Meta Cloud API (WhatsApp Business). O funcionamento de tais integrações está sujeito aos termos, disponibilidade e políticas operacionais dessas plataformas parceiras. O MandatoPro não se responsabiliza por bloqueios ou limitações impostos diretamente pelos provedores terceiros devido ao mau uso das diretrizes por parte do usuário.
            </p>
          </div>

          {/* Seção 4: Segurança das Credenciais */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">4</span>
              Segurança e Acesso Restrito
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              O acesso às funcionalidades internas da plataforma é estritamente controlado por níveis de permissão (como Administrador, Operador, Atendente Connect e Analista Meta). Qualquer tentativa de violar as barreiras de acesso, utilizar scripts não autorizados ou explorar vulnerabilidades acarretará no bloqueio imediato do usuário.
            </p>
          </div>

          {/* Seção 5: Propriedade Intelectual */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center text-sm">5</span>
              Propriedade Intelectual
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Todos os elementos da interface, marcas, nomes comerciais, código-fonte e estrutura da plataforma são de propriedade exclusiva do MandatoPro. É proibida a reprodução, cópia, alteração ou engenharia reversa sem autorização expressa e formal.
            </p>
          </div>

          {/* Seção 6: Alterações e Contato */}
          <div className="bg-slate-800/50 border border-teal-500/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-teal-300 flex items-center gap-3">
              <FontAwesomeIcon icon={faEnvelope} />
              Alterações nos Termos e Contato
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              Estes Termos de Serviço podem ser atualizados periodicamente para refletir melhorias na plataforma ou adequações regulatórias. Dúvidas ou solicitações relacionadas a estes termos podem ser encaminhadas para:
            </p>
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-700/80 inline-block text-teal-400 font-mono font-semibold text-sm md:text-base">
              contato@mandatopro.org
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
