import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUniversity, faUsers, faExclamationTriangle, faBullhorn, faCalendarAlt, faBirthdayCake, faTrophy, faEye, faCheckCircle, faTimesCircle, faClock, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { getDashboardStats } from '../data/mockData';

export default function Dashboard() {
  const { user } = useAuth();
  const [usuario, setUsuario] = useState(null);
  const stats = getDashboardStats();
  
  // Carrega usuário do localStorage
  useEffect(() => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);
  }, []);
  
  // Registra acesso ao dashboard
  useRegistrarAcesso(usuario, 'DASHBOARD', 'Dashboard');
  
  // Mock de últimas solicitações
  const solicitacoes = [
    { id: 1, protocolo: 'SOL-2025-001', titulo: 'Reparo de via pública', solicitante: 'João Silva', status: 'NOVA', prioridade: 'ALTA', data: '2025-11-20', liderancaId: 1 },
    { id: 2, protocolo: 'SOL-2025-002', titulo: 'Iluminação pública', solicitante: 'Maria Santos', status: 'EM_ANDAMENTO', prioridade: 'MÉDIA', data: '2025-11-19', liderancaId: 1 },
    { id: 3, protocolo: 'SOL-2025-003', titulo: 'Coleta de lixo', solicitante: 'Pedro Costa', status: 'ATENDIDA', prioridade: 'BAIXA', data: '2025-11-18', liderancaId: 2 },
    { id: 4, protocolo: 'SOL-2025-004', titulo: 'Poda de árvores', solicitante: 'Ana Oliveira', status: 'NOVA', prioridade: 'URGENTE', data: '2025-11-21', liderancaId: 2 },
  ];
  
  // Filtrar solicitações baseado no perfil
  const solicitacoesFiltradas = user?.nivel === 'ADMINISTRADOR' 
    ? solicitacoes 
    : user?.nivel === 'LIDERANCA'
    ? solicitacoes.filter(s => s.liderancaId === user?.liderancaId)
    : [];
  
  const mostrarSolicitacoes = user?.nivel !== 'OPERADOR';
  
  // Mock de próximos eventos da agenda
  const proximosEventos = [
    { id: 1, titulo: 'Reunião com Líderes', data: '2025-11-25', horaInicio: '14:00', local: 'Salão Paroquial', tipo: 'PARLAMENTAR' },
    { id: 2, titulo: 'Inauguração Praça', data: '2025-11-28', horaInicio: '10:00', local: 'Praça da Juventude', tipo: 'PARLAMENTAR' },
    { id: 3, titulo: 'Atendimento à População', data: '2025-11-26', horaInicio: '09:00', local: 'Associação de Moradores', tipo: 'LOCAL' },
  ];
  
  // Filtrar eventos baseado no perfil
  const eventosFiltrados = user?.nivel === 'ADMINISTRADOR' 
    ? proximosEventos 
    : user?.nivel === 'LIDERANCA'
    ? proximosEventos
    : user?.nivel === 'OPERADOR'
    ? proximosEventos
    : [];

  return (
    <Layout titulo="Bem-vindo ao Dashboard!">
      {/* Grid Principal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-teal-400">
          <FontAwesomeIcon icon={faUsers} className="text-2xl lg:text-3xl text-teal-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Eleitores Cadastrados</div>
          <div className="text-3xl lg:text-4xl font-bold text-teal-800 mt-2">{stats.totalEleitores}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-yellow-400">
          <FontAwesomeIcon icon={faUsers} className="text-2xl lg:text-3xl text-yellow-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Lideranças Cadastradas</div>
          <div className="text-3xl lg:text-4xl font-bold text-yellow-800 mt-2">{stats.totalLiderancas}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-green-400">
          <FontAwesomeIcon icon={faUniversity} className="text-2xl lg:text-3xl text-green-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Emendas Ativas</div>
          <div className="text-3xl lg:text-4xl font-bold text-green-800 mt-2">{stats.emendasAtivas}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border-b-4 border-red-400">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl lg:text-3xl text-red-700 mb-2" />
          <div className="text-gray-700 text-sm lg:text-base">Solicitações Recebidas</div>
          <div className="text-3xl lg:text-4xl font-bold text-red-800 mt-2">{stats.totalAtendimentos}</div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mt-6 lg:mt-8">
        {/* Próximos Eventos - Design Calendário */}
        <div className="bg-gradient-to-br from-teal-50 via-white to-blue-50 rounded-2xl shadow-xl p-5 lg:p-6 border-2 border-teal-200">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Próximos Eventos</h3>
                <p className="text-xs text-gray-500">Sua agenda esta semana</p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/agenda'}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              Ver Agenda
            </button>
          </div>
          
          <div className="space-y-3">
            {eventosFiltrados.slice(0, 3).map((evento) => {
              const dataEvento = new Date(evento.data + 'T00:00:00');
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const diffTime = dataEvento - hoje;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const dia = dataEvento.getDate();
              const mes = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][dataEvento.getMonth()];
              const diaSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][dataEvento.getDay()];
              
              let urgenciaLabel = '';
              let urgenciaColor = '';
              if (diffDays === 0) {
                urgenciaLabel = 'HOJE';
                urgenciaColor = 'bg-red-500 text-white';
              } else if (diffDays === 1) {
                urgenciaLabel = 'AMANHÃ';
                urgenciaColor = 'bg-orange-500 text-white';
              } else if (diffDays <= 3) {
                urgenciaLabel = `${diffDays} DIAS`;
                urgenciaColor = 'bg-yellow-500 text-white';
              } else {
                urgenciaLabel = `${diffDays} DIAS`;
                urgenciaColor = 'bg-gray-400 text-white';
              }
              
              return (
                <div 
                  key={evento.id} 
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group border-l-4"
                  style={{
                    borderLeftColor: evento.tipo === 'PARLAMENTAR' ? '#3b82f6' : '#a855f7'
                  }}
                  onClick={() => window.location.href = `/agenda/${evento.id}`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Mini Calendário */}
                      <div className="flex-shrink-0">
                        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden shadow-sm w-14 text-center">
                          <div className="bg-red-600 text-white text-xs font-bold py-1">{mes}</div>
                          <div className="py-2">
                            <div className="text-2xl font-bold text-gray-800 leading-none">{dia}</div>
                            <div className="text-xs text-gray-500 font-semibold mt-1">{diaSemana}</div>
                          </div>
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${urgenciaColor}`}>
                              {urgenciaLabel}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              evento.tipo === 'PARLAMENTAR' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {evento.tipo === 'PARLAMENTAR' ? '📍 Parlamentar' : '📌 Local'}
                            </span>
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-gray-800 text-sm group-hover:text-teal-600 transition-colors mb-2 line-clamp-2">
                          {evento.titulo}
                        </h4>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faClock} className="text-teal-600" />
                            <span className="font-semibold">{evento.horaInicio}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-teal-600" />
                            <span className="truncate">{evento.local}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <FontAwesomeIcon icon={faUsers} className="text-teal-600" />
                            <span><span className="font-bold text-teal-700">{evento.confirmados}</span>/{evento.participantes} confirmados</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {eventosFiltrados.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhum evento agendado</p>
                <button
                  onClick={() => window.location.href = '/agenda/novo'}
                  className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Criar Evento
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Últimas Solicitações */}
        {mostrarSolicitacoes && (
          <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} /> ÚLTIMAS SOLICITAÇÕES
              </h3>
              <button 
                onClick={() => window.location.href = '/solicitacoes'}
                className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
              >
                Ver todas →
              </button>
            </div>
            <div className="space-y-2">
              {solicitacoesFiltradas.slice(0, 4).map((sol) => {
                const statusConfig = {
                  'NOVA': { icon: faClock, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-500', texto: 'Nova' },
                  'EM_ANDAMENTO': { icon: faClock, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-500', texto: 'Em Andamento' },
                  'ATENDIDA': { icon: faCheckCircle, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-500', texto: 'Atendida' },
                  'RECUSADA': { icon: faTimesCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-500', texto: 'Recusada' }
                };
                const config = statusConfig[sol.status] || statusConfig['NOVA'];
                
                return (
                  <div key={sol.id} className={`flex items-center gap-2 text-xs lg:text-sm p-2 ${config.bg} rounded-lg hover:shadow-md transition-shadow cursor-pointer`}
                    onClick={() => window.location.href = `/solicitacoes/${sol.id}`}>
                    <span className={`${config.badge} text-white px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap`}>
                      {config.texto}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{sol.titulo}</div>
                      <div className="text-xs text-gray-600">{sol.protocolo} • {sol.solicitante}</div>
                    </div>
                  </div>
                );
              })}
              {solicitacoesFiltradas.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2 text-gray-300" />
                  <p>Nenhuma solicitação recente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aniversariantes */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-bold text-teal-700 flex items-center gap-2">
              <FontAwesomeIcon icon={faBirthdayCake} /> ANIVERSARIANTES
            </h3>
            <button 
              onClick={() => window.location.href = '/aniversariantes'}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
            >
              Ver todos →
            </button>
          </div>
          <div className="space-y-3">
            {stats.proximosAniversariantes?.slice(0, 5).map((pessoa) => {
              const hoje = new Date();
              const aniversario = new Date(hoje.getFullYear(), pessoa.mes - 1, pessoa.dia);
              if (aniversario < hoje) {
                aniversario.setFullYear(hoje.getFullYear() + 1);
              }
              const diffTime = aniversario - hoje;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              const isHoje = diffDays === 0;
              const isAmanha = diffDays === 1;
              
              return (
                <div key={`${pessoa.tipo}-${pessoa.id}`} className={`p-2 rounded-lg ${isHoje ? 'bg-pink-50 border-2 border-pink-300' : 'bg-teal-50'}`}>
                  <div className="flex items-center gap-2">
                    {pessoa.foto ? (
                      <img src={pessoa.foto} alt={pessoa.nome} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">
                          {pessoa.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">{pessoa.nome}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">
                          {pessoa.dia}/{pessoa.mes}
                        </span>
                        {isHoje && (
                          <span className="bg-pink-500 text-white px-1.5 py-0.5 rounded-full font-semibold text-xs">
                            🎉 HOJE!
                          </span>
                        )}
                        {isAmanha && (
                          <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-semibold text-xs">
                            Amanhã
                          </span>
                        )}
                        {!isHoje && !isAmanha && (
                          <span className="text-teal-600">
                            {diffDays} {diffDays === 1 ? 'dia' : 'dias'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => window.location.href = `/comunicacao?userId=${pessoa.id}`}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-all hover:scale-105 shadow-sm"
                      title="Enviar mensagem no WhatsApp"
                    >
                      <FontAwesomeIcon icon={faWhatsapp} className="text-base" />
                      <span className="text-xs font-semibold">Mensagem</span>
                    </button>
                  </div>
                </div>
              );
            })}
            {(!stats.proximosAniversariantes || stats.proximosAniversariantes.length === 0) && (
              <div className="text-center py-6 text-gray-500 text-sm">
                <FontAwesomeIcon icon={faBirthdayCake} className="text-3xl mb-2 text-gray-300" />
                <p>Nenhum aniversariante nos próximos dias</p>
              </div>
            )}
          </div>
        </div>

        {/* Eleitores */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <h3 className="text-base lg:text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faUsers} /> Eleitores
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Total Cadastrados</span>
              <span className="text-lg lg:text-xl font-bold text-teal-600">{stats.totalEleitores}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Total Ativos</span>
              <span className="text-lg lg:text-xl font-bold text-green-600">{stats.eleitoresAtivos}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Total Inativos</span>
              <span className="text-lg lg:text-xl font-bold text-red-600">{stats.eleitoresInativos}</span>
            </div>
          </div>
        </div>

        {/* Métricas do Mandato */}
        <div className="bg-white rounded-xl shadow-lg p-4 lg:p-6 border border-teal-100">
          <h3 className="text-base lg:text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faTrophy} /> Métricas do Mandato
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Lideranças Ativas</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">{stats.liderancasAtivas}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Regiões alcançadas</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">0</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Atendimentos realizados</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">{stats.atendimentosConcluidos}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
              <span className="text-xs lg:text-sm font-semibold text-gray-700">Benefícios</span>
              <span className="text-lg lg:text-xl font-bold text-teal-700">0</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
