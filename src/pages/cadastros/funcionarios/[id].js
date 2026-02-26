import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar, faUserTie, faClipboardList, faUniversity, faCoins, faMapMarkerAlt, 
  faBullhorn, faCalendarAlt, faBirthdayCake, faFileAlt, faExclamationTriangle, 
  faUsers, faSignOutAlt, faBell, faChevronUp, faChevronDown, faBars, faTimes,
  faSave, faArrowLeft, faUser, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { createClient } from '@supabase/supabase-js';
import { applyMask, formatCurrencyBRL, parseCurrencyBRL } from '@/utils/inputMasks';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const modulos = [
  { nome: 'Dashboard', icone: faChartBar, submenu: [] },
  {
    nome: 'Cadastros',
    icone: faClipboardList,
    submenu: ['Eleitores', 'Lideranças', 'Funcionários', 'Atendimentos']
  },
  {
    nome: 'Emendas',
    icone: faUniversity,
    submenu: ['Órgãos', 'Responsáveis', 'Emendas', 'Repasses', 'Relatórios']
  },
  {
    nome: 'Financeiro',
    icone: faCoins,
    submenu: ['Receitas', 'Despesas', 'Relatórios Financeiros']
  },
  { nome: 'Geolocalização', icone: faMapMarkerAlt, submenu: [] },
  { nome: 'Comunicados', icone: faBullhorn, submenu: [] },
  {
    nome: 'Agenda',
    icone: faCalendarAlt,
    submenu: ['Compromissos', 'Reuniões', 'Eventos']
  },
  { nome: 'Aniversariantes', icone: faBirthdayCake, submenu: [] },
  {
    nome: 'Documentos',
    icone: faFileAlt,
    submenu: ['Ofícios', 'Relatórios', 'Contratos']
  },
  { nome: 'Solicitações', icone: faExclamationTriangle, submenu: [] },
  { nome: 'Usuários', icone: faUsers, submenu: [] },
];

