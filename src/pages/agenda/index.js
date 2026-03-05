import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt, faPlus, faEdit, faTrash, faEye, faUsers, faMapMarkerAlt, faClock, faFilter, faCheckCircle, faPrint
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@/utils/permissions';
import PDFGenerator from '@/utils/pdfGenerator';
import supabase from '@/lib/supabaseClient';

export default function Agenda() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [busca, setBusca] = useState('');
  const [modalExcluir, setModalExcluir] = useState(false);
  const [eventoParaExcluir, setEventoParaExcluir] = useState(null);

  useEffect(() => {
    carregarEventos();
  }, []);

  const normalizarEvento = (evento) => ({
    ...evento,
    horaInicio: evento.horaInicio || evento.hora_inicio || '',
    horaFim: evento.horaFim || evento.hora_fim || '',
    confirmados: evento.confirmados ?? 0,
    participantes: evento.participantes ?? 0,
    criado_por_id: evento.criado_por_id ?? null
  });

  const carregarEventos = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('agenda_eventos')
        .select('*')
        .order('data', { ascending: true });

      if (error) throw error;

      setEventos((data || []).map(normalizarEvento));
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setCarregando(false);
    }
  };

  const isEventoCampanha = (evento) => {
    return (evento.tipo || '').toUpperCase() === 'EVENTO'
      && (evento.categoria || '').toLowerCase() === 'campanha';
  };

  // Filtrar eventos baseado em permissões
  const eventosFiltrados = eventos.filter(evento => {
    // Filtro de permissão
    if (user?.nivel === 'ADMINISTRADOR') {
      // Admin vê tudo
    } else {
      // Usuários não-admin veem eventos parlamentares e eventos locais criados por eles
      if (evento.tipo === 'LOCAL' && evento.criado_por_id !== user?.id) {
        return false;
      }
    }

    // Filtros de busca
    if (filtroTipo === 'CAMPANHAS' && !isEventoCampanha(evento)) return false;
    if (filtroTipo === 'EVENTOS' && !((evento.tipo || '').toUpperCase() === 'EVENTO' && !isEventoCampanha(evento))) return false;
    if (filtroTipo !== 'TODOS' && filtroTipo !== 'CAMPANHAS' && filtroTipo !== 'EVENTOS' && evento.tipo !== filtroTipo) return false;
    
    const eventoData = new Date(evento.data + 'T00:00:00');
    if (eventoData.getMonth() + 1 !== filtroMes || eventoData.getFullYear() !== filtroAno) return false;

    if (busca && !evento.titulo?.toLowerCase().includes(busca.toLowerCase()) &&
      !evento.local?.toLowerCase().includes(busca.toLowerCase())) return false;

    return true;
  });

  // Agrupar por data
  const eventosAgrupados = eventosFiltrados.reduce((acc, evento) => {
    const data = evento.data;
    if (!acc[data]) acc[data] = [];
    acc[data].push(evento);
    return acc;
  }, {});

  const datasOrdenadas = Object.keys(eventosAgrupados).sort();

  const handleExcluir = (evento) => {
    setEventoParaExcluir(evento);
    setModalExcluir(true);
  };

  const confirmarExclusao = async () => {
    if (!eventoParaExcluir?.id) {
      setModalExcluir(false);
      setEventoParaExcluir(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('agenda_eventos')
        .delete()
        .eq('id', eventoParaExcluir.id);

      if (error) throw error;

      setEventos(eventos.filter(evento => evento.id !== eventoParaExcluir.id));
      setModalExcluir(false);
      setEventoParaExcluir(null);
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      setModalExcluir(false);
      setEventoParaExcluir(null);
    }
  };

  const handleImprimirAgenda = () => {
    try {
      const pdfGenerator = new PDFGenerator();
      pdfGenerator.initDoc();
      
      // Cabeçalho
      const mesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][filtroMes - 1];
      pdfGenerator.addHeader('AGENDA DE EVENTOS', `${mesNome} de ${filtroAno}`);
      
      let yPos = 55;
      
      // Informações do período
      pdfGenerator.doc.setFontSize(11);
      pdfGenerator.doc.setFont('helvetica', 'normal');
      pdfGenerator.doc.setTextColor(100, 100, 100);
      
      const tipoTexto = filtroTipo === 'TODOS' ? 'Todos os Eventos' : 
           filtroTipo === 'PARLAMENTAR' ? 'Agenda Parlamentar' :
           filtroTipo === 'LOCAL' ? 'Agenda Local' :
           filtroTipo === 'CAMPANHAS' ? 'Campanhas' : 'Eventos';
      pdfGenerator.doc.text(`Tipo: ${tipoTexto}`, pdfGenerator.margin, yPos);
      yPos += 6;
      pdfGenerator.doc.text(`Total de Eventos: ${eventosFiltrados.length}`, pdfGenerator.margin, yPos);
      yPos += 12;
      
      // Eventos agrupados por data
      datasOrdenadas.forEach((data, index) => {
        const dataFormatada = formatarData(data);
        const eventosData = eventosAgrupados[data];
        
        // Cabeçalho da data
        pdfGenerator.doc.setFillColor(20, 184, 166);
        pdfGenerator.doc.rect(pdfGenerator.margin, yPos, pdfGenerator.pageWidth - (pdfGenerator.margin * 2), 10, 'F');
        
        pdfGenerator.doc.setFontSize(10);
        pdfGenerator.doc.setFont('helvetica', 'bold');
        pdfGenerator.doc.setTextColor(255, 255, 255);
        pdfGenerator.doc.text(
          `${dataFormatada.dia} de ${dataFormatada.mes} - ${dataFormatada.diaSemana} (${eventosData.length} ${eventosData.length === 1 ? 'evento' : 'eventos'})`,
          pdfGenerator.margin + 3,
          yPos + 7
        );
        
        yPos += 12;
        
        // Eventos do dia
        eventosData.forEach(evento => {
          // Verificar espaço na página
          if (yPos > 250) {
            pdfGenerator.doc.addPage();
            yPos = 20;
          }
          
          // Box do evento
          pdfGenerator.doc.setDrawColor(200, 200, 200);
          pdfGenerator.doc.setLineWidth(0.5);
          pdfGenerator.doc.roundedRect(pdfGenerator.margin, yPos, pdfGenerator.pageWidth - (pdfGenerator.margin * 2), 28, 2, 2, 'D');
          
          // Tipo do evento (badge)
          const badgeColor = evento.tipo === 'PARLAMENTAR'
            ? [59, 130, 246]
            : evento.tipo === 'LOCAL'
              ? [168, 85, 247]
              : [20, 184, 166];
          pdfGenerator.doc.setFillColor(...badgeColor);
          pdfGenerator.doc.roundedRect(pdfGenerator.margin + 3, yPos + 3, 30, 5, 1, 1, 'F');
          pdfGenerator.doc.setFontSize(7);
          pdfGenerator.doc.setFont('helvetica', 'bold');
          pdfGenerator.doc.setTextColor(255, 255, 255);
          const badgeText = evento.tipo === 'PARLAMENTAR'
            ? 'PARLAMENTAR'
            : evento.tipo === 'LOCAL'
              ? 'LOCAL'
              : 'EVENTO';
          pdfGenerator.doc.text(badgeText, pdfGenerator.margin + 18, yPos + 6.5, { align: 'center' });
          
          // Título
          pdfGenerator.doc.setFontSize(11);
          pdfGenerator.doc.setFont('helvetica', 'bold');
          pdfGenerator.doc.setTextColor(0, 0, 0);
          const titulo = pdfGenerator.doc.splitTextToSize(evento.titulo, 140);
          pdfGenerator.doc.text(titulo, pdfGenerator.margin + 3, yPos + 12);
          
          // Horário
          pdfGenerator.doc.setFontSize(9);
          pdfGenerator.doc.setFont('helvetica', 'normal');
          pdfGenerator.doc.setTextColor(100, 100, 100);
          pdfGenerator.doc.text(`Horario: ${evento.horaInicio} - ${evento.horaFim}`, pdfGenerator.margin + 3, yPos + 18);
          
          // Local
          const localTexto = pdfGenerator.doc.splitTextToSize(evento.local, 90);
          pdfGenerator.doc.text(`Local: ${localTexto[0]}`, pdfGenerator.margin + 3, yPos + 23);
          
          // Participantes
          pdfGenerator.doc.text(`Participantes: ${evento.confirmados}/${evento.participantes} confirmados`, pdfGenerator.margin + 110, yPos + 23);
          
          yPos += 32;
        });
        
        yPos += 5;
      });
      
      // Rodapé
      pdfGenerator.addFooter();
      
      // Salvar
      pdfGenerator.doc.save(`agenda-${mesNome}-${filtroAno}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar relatório da agenda');
    }
  };

  const formatarData = (dataStr) => {
    const data = new Date(dataStr + 'T00:00:00');
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      diaSemana: dias[data.getDay()],
      dia: data.getDate(),
      mes: meses[data.getMonth()],
      ano: data.getFullYear()
    };
  };

  if (carregando) {
    return (
      <ProtectedRoute module={MODULES.AGENDA}>
        <Layout titulo="Agenda">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Carregando eventos...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute module={MODULES.AGENDA}>
      <Layout titulo="Agenda">
        {/* Header com Filtros */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-teal-600 text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Agenda de Eventos</h2>
                <p className="text-sm text-gray-600">
                  {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'evento' : 'eventos'} no período
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImprimirAgenda}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPrint} />
                Imprimir Agenda
              </button>
              <button
                onClick={() => window.location.href = '/agenda/novo'}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPlus} />
                Novo Evento
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FontAwesomeIcon icon={faFilter} className="mr-2" />
                TIPO
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="TODOS">Todos os Eventos</option>
                <option value="PARLAMENTAR">Agenda Parlamentar</option>
                <option value="LOCAL">Agenda Local</option>
                <option value="CAMPANHAS">Campanhas</option>
                <option value="EVENTOS">Eventos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">MÊS</label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mes, i) => (
                  <option key={i} value={i + 1}>{mes}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ANO</label>
              <select
                value={filtroAno}
                onChange={(e) => setFiltroAno(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {[2024, 2025, 2026].map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">BUSCAR</label>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Título ou local..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Timeline Layout - Vertical */}
        {datasOrdenadas.length > 0 ? (
          <div className="relative">
            {/* Linha do Tempo Vertical */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-400 via-teal-500 to-teal-600 hidden lg:block"></div>
            
            <div className="space-y-8">
              {datasOrdenadas.map((data, dataIndex) => {
                const dataFormatada = formatarData(data);
                return (
                  <div key={data} className="relative">
                    {/* Data Marker */}
                    <div className="flex items-start gap-4 lg:gap-6">
                      {/* Box de Data */}
                      <div className="flex-shrink-0 relative z-10">
                        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-2xl shadow-xl p-3 lg:p-4 w-16 lg:w-20 text-center transform hover:scale-105 transition-transform">
                          <div className="text-2xl lg:text-3xl font-bold leading-none">{dataFormatada.dia}</div>
                          <div className="text-xs lg:text-sm font-semibold uppercase mt-1">{dataFormatada.mes}</div>
                          <div className="text-xs mt-1 opacity-90">{dataFormatada.ano}</div>
                        </div>
                      </div>

                      {/* Eventos do Dia */}
                      <div className="flex-1 space-y-4">
                        {/* Header da Data */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-teal-500 p-4">
                          <div className="font-bold text-lg text-gray-800">{dataFormatada.diaSemana}</div>
                          <div className="text-sm text-gray-600">
                            {eventosAgrupados[data].length} {eventosAgrupados[data].length === 1 ? 'evento agendado' : 'eventos agendados'}
                          </div>
                        </div>

                        {/* Lista de Eventos */}
                        <div className="space-y-3">
                          {eventosAgrupados[data].map((evento, eventoIndex) => (
                            <div
                              key={evento.id}
                              className="bg-white rounded-xl shadow-md border-l-4 hover:shadow-xl transition-all duration-300 overflow-hidden group"
                              style={{
                                borderLeftColor: evento.tipo === 'PARLAMENTAR'
                                  ? '#3b82f6'
                                  : evento.tipo === 'LOCAL'
                                    ? '#a855f7'
                                    : isEventoCampanha(evento)
                                      ? '#059669'
                                      : '#14b8a6'
                              }}
                            >
                              <div className="p-4">
                                {/* Header com Título e Badge */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex-1">
                                    {(() => {
                                      const isCampanha = isEventoCampanha(evento);
                                      const tipoBadgeClass = evento.tipo === 'PARLAMENTAR'
                                        ? 'bg-blue-100 text-blue-700'
                                        : evento.tipo === 'LOCAL'
                                          ? 'bg-purple-100 text-purple-700'
                                          : isCampanha
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-teal-100 text-teal-700';
                                      const tipoBadgeText = evento.tipo === 'PARLAMENTAR'
                                        ? '📍 PARLAMENTAR'
                                        : evento.tipo === 'LOCAL'
                                          ? '📌 LOCAL'
                                          : isCampanha
                                            ? '🏛️ CAMPANHA'
                                            : '🎯 EVENTO';
                                      const categoriaClass = isCampanha
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-100 text-gray-700';
                                      const categoriaText = isCampanha
                                        ? 'Campanha'
                                        : (evento.categoria || 'Evento');

                                      return (
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${tipoBadgeClass}`}>
                                            {tipoBadgeText}
                                          </span>
                                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${categoriaClass}`}>
                                            {categoriaText}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-teal-600 transition-colors">
                                      {evento.titulo}
                                    </h3>
                                  </div>
                                  
                                  {/* Botões de Ação */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => window.location.href = `/agenda/${evento.id}`}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Ver detalhes"
                                    >
                                      <FontAwesomeIcon icon={faEye} className="text-sm" />
                                    </button>
                                    {(user?.nivel === 'ADMINISTRADOR' || evento.criado_por_id === user?.id) && (
                                      <>
                                        <button
                                          onClick={() => window.location.href = `/agenda/novo?id=${evento.id}`}
                                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                          title="Editar"
                                        >
                                          <FontAwesomeIcon icon={faEdit} className="text-sm" />
                                        </button>
                                        <button
                                          onClick={() => handleExcluir(evento)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Excluir"
                                        >
                                          <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Informações em Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
                                  {/* Horário */}
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <FontAwesomeIcon icon={faClock} className="text-teal-600" />
                                    </div>
                                    <div>
                                      <div className="text-xs text-gray-500 font-medium">HORÁRIO</div>
                                      <div className="text-sm font-bold text-gray-800">
                                        {evento.horaInicio} - {evento.horaFim}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Participantes */}
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <FontAwesomeIcon icon={faUsers} className="text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-xs text-gray-500 font-medium">CONFIRMADOS</div>
                                      <div className="text-sm font-bold text-gray-800">
                                        {evento.confirmados}/{evento.participantes} lideranças
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = `/agenda/${evento.id}`;
                                      }}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                      title="Ver lista completa"
                                    >
                                      Ver Lista
                                    </button>
                                  </div>
                                </div>

                                {/* Local */}
                                <div className="mt-3 flex items-start gap-2 bg-gradient-to-r from-teal-50 to-transparent rounded-lg p-3">
                                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600 mt-1" />
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium mb-1">LOCAL</div>
                                    <div className="text-sm text-gray-800 font-medium">{evento.local}</div>
                                  </div>
                                </div>

                                {/* Barra de Progresso de Confirmação */}
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Taxa de Confirmação</span>
                                    <span className="font-bold">
                                      {evento.participantes > 0
                                        ? Math.round((evento.confirmados / evento.participantes) * 100)
                                        : 0}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-teal-500 to-teal-600 h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${evento.participantes > 0
                                          ? (evento.confirmados / evento.participantes) * 100
                                          : 0}%`
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-600 mb-2">Nenhum evento encontrado</h3>
            <p className="text-gray-500 mb-6">
              Não há eventos cadastrados para o período selecionado.
            </p>
            <button
              onClick={() => window.location.href = '/agenda/novo'}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
              Criar Primeiro Evento
            </button>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        <Modal
          isOpen={modalExcluir}
          onClose={() => setModalExcluir(false)}
          onConfirm={confirmarExclusao}
          title="Excluir Evento"
          message={`Tem certeza que deseja excluir o evento "${eventoParaExcluir?.titulo}"? Esta ação não pode ser desfeita.`}
          type="confirm"
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          showCancel={true}
        />
      </Layout>
    </ProtectedRoute>
  );
}
