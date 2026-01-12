import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBirthdayCake, faSearch, faFilter, faCog, faEnvelope,
  faCalendarDay, faCalendarWeek, faCalendarAlt, faClock, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { getDashboardStats } from '@/data/mockData';
import { useNotifications } from '@/contexts/NotificationContext';

export default function Aniversariantes() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess } = useModal();
  const { addNotification } = useNotifications();
  
  const [busca, setBusca] = useState('');
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos, hoje, semana, mes
  
  const stats = getDashboardStats();
  const aniversariantes = stats.proximosAniversariantes || [];

  const meses = [
    { valor: '', nome: 'Todos os Meses' },
    { valor: 1, nome: 'Janeiro' },
    { valor: 2, nome: 'Fevereiro' },
    { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' },
    { valor: 5, nome: 'Maio' },
    { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' },
    { valor: 8, nome: 'Agosto' },
    { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' },
    { valor: 11, nome: 'Novembro' },
    { valor: 12, nome: 'Dezembro' }
  ];

  const aniversariantesFiltrados = aniversariantes.filter(pessoa => {
    // Filtro de busca
    const matchBusca = pessoa.nome.toLowerCase().includes(busca.toLowerCase());
    
    // Filtro de mês
    const matchMes = mesSelecionado === '' || pessoa.mes === parseInt(mesSelecionado);
    
    // Filtro de período
    let matchPeriodo = true;
    if (filtro === 'hoje') {
      matchPeriodo = pessoa.diasAte === 0;
    } else if (filtro === 'semana') {
      matchPeriodo = pessoa.diasAte <= 7;
    } else if (filtro === 'mes') {
      matchPeriodo = pessoa.diasAte <= 30;
    }
    
    return matchBusca && matchMes && matchPeriodo;
  });

  const handleEnviarMensagem = (pessoa) => {
    // Simular envio de mensagem
    showSuccess(`Mensagem de aniversário enviada para ${pessoa.nome}!`);
    
    // Adicionar notificação
    addNotification({
      title: 'Mensagem Enviada',
      message: `Parabéns enviado para ${pessoa.nome}`,
      type: 'success'
    });
  };

  const handleConfiguracoes = () => {
    router.push('/aniversariantes/configuracoes');
  };

  return (
    <Layout titulo="Aniversariantes">
      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
            filtro === 'hoje' ? 'border-pink-500 bg-pink-50' : 'border-pink-300'
          }`}
          onClick={() => setFiltro(filtro === 'hoje' ? 'todos' : 'hoje')}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faCalendarDay} className="text-pink-600 text-xl" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.aniversariantesHoje || 0}</div>
              <div className="text-sm text-gray-600">Hoje</div>
            </div>
          </div>
        </div>

        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
            filtro === 'semana' ? 'border-purple-500 bg-purple-50' : 'border-purple-300'
          }`}
          onClick={() => setFiltro(filtro === 'semana' ? 'todos' : 'semana')}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faCalendarWeek} className="text-purple-600 text-xl" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.aniversariantesSemana || 0}</div>
              <div className="text-sm text-gray-600">Esta Semana</div>
            </div>
          </div>
        </div>

        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
            filtro === 'mes' ? 'border-blue-500 bg-blue-50' : 'border-blue-300'
          }`}
          onClick={() => setFiltro(filtro === 'mes' ? 'todos' : 'mes')}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-600 text-xl" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{stats.aniversariantesMes || 0}</div>
              <div className="text-sm text-gray-600">Este Mês</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-teal-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faBirthdayCake} className="text-teal-600 text-xl" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{aniversariantes.length}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar aniversariante..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          
          <div className="lg:w-64">
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              {meses.map(mes => (
                <option key={mes.valor} value={mes.valor}>{mes.nome}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConfiguracoes}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faCog} />
            Configurações
          </button>
        </div>

        {filtro !== 'todos' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">Filtro ativo:</span>
            <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-semibold">
              {filtro === 'hoje' && 'Aniversariantes de Hoje'}
              {filtro === 'semana' && 'Próximos 7 Dias'}
              {filtro === 'mes' && 'Próximos 30 Dias'}
            </span>
            <button
              onClick={() => setFiltro('todos')}
              className="text-sm text-red-600 hover:text-red-700 font-semibold"
            >
              Limpar filtro
            </button>
          </div>
        )}
      </div>

      {/* Lista de Aniversariantes */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aniversariante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Idade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {aniversariantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FontAwesomeIcon icon={faBirthdayCake} className="text-5xl text-gray-300" />
                      <p className="text-gray-500 text-lg">Nenhum aniversariante encontrado</p>
                      <p className="text-gray-400 text-sm">
                        {filtro !== 'todos' && 'Tente ajustar os filtros ou limpar a busca'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                aniversariantesFiltrados.map((pessoa) => {
                  const isHoje = pessoa.diasAte === 0;
                  const isAmanha = pessoa.diasAte === 1;
                  
                  return (
                    <tr 
                      key={`${pessoa.tipo}-${pessoa.id}`}
                      className={`hover:bg-gray-50 ${isHoje ? 'bg-pink-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {pessoa.foto ? (
                            <img 
                              src={pessoa.foto} 
                              alt={pessoa.nome} 
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {pessoa.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{pessoa.nome}</div>
                            <div className="text-xs text-gray-500">{pessoa.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {String(pessoa.dia).padStart(2, '0')}/{String(pessoa.mes).padStart(2, '0')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isHoje ? (
                            <span className="text-pink-600 font-semibold">🎉 Hoje!</span>
                          ) : isAmanha ? (
                            <span className="text-purple-600 font-semibold">Amanhã</span>
                          ) : (
                            `Em ${pessoa.diasAte} ${pessoa.diasAte === 1 ? 'dia' : 'dias'}`
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pessoa.idade} anos
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          pessoa.tipo === 'eleitor' ? 'bg-blue-100 text-blue-800' :
                          pessoa.tipo === 'lideranca' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {pessoa.tipo === 'eleitor' ? 'Eleitor' :
                           pessoa.tipo === 'lideranca' ? 'Liderança' :
                           'Funcionário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isHoje ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-pink-100 text-pink-800">
                            <FontAwesomeIcon icon={faBirthdayCake} className="mr-1" />
                            Aniversário
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            <FontAwesomeIcon icon={faClock} className="mr-1" />
                            Aguardando
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEnviarMensagem(pessoa)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
                            title="Enviar via WhatsApp"
                          >
                            <FontAwesomeIcon icon={faWhatsapp} />
                            Enviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé com contagem */}
      <div className="mt-4 text-sm text-gray-600 text-center">
        Mostrando {aniversariantesFiltrados.length} de {aniversariantes.length} aniversariantes
      </div>
    </Layout>
  );
}
