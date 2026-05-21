import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const somenteDigitos = (valor = '') => String(valor).replace(/\D/g, '');

const aplicarMascaraCPF = (valor = '') => {
  const cpf = somenteDigitos(valor).slice(0, 11);
  return cpf
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatarData = (valor) => {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
};

const statusEstilo = {
  AGENDADO: 'bg-blue-100 text-blue-800 border-blue-200',
  REALIZADO: 'bg-green-100 text-green-800 border-green-200',
  CANCELADO: 'bg-red-100 text-red-800 border-red-200'
};

export default function HistoricoAtendimentoPublico() {
  const router = useRouter();

  const [protocolo, setProtocolo] = useState('');
  const [atendimentoRef, setAtendimentoRef] = useState('');
  const [eleitorRef, setEleitorRef] = useState('');
  const [cpf, setCpf] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [consultaAutomaticaRealizada, setConsultaAutomaticaRealizada] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const protocoloQuery = String(router.query?.protocolo || '').trim();
    const atendimentoQuery = String(router.query?.aid || '').trim();
    const eleitorQuery = String(router.query?.eid || '').trim();
    if (protocoloQuery) {
      setProtocolo(protocoloQuery);
    }
    if (atendimentoQuery) {
      setAtendimentoRef(atendimentoQuery);
    }
    if (eleitorQuery) {
      setEleitorRef(eleitorQuery);
    }
  }, [router.isReady, router.query]);

  const historicoOrdenado = useMemo(() => {
    if (!resultado?.historico) return [];
    return [...resultado.historico].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return aDate - bDate;
    });
  }, [resultado]);

  const consultarAtendimento = async ({ protocoloValor, cpfValor, atendimentoIdValor, eleitorIdValor }) => {
    const protocoloNormalizado = String(protocoloValor || '').trim();
    const cpfNormalizado = somenteDigitos(cpfValor || '');
    const atendimentoIdNormalizado = String(atendimentoIdValor || '').trim();
    const eleitorIdNormalizado = String(eleitorIdValor || '').trim();
    const possuiIdentificacaoQr = Boolean(protocoloNormalizado && atendimentoIdNormalizado && eleitorIdNormalizado);

    if (!protocoloNormalizado) {
      setErro('Informe o protocolo do atendimento.');
      setResultado(null);
      return;
    }

    if (!possuiIdentificacaoQr && cpfNormalizado.length !== 11) {
      setErro('Informe um CPF valido com 11 digitos.');
      setResultado(null);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      const response = await fetch(
        `/api/public/atendimentos/historico?protocolo=${encodeURIComponent(protocoloNormalizado)}&cpf=${encodeURIComponent(cpfNormalizado)}&aid=${encodeURIComponent(atendimentoIdNormalizado)}&eid=${encodeURIComponent(eleitorIdNormalizado)}`
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel consultar este atendimento.');
      }

      setResultado(payload);
    } catch (requestError) {
      setResultado(null);
      setErro(requestError.message || 'Erro ao consultar atendimento.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (consultaAutomaticaRealizada) return;

    const protocoloQuery = String(router.query?.protocolo || '').trim();
    const atendimentoQuery = String(router.query?.aid || '').trim();
    const eleitorQuery = String(router.query?.eid || '').trim();

    if (!protocoloQuery || !atendimentoQuery || !eleitorQuery) return;

    setConsultaAutomaticaRealizada(true);
    consultarAtendimento({
      protocoloValor: protocoloQuery,
      cpfValor: '',
      atendimentoIdValor: atendimentoQuery,
      eleitorIdValor: eleitorQuery
    });
  }, [router.isReady, router.query, consultaAutomaticaRealizada]);

  const handleConsultar = async (event) => {
    event.preventDefault();
    await consultarAtendimento({
      protocoloValor: protocolo,
      cpfValor: cpf,
      atendimentoIdValor: atendimentoRef,
      eleitorIdValor: eleitorRef
    });
  };

  return (
    <>
      <Head>
        <title>Acompanhamento de Atendimento | MandatoPro</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-slate-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0A4C53] text-white px-6 py-6">
              <h1 className="text-2xl md:text-3xl font-bold">Acompanhar Atendimento</h1>
              <p className="text-teal-100 mt-2 text-sm md:text-base">
                Ao acessar pelo QR Code o status abre automaticamente. Se preferir, consulte manualmente por protocolo e CPF.
              </p>
            </div>

            <div className="p-6 md:p-8">
              <form onSubmit={handleConsultar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Protocolo</label>
                  <input
                    type="text"
                    value={protocolo}
                    onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                    placeholder="Ex.: ATD-123456-ABCDEF"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={carregando}
                    className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 font-semibold"
                  >
                    {carregando ? 'Consultando...' : 'Consultar Historico'}
                  </button>
                </div>
              </form>

              {erro && (
                <div className="mt-5 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                  {erro}
                </div>
              )}

              {resultado && (
                <section className="mt-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">PROTOCOLO</p>
                      <p className="text-base font-bold text-slate-800">{resultado.protocolo}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">STATUS ATUAL</p>
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${statusEstilo[resultado.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        {resultado.status || '-'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">ELEITOR</p>
                      <p className="text-base font-semibold text-slate-800">{resultado.eleitor?.nome || '-'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">ATENDIMENTO</p>
                      <p className="text-base font-semibold text-slate-800">#{resultado.id || '-'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">CODIGO DO ELEITOR</p>
                      <p className="text-base font-semibold text-slate-800">#{resultado.eleitor?.id || '-'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">DATA DO ATENDIMENTO</p>
                      <p className="text-base font-semibold text-slate-800">{formatarData(resultado.data_atendimento)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                      <h2 className="font-bold text-slate-700">Historico</h2>
                    </div>

                    <div className="p-4 space-y-3">
                      {historicoOrdenado.length === 0 ? (
                        <p className="text-sm text-slate-500">Sem movimentacoes de historico para este atendimento.</p>
                      ) : (
                        historicoOrdenado.map((item) => (
                          <div key={item.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${statusEstilo[item.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                              >
                                {item.status || '-'}
                              </span>
                              <span className="text-xs text-slate-500">{formatarData(item.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-700">{item.observacao || 'Sem observacao.'}</p>
                            <p className="text-xs text-slate-500 mt-2">Atualizado por: {item.usuario_nome || 'Sistema'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
