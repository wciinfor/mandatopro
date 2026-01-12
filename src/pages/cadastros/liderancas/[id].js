import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar, faUserTie, faClipboardList, faUniversity, faCoins, faMapMarkerAlt, 
  faBullhorn, faCalendarAlt, faBirthdayCake, faFileAlt, faExclamationTriangle, 
  faUsers, faSignOutAlt, faBell, faChevronUp, faChevronDown, faBars, faTimes,
  faSave, faArrowLeft, faUser
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';

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

export default function EditarLideranca() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [usuario, setUsuario] = useState(null);
  const [moduloAtivo, setModuloAtivo] = useState('Cadastros - Lideranças');
  const [menusAbertos, setMenusAbertos] = useState({ Cadastros: true });
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [formData, setFormData] = useState({
    foto: null,
    tipo: 'LOCAL',
    nome: '',
    nomeSocial: '',
    cpf: '',
    rg: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    observacoes: ''
  });

  useEffect(() => {
    setUsuario({ nome: 'Administrador' });
  }, []);

  useEffect(() => {
    if (id) {
      // Simulando dados mockados
      const dadosMock = {
        id: id,
        foto: null,
        tipo: 'LOCAL',
        nome: 'Maria Santos',
        nomeSocial: 'Maria',
        cpf: '987.654.321-00',
        celular: '(11) 99999-8888',
        cidade: 'São Paulo',
        uf: 'SP',
        bairro: 'Centro'
      };
      
      setFormData(dadosMock);
      setCarregando(false);
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showWarning('Por favor, selecione apenas arquivos de imagem.');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        showWarning('A imagem deve ter no máximo 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
        setFormData(prev => ({ ...prev, foto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removerFoto = () => {
    setFotoPreview(null);
    setFormData(prev => ({ ...prev, foto: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Dados atualizados:', formData);
    showSuccess('Liderança atualizada com sucesso!', () => {
      router.push('/cadastros/liderancas');
    });
  };

  if (!usuario || carregando) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-purple-50 flex">
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
            <h2 className="text-2xl font-bold text-[#0A4C53]">Editar Liderança</h2>
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
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6">
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-blue-700">
                <strong>Editando:</strong> Liderança ID #{id}
              </p>
            </div>

            {/* Tipo de Liderança */}
            <div className="mb-6 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="LOCAL"
                  checked={formData.tipo === 'LOCAL'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-teal-600"
                />
                <span className="font-semibold text-gray-700">Liderança Local</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="REGIONAL"
                  checked={formData.tipo === 'REGIONAL'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-teal-600"
                />
                <span className="font-semibold text-gray-700">Liderança Regional</span>
              </label>
            </div>

            {/* Dados Pessoais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Social
                </label>
                <input
                  type="text"
                  name="nomeSocial"
                  value={formData.nomeSocial}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPF
                </label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Celular
                </label>
                <input
                  type="tel"
                  name="celular"
                  value={formData.celular}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  UF
                </label>
                <input
                  type="text"
                  name="uf"
                  value={formData.uf}
                  onChange={handleInputChange}
                  maxLength="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bairro
                </label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Upload de Foto */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-l-4 border-purple-600">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="text-purple-600" />
                FOTO PARA CRACHÁ
              </h3>
              
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="relative inline-block">
                    {fotoPreview ? (
                      <div className="relative">
                        <img
                          src={fotoPreview}
                          alt="Preview"
                          className="w-40 h-40 object-cover rounded-2xl border-4 border-purple-500 shadow-lg"
                        />
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 shadow-lg transition-colors"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-40 h-40 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl border-4 border-dashed border-purple-400 flex flex-col items-center justify-center hover:border-purple-600 transition-colors">
                          <FontAwesomeIcon icon={faUser} className="text-5xl text-purple-400 mb-2" />
                          <span className="text-sm text-gray-600 font-semibold">Adicionar Foto</span>
                          <span className="text-xs text-gray-500 mt-1">JPG, PNG (máx 5MB)</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Foto 3x4 para crachá de identificação
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-4 justify-between">
              <button
                type="button"
                onClick={() => router.push('/cadastros/liderancas')}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold transition-colors flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faSave} />
                Atualizar Liderança
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
