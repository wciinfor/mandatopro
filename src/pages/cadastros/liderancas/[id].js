import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave,
  faArrowLeft,
  faUser,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { obterLiderancaPorId, atualizarLideranca } from '@/services/liderancaService';
import { applyMask } from '@/utils/inputMasks';

export default function EditarLideranca() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoScale, setFotoScale] = useState(1);
  const [fotoOffset, setFotoOffset] = useState({ x: 0, y: 0 });
  const [arrastandoFoto, setArrastandoFoto] = useState(false);
  const [inicioArrasto, setInicioArrasto] = useState({ x: 0, y: 0 });
  const loadedIdRef = useRef(null);

  const pickValue = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' && value.trim() === '') return fallback;
    return value;
  };

  const [formData, setFormData] = useState({
    foto: null,
    tipo: 'LOCAL',
    nome: '',
    cpf: '',
    rg: '',
    dataNascimento: '',
    telefone: '',
    email: '',
    sexo: 'MASCULINO',
    nomePai: '',
    nomeMae: '',
    naturalidade: '',
    estadoCivil: '',
    profissao: '',
    influencia: 'MÉDIA',
    areaAtuacao: '',
    status: 'ATIVO',
    municipio: '',
    bairro: '',
    endereco: '',
    estado: '',
    observacoes: '',
    projecaoVotos: 0
  });

  useEffect(() => {
    if (!id) return;
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;

    const carregar = async () => {
      setCarregando(true);
      try {
        const dados = await obterLiderancaPorId(id);
        const mapped = {
          nome: dados?.nome || '',
          cpf: applyMask('cpf', dados?.cpf || ''),
          rg: applyMask('rg', dados?.rg || ''),
          dataNascimento: dados?.dataNascimento || '',
          telefone: applyMask('telefone', dados?.telefone || ''),
          email: dados?.email || '',
          sexo: dados?.sexo || 'MASCULINO',
          nomePai: dados?.nomePai || '',
          nomeMae: dados?.nomeMae || '',
          naturalidade: dados?.naturalidade || '',
          estadoCivil: dados?.estadoCivil || '',
          profissao: dados?.profissao || '',
          influencia: dados?.influencia || 'MÉDIA',
          areaAtuacao: dados?.area_atuacao || dados?.areaAtuacao || '',
          status: dados?.status || 'ATIVO',
          municipio: dados?.municipio || '',
          bairro: dados?.bairro || '',
          endereco: dados?.endereco || '',
          estado: dados?.estado || '',
          observacoes: dados?.observacoes || '',
          tipo: dados?.tipo || 'LOCAL',
          foto: dados?.foto || null,
          projecaoVotos: dados?.projecao_votos || dados?.projecaoVotos || 0
        };

        const cpfBase = (dados?.cpf || '').replace(/\D/g, '');

        if (cpfBase) {
          try {
            const response = await fetch(`/api/cadastros/eleitores?search=${encodeURIComponent(cpfBase)}&limit=5`);
            if (response.ok) {
              const payload = await response.json();
              const lista = Array.isArray(payload?.data) ? payload.data : [];
              const eleitorMatch = lista.find((item) => (item?.cpf || '').replace(/\D/g, '') === cpfBase) || lista[0];

              if (eleitorMatch) {
                const merged = {
                  ...mapped,
                  nome: pickValue(mapped.nome, eleitorMatch.nome || ''),
                  cpf: pickValue(mapped.cpf, applyMask('cpf', eleitorMatch.cpf || '')),
                  rg: pickValue(mapped.rg, applyMask('rg', eleitorMatch.rg || '')),
                  dataNascimento: pickValue(mapped.dataNascimento, eleitorMatch.dataNascimento || eleitorMatch.data_nascimento || ''),
                  telefone: pickValue(mapped.telefone, applyMask('telefone', eleitorMatch.telefone || eleitorMatch.celular || '')),
                  email: pickValue(mapped.email, eleitorMatch.email || ''),
                  sexo: pickValue(mapped.sexo, eleitorMatch.sexo || mapped.sexo),
                  nomePai: pickValue(mapped.nomePai, eleitorMatch.nomePai || eleitorMatch.nomepai || ''),
                  nomeMae: pickValue(mapped.nomeMae, eleitorMatch.nomeMae || eleitorMatch.nomemae || ''),
                  naturalidade: pickValue(mapped.naturalidade, eleitorMatch.naturalidade || ''),
                  estadoCivil: pickValue(mapped.estadoCivil, eleitorMatch.estadoCivil || eleitorMatch.estadocivil || ''),
                  profissao: pickValue(mapped.profissao, eleitorMatch.profissao || ''),
                  endereco: pickValue(mapped.endereco, eleitorMatch.endereco || eleitorMatch.logradouro || ''),
                  estado: pickValue(mapped.estado, eleitorMatch.estado || eleitorMatch.uf || ''),
                  municipio: pickValue(mapped.municipio, eleitorMatch.municipio || eleitorMatch.cidade || ''),
                  bairro: pickValue(mapped.bairro, eleitorMatch.bairro || '')
                };

                setFormData(prev => ({
                  ...prev,
                  ...merged
                }));
              } else {
                setFormData(prev => ({
                  ...prev,
                  ...mapped
                }));
              }
            } else {
              setFormData(prev => ({
                ...prev,
                ...mapped
              }));
            }
          } catch (error) {
            setFormData(prev => ({
              ...prev,
              ...mapped
            }));
          }
        } else {
          setFormData(prev => ({
            ...prev,
            ...mapped
          }));
        }

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
    if (salvando) return;
    if (!id) {
      showError('ID da liderança não encontrado. Atualize a página e tente novamente.');
      return;
    }
    setSalvando(true);

    try {
      const fotoProcessada = await gerarFotoProcessada();
      const payload = {
        ...formData,
        cpf: (formData.cpf || '').replace(/\D/g, ''),
        rg: (formData.rg || '').replace(/\D/g, ''),
        telefone: (formData.telefone || '').replace(/\D/g, ''),
        foto: fotoProcessada || formData.foto || null
      };

      await atualizarLideranca(id, payload);
      showSuccess('Liderança atualizada com sucesso!', () => {
        router.push('/cadastros/liderancas');
      });
    } catch (error) {
      const mensagem = error?.message || 'Erro ao atualizar liderança.';
      showError(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Layout titulo="Editar Liderança">
      <div className="max-w-6xl mx-auto">
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

        {carregando ? (
          <div className="py-12 text-center text-gray-500">Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                DADOS PESSOAIS
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CPF
                  </label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME COMPLETO
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RG
                  </label>
                  <input
                    type="text"
                    name="rg"
                    value={formData.rg}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    DATA DE NASCIMENTO
                  </label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SEXO
                  </label>
                  <select
                    name="sexo"
                    value={formData.sexo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMININO">Feminino</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NATURALIDADE
                  </label>
                  <input
                    type="text"
                    name="naturalidade"
                    value={formData.naturalidade}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME DO PAI
                  </label>
                  <input
                    type="text"
                    name="nomePai"
                    value={formData.nomePai}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NOME DA MÃE
                  </label>
                  <input
                    type="text"
                    name="nomeMae"
                    value={formData.nomeMae}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ESTADO CIVIL
                  </label>
                  <select
                    name="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="SOLTEIRO">Solteiro(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIÚVO">Viúvo(a)</option>
                    <option value="UNIAO_ESTAVEL">União Estável</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PROFISSÃO
                  </label>
                  <input
                    type="text"
                    name="profissao"
                    value={formData.profissao}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ENDEREÇO
                    </label>
                    <input
                      type="text"
                      name="endereco"
                      value={formData.endereco}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ESTADO (UF)
                    </label>
                    <input
                      type="text"
                      name="estado"
                      value={formData.estado}
                      onChange={handleInputChange}
                      maxLength="2"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                DADOS DE LIDERANÇA
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NÍVEL DE INFLUÊNCIA
                  </label>
                  <select
                    name="influencia"
                    value={formData.influencia}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MÉDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="MUITO_ALTA">Muito Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ÁREA DE ATUAÇÃO
                  </label>
                  <input
                    type="text"
                    name="areaAtuacao"
                    value={formData.areaAtuacao}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ex: Saúde, Educação, Comunidade..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    STATUS
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TELEFONE
                  </label>
                  <input
                    type="text"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MUNICÍPIO
                  </label>
                  <input
                    type="text"
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BAIRRO
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* PROJEÇÃO DE VOTOS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PROJEÇÃO DE VOTOS
                  </label>
                  <input
                    type="number"
                    name="projecaoVotos"
                    value={formData.projecaoVotos}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Ex: 150, 500, 1000..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade de votos que se projeta que esta liderança trará ao candidato
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OBSERVAÇÕES
                </label>
                <textarea
                  name="observacoes"
                  value={formData.observacoes}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

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
                {salvando ? 'Salvando...' : 'Atualizar Liderança'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
