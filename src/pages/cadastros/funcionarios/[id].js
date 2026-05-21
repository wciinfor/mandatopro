import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSpinner, faCamera, faTrash
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { applyMask, formatCurrencyBRL, parseCurrencyBRL } from '@/utils/inputMasks';

export default function EditarFuncionario() {
  const router = useRouter();
  const { id } = router.query;
  const { modalState, closeModal, showSuccess, showError } = useModal();
  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [funcionario, setFuncionario] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoAlterada, setFotoAlterada] = useState(false);
  const fotoInputRef = useRef(null);

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    cargo: '',
    departamento: '',
    dataAdmissao: '',
    salario: '',
    cargaHoraria: '40',
    tipoContrato: 'CLT',
    matricula: '',
    status: 'ATIVO',
    observacoes: '',
    foto: null,
  });

  const carregarFuncionario = useCallback(async (funcId) => {
    setCarregandoDados(true);
    try {
      const response = await fetch(`/api/cadastros/funcionarios/${funcId}`);
      if (!response.ok) throw new Error('Funcionario nao encontrado');
      const json = await response.json();
      const f = json.data;
      setFuncionario(f);
      if (f.foto) setFotoPreview(f.foto);
      setFormData({
        nome: f.nome || '',
        cpf: applyMask('cpf', f.cpf || ''),
        email: f.email || '',
        telefone: applyMask('telefone', f.telefone || ''),
        cargo: f.cargo || '',
        departamento: f.departamento || '',
        dataAdmissao: f.dataAdmissao ? f.dataAdmissao.split('T')[0] : '',
        salario: formatCurrencyBRL(f.salario || ''),
        cargaHoraria: f.cargaHoraria ? String(f.cargaHoraria) : '40',
        tipoContrato: f.tipoContrato || 'CLT',
        matricula: f.matricula || '',
        status: f.status || 'ATIVO',
        observacoes: f.observacoes || '',
        foto: f.foto || null,
      });
    } catch (error) {
      console.error('Erro ao carregar funcionario:', error);
    } finally {
      setCarregandoDados(false);
    }
  }, []);

  useEffect(() => {
    if (router.isReady && id) {
      carregarFuncionario(id);
    }
  }, [router.isReady, id, carregarFuncionario]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);
    setFormData(prev => ({ ...prev, [name]: maskedValue }));
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Redimensiona para max 400x533 (proporcao 3x4) antes de converter para base64
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_W = 400;
      const MAX_H = 533;
      let w = img.width;
      let h = img.height;
      if (w > MAX_W || h > MAX_H) {
        const ratio = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.75);
      setFotoPreview(base64);
      setFotoAlterada(true);
      setFormData(prev => ({ ...prev, foto: base64 }));
    };
    img.src = objectUrl;
  };

  const handleRemoverFoto = () => {
    setFotoPreview(null);
    setFotoAlterada(true);
    setFormData(prev => ({ ...prev, foto: null }));
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cargo || !formData.departamento) {
      showError('Preencha os campos obrigatorios: Cargo e Departamento');
      return;
    }

    setCarregando(true);
    try {
      const payload = {
        cargo: formData.cargo,
        departamento: formData.departamento,
        dataAdmissao: formData.dataAdmissao || null,
        salario: parseCurrencyBRL(formData.salario),
        cargaHoraria: formData.cargaHoraria ? parseInt(formData.cargaHoraria) : 40,
        tipoContrato: formData.tipoContrato,
        status: formData.status,
        observacoes: formData.observacoes || null,
        // Só envia a foto se o usuário a alterou (evita 413 ao reenviar base64 grande)
        ...(fotoAlterada ? { foto: formData.foto || null } : {}),
      };

      const response = await fetch(`/api/cadastros/funcionarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error(`Resposta inválida do servidor (status ${response.status})`);
      }
      if (!response.ok) throw new Error(data?.message || 'Erro ao atualizar');

      showSuccess('Funcionario atualizado com sucesso!');
      setTimeout(() => router.push('/cadastros/funcionarios'), 2000);
    } catch (error) {
      console.error('Erro ao atualizar funcionario:', error);
      showError('Erro ao atualizar: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  if (carregandoDados) {
    return (
      <Layout titulo="Editar Funcionario">
        <div className="flex justify-center items-center h-64">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-teal-600 text-3xl" />
        </div>
      </Layout>
    );
  }

  if (!funcionario) {
    return (
      <Layout titulo="Editar Funcionario">
        <div className="text-center py-12 text-gray-500">Funcionario nao encontrado.</div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar Funcionario">
      <div className="max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* INFORMACOES DO FUNCIONARIO */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
              INFORMACOES DO FUNCIONARIO
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Foto 3x4 */}
              <div className="flex flex-col items-center gap-3 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-700">FOTO 3x4 (CRACHA)</label>
                <div
                  className="w-[105px] h-[140px] border-2 border-dashed border-teal-400 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 cursor-pointer hover:bg-teal-50 transition"
                  onClick={() => fotoInputRef.current?.click()}
                  title="Clique para selecionar foto"
                >
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <FontAwesomeIcon icon={faCamera} className="text-3xl" />
                      <span className="text-xs text-center px-1">Clique para adicionar foto</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
                {fotoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoverFoto}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    Remover foto
                  </button>
                )}
              </div>

              {/* Dados pessoais */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NOME COMPLETO</label>
                  <input type="text" value={formData.nome} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                  <input type="text" value={formData.cpf} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">EMAIL</label>
                  <input type="text" value={formData.email} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TELEFONE</label>
                  <input type="text" value={formData.telefone} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* DADOS PROFISSIONAIS */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
              DADOS PROFISSIONAIS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CARGO <span className="text-red-500">*</span></label>
                <input type="text" name="cargo" value={formData.cargo} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DEPARTAMENTO <span className="text-red-500">*</span></label>
                <input type="text" name="departamento" value={formData.departamento} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DATA DE ADMISSAO</label>
                <input type="date" name="dataAdmissao" value={formData.dataAdmissao} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SALARIO</label>
                <input type="text" name="salario" value={formData.salario} onChange={handleInputChange} inputMode="decimal" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CARGA HORARIA (h/semana)</label>
                <input type="number" name="cargaHoraria" value={formData.cargaHoraria} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TIPO DE CONTRATO</label>
                <select name="tipoContrato" value={formData.tipoContrato} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="TEMPORARIO">Temporario</option>
                  <option value="ESTAGIARIO">Estagiario</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">MATRICULA</label>
                <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-teal-700 font-semibold text-sm">
                  {formData.matricula || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">STATUS</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="AFASTADO">Afastado</option>
                </select>
              </div>
            </div>
          </div>

          {/* OBSERVACOES */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">OBSERVACOES</label>
            <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="4" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Observacoes..." />
          </div>

          {/* BOTOES */}
          <div className="flex gap-4 justify-end">
            <button type="button" onClick={() => router.push('/cadastros/funcionarios')} disabled={carregando} className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold flex items-center gap-2 transition disabled:opacity-50">
              <FontAwesomeIcon icon={faArrowLeft} />
              Voltar para Lista
            </button>
            <button type="submit" disabled={carregando} className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold flex items-center gap-2 transition disabled:opacity-50">
              {carregando ? (
                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Salvando...</>
              ) : (
                <><FontAwesomeIcon icon={faSave} /> Salvar Alteracoes</>
              )}
            </button>
          </div>
        </form>
      </div>

      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.type === 'success' ? 'Sucesso' : 'Erro'} message={modalState.message} type={modalState.type} />
    </Layout>
  );
}