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
import { atualizarLideranca, obterLiderancaPorId } from '@/services/liderancaService';
import { applyMask } from '@/utils/inputMasks';

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
  const [fotoScale, setFotoScale] = useState(1);
  const [fotoOffset, setFotoOffset] = useState({ x: 0, y: 0 });
  const [arrastandoFoto, setArrastandoFoto] = useState(false);
  const [inicioArrasto, setInicioArrasto] = useState({ x: 0, y: 0 });
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
      const carregar = async () => {
        setCarregando(true);
        try {
          const dados = await obterLiderancaPorId(id);
          const masked = {
            ...dados,
            cpf: applyMask('cpf', dados?.cpf || ''),
            rg: applyMask('rg', dados?.rg || ''),
            telefone: applyMask('telefone', dados?.telefone || ''),
            celular: applyMask('celular', dados?.celular || '')
          };

          setFormData(prev => ({
            ...prev,
            ...masked
          }));
          if (dados?.foto) {
            setFotoPreview(dados.foto);
          }
        } catch (error) {
          showError('Erro ao carregar liderança.');
        } finally {
          setCarregando(false);
        }
      };

      carregar();
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData(prev => ({
      ...prev,
      [name]: maskedValue
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
        setFotoScale(1);
        setFotoOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const removerFoto = () => {
    setFotoPreview(null);
    setFormData(prev => ({ ...prev, foto: null }));
    setFotoScale(1);
    setFotoOffset({ x: 0, y: 0 });
  };

  const handleFotoZoom = (e) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setFotoScale(prev => {
      const next = Math.min(2, Math.max(0.8, prev + delta));
      return Number(next.toFixed(2));
    });
  };

  const aumentarZoom = () => {
    setFotoScale(prev => {
      const next = Math.min(2, prev + 0.1);
      return Number(next.toFixed(2));
    });
  };

  const diminuirZoom = () => {
    setFotoScale(prev => {
      const next = Math.max(0.8, prev - 0.1);
      return Number(next.toFixed(2));
    });
  };

  const iniciarArrasto = (e) => {
    e.preventDefault();
    const ponto = 'touches' in e ? e.touches[0] : e;
    setArrastandoFoto(true);
    setInicioArrasto({ x: ponto.clientX - fotoOffset.x, y: ponto.clientY - fotoOffset.y });
  };

  const moverArrasto = (e) => {
    if (!arrastandoFoto) return;
    const ponto = 'touches' in e ? e.touches[0] : e;
    setFotoOffset({ x: ponto.clientX - inicioArrasto.x, y: ponto.clientY - inicioArrasto.y });
  };

  const encerrarArrasto = () => {
    setArrastandoFoto(false);
  };

  const gerarFotoProcessada = () => {
    if (!fotoPreview) return null;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const frameSize = 160;
        const canvas = document.createElement('canvas');
        canvas.width = frameSize;
        canvas.height = frameSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas não suportado'));
          return;
        }

        // Base scale to cover the frame (object-cover behavior)
        const baseScale = Math.max(frameSize / img.width, frameSize / img.height);
        const scale = baseScale * fotoScale;
        const drawW = img.width * scale;
        const drawH = img.height * scale;

        const drawX = frameSize / 2 - drawW / 2 + fotoOffset.x;
        const drawY = frameSize / 2 - drawH / 2 + fotoOffset.y;

        ctx.clearRect(0, 0, frameSize, frameSize);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = fotoPreview;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const fotoProcessada = await gerarFotoProcessada();
      const payload = {
        ...formData,
        cpf: (formData.cpf || '').replace(/\D/g, ''),
        rg: (formData.rg || '').replace(/\D/g, ''),
        telefone: (formData.telefone || '').replace(/\D/g, ''),
        celular: (formData.celular || '').replace(/\D/g, ''),
        foto: fotoProcessada || formData.foto || null
      };

      await atualizarLideranca(id, payload);
      showSuccess('Liderança atualizada com sucesso!', () => {
        router.push('/cadastros/liderancas');
      });
    } catch (error) {
      showError('Erro ao atualizar liderança.');
    }
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
                        <div className="relative">
                          <div
                            className={`w-40 h-40 rounded-2xl border-4 border-purple-500 shadow-lg overflow-hidden ${arrastandoFoto ? 'cursor-grabbing' : 'cursor-grab'}`}
                            onWheel={handleFotoZoom}
                            onMouseDown={iniciarArrasto}
                            onMouseMove={moverArrasto}
                            onMouseUp={encerrarArrasto}
                            onMouseLeave={encerrarArrasto}
                            onTouchStart={iniciarArrasto}
                            onTouchMove={moverArrasto}
                            onTouchEnd={encerrarArrasto}
                          >
                            <img
                              src={fotoPreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              style={{ transform: `translate(${fotoOffset.x}px, ${fotoOffset.y}px) scale(${fotoScale})`, transformOrigin: 'center' }}
                            />
                          </div>
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                            <button
                              type="button"
                              onClick={diminuirZoom}
                              className="w-8 h-8 bg-white border border-purple-200 text-purple-700 rounded-full shadow hover:bg-purple-50"
                              title="Diminuir zoom"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={aumentarZoom}
                              className="w-8 h-8 bg-white border border-purple-200 text-purple-700 rounded-full shadow hover:bg-purple-50"
                              title="Aumentar zoom"
                            >
                              +
                            </button>
                          </div>
                        </div>
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
                    Foto 3x4 para crachá de identificação. Use o scroll para ajustar o zoom.
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