export default function EditarFuncionario() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Funcionários');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Estado do formulário
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    cargo: '',
    departamento: '',
    dataAdmissao: '',
    salario: '',
    cargaHoraria: '',
    tipoContrato: 'CLT',
    matricula: '',
    status: 'ATIVO',
    observacoes: ''
  });

  useEffect(() => {
    setUsuario({ nome: 'Administrador' });
  }, []);

  useEffect(() => {
    if (id) {
      carregarFuncionario();
    }
  }, [id]);

  const carregarFuncionario = async () => {
    setCarregando(true);
    try {
      let { data, error } = await supabase
          .from('funcionarios')
          .select(`
            id, eleitor_id, cargo, departamento, dataAdmissao, salario, 
            cargaHoraria, tipoContrato, matricula, status, observacoes,
            eleitores:eleitor_id (id, nome, cpf, email, telefone)
          `)
          .eq('id', id)
          .single();

      if (error) throw error;

      if (data) {
        setFormData({
          id: data.id,
          nome: data.eleitores?.nome || '',
          cpf: applyMask('cpf', data.eleitores?.cpf || ''),
          email: data.eleitores?.email || '',
          telefone: applyMask('telefone', data.eleitores?.telefone || ''),
          cargo: data.cargo || '',
          departamento: data.departamento || '',
           dataAdmissao: data.dataAdmissao || '',
          salario: formatCurrencyBRL(data.salario || ''),
           cargaHoraria: data.cargaHoraria || '',
           tipoContrato: data.tipoContrato || 'CLT',
          matricula: data.matricula || '',
          status: data.status || 'ATIVO',
          observacoes: data.observacoes || '',
          eleitorId: data.eleitor_id
        });
      }
    } catch (error) {
      console.error('Erro ao carregar funcionário:', error);
      showError('Erro ao carregar dados do funcionário');
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData(prev => ({
      ...prev,
      [name]: maskedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.cargo || !formData.departamento) {
      showWarning('Preencha todos os campos obrigatórios: Cargo e Departamento');
      return;
    }

    setCarregando(true);

    try {
      let { error } = await supabase
        .from('funcionarios')
        .update({
          cargo: formData.cargo,
          departamento: formData.departamento,
          dataAdmissao: formData.dataAdmissao || null,
          salario: parseCurrencyBRL(formData.salario),
          cargaHoraria: formData.cargaHoraria ? parseInt(formData.cargaHoraria) : null,
          tipoContrato: formData.tipoContrato,
          matricula: formData.matricula || null,
          status: formData.status,
          observacoes: formData.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', formData.id);

      if (error) throw error;

      showSuccess('Funcionário atualizado com sucesso!');
      setTimeout(() => {
        router.push('/cadastros/funcionarios');
      }, 2000);
    } catch (error) {
      console.error('Erro ao atualizar funcionário:', error);
      showError('Erro ao atualizar funcionário. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  if (!usuario || carregando) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-teal-50 flex">
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

      {sidebarAberto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      <aside className={`w-64 bg-[#0A4C53] text-white fixed left-0 top-0 min-h-screen z-50 shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarAberto ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:z-auto flex flex-col`}>
        <div className="p-6 flex-1 flex flex-col min-h-screen">
          <div className="flex justify-end mb-4 lg:hidden">
            <button 
              onClick={() => setSidebarAberto(false)}
              className="mt-2.5 text-white hover:text-teal-200"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xl" />
            </button>
          </div>

          <div className="flex items-center justify-center mb-2">
            <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-2xl">🏛️</div>
            <h1 className="text-2xl font-bold ml-3">MandatoPro</h1>
          </div>
          <p className="text-center text-teal-100 text-sm mb-6">SISTEMA DE GESTÃO POLÍTICA</p>
          
          <nav className="space-y-1 flex-1">
            {modulos.map((modulo) => (
              <div key={modulo.nome}>
                <button
                  onClick={() => {
                    setModuloAtivo(modulo.nome);
                    if (modulo.submenu.length > 0) {
                      setMenusAbertos(prev => ({
                        ...prev,
                        [modulo.nome]: !prev[modulo.nome]
                      }));
                    } else {
                      if (modulo.nome === 'Dashboard') {
                        router.push('/dashboard');
                      }
                    }
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                    moduloAtivo === modulo.nome || moduloAtivo.startsWith(modulo.nome)
                      ? 'bg-white text-[#0A4C53] font-bold shadow-md'
                      : 'hover:bg-[#032E35]'
                  } rounded-lg`}
                >
                  <span className="flex items-center gap-3">
                    <FontAwesomeIcon icon={modulo.icone} />
                    {modulo.nome}
                  </span>
                  {modulo.submenu.length > 0 && (
                    <FontAwesomeIcon 
                      icon={menusAbertos[modulo.nome] ? faChevronUp : faChevronDown}
                      className="text-sm"
                    />
                  )}
                </button>
                {modulo.submenu.length > 0 && menusAbertos[modulo.nome] && (
                  <div className="ml-4 mt-1 space-y-1">
                    {modulo.submenu.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          const rota = item.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                          router.push(`/cadastros/${rota}`);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-[#032E35] rounded transition-colors"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-teal-700 pt-4">
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-[#032E35] rounded cursor-pointer transition-colors">
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Sair</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-0">
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarAberto(!sidebarAberto)}
              className="lg:hidden text-[#0A4C53] hover:text-teal-600"
            >
              <FontAwesomeIcon icon={faBars} className="text-2xl" />
            </button>
            <h2 className="text-2xl font-bold text-[#0A4C53]">Editar Funcionário</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative">
              <FontAwesomeIcon icon={faBell} className="text-xl text-gray-600 hover:text-[#0A4C53]" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                {usuario.nome.charAt(0)}
              </div>
              <span className="hidden md:block font-semibold text-gray-700">{usuario.nome}</span>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
            
            {/* Informação de ID */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-blue-700">
                <strong>Editando:</strong> Funcionário ID #{id}
              </p>
            </div>

            {/* INFORMAÇÕES DO ELEITOR (READ-ONLY) */}
            <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border-l-4 border-gray-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-gray-600" />
                INFORMAÇÕES DO ELEITOR
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    name="telefone"
                    value={formData.telefone}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* DADOS PROFISSIONAIS */}
            <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border-l-4 border-teal-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-teal-600" />
                DADOS PROFISSIONAIS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cargo"
                    value={formData.cargo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="departamento"
                    value={formData.departamento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Admissão</label>
                  <input
                    type="date"
                    name="dataAdmissao"
                    value={formData.dataAdmissao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salário</label>
                  <input
                    type="text"
                    name="salario"
                    value={formData.salario}
                    onChange={handleInputChange}
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carga Horária (h/semana)</label>
                  <input
                    type="number"
                    name="cargaHoraria"
                    value={formData.cargaHoraria}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato</label>
                  <select
                    name="tipoContrato"
                    value={formData.tipoContrato}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="TEMPORARIO">Temporário</option>
                    <option value="ESTAGIARIO">Estagiário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="AFASTADO">Afastado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* OBSERVAÇÕES */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Observações..."
              />
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-between">
              <button
                type="button"
                onClick={() => router.push('/cadastros/funcionarios')}
                disabled={carregando}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={carregando}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {carregando ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} />
                    Atualizar Funcionário
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
