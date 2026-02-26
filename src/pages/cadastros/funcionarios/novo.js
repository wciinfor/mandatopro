import { useState } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faArrowLeft, faSearch, faTimes, faCheckCircle, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { createClient } from '@supabase/supabase-js';
import { applyMask, parseCurrencyBRL } from '@/utils/inputMasks';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function NovoFuncionario() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError } = useModal();
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [eleitorSelecionado, setEleitorSelecionado] = useState(null);

  const [formData, setFormData] = useState({
    // Dados do eleitor (vêm da busca)
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    
    // Dados específicos de funcionário
    cargo: '',
    departamento: '',
    dataAdmissao: '',
    salario: '',
    cargaHoraria: '40',
    tipoContrato: 'CLT',
    matricula: '',
    status: 'ATIVO',
    observacoes: ''
  });

  const buscarEleitor = async (termo) => {
    setBusca(termo);
    
    if (termo.length < 2) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }

    setCarregando(true);

    try {
      // Buscar no Supabase
      const { data, error } = await supabase
        .from('eleitores')
        .select('id, nome, cpf, email, telefone')
        .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
        .limit(10);

      if (error) throw error;

      setResultados(data || []);
      setMostrarResultados((data || []).length > 0);
    } catch (error) {
      console.error('Erro ao buscar eleitores:', error);
      showError('Erro ao buscar eleitores');
    } finally {
      setCarregando(false);
    }
  };

  const selecionarEleitor = (eleitor) => {
    setEleitorSelecionado(eleitor);
    setFormData(prev => ({
      ...prev,
      nome: eleitor.nome,
      cpf: applyMask('cpf', eleitor.cpf || ''),
      email: eleitor.email,
      telefone: applyMask('telefone', eleitor.telefone || '')
    }));
    setBusca('');
    setResultados([]);
    setMostrarResultados(false);
  };

  const limparSelecao = () => {
    setEleitorSelecionado(null);
    setBusca('');
    setFormData({
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
      observacoes: ''
    });
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
    
    if (!eleitorSelecionado) {
      showError('Selecione um eleitor para cadastrar como funcionário');
      return;
    }

    if (!formData.cargo || !formData.departamento) {
      showError('Preencha os campos obrigatórios: Cargo e Departamento');
      return;
    }

    setCarregando(true);

    try {
      // Preparar dados para salvar no Supabase
      const dadosFuncionario = {
        eleitor_id: eleitorSelecionado.id,
        cargo: formData.cargo,
        departamento: formData.departamento,
        dataAdmissao: formData.dataAdmissao || null,
        salario: parseCurrencyBRL(formData.salario),
        cargaHoraria: formData.cargaHoraria ? parseInt(formData.cargaHoraria) : 40,
        tipoContrato: formData.tipoContrato,
        matricula: formData.matricula || null,
        status: formData.status,
        observacoes: formData.observacoes || null
      };

      const { data, error } = await supabase
        .from('funcionarios')
        .insert([dadosFuncionario])
        .select();
      if (error) throw error;

      showSuccess('Funcionário cadastrado com sucesso!');
      
      setTimeout(() => {
        router.push('/cadastros/funcionarios');
      }, 2000);
    } catch (error) {
      console.error('Erro ao cadastrar funcionário:', error);
      showError('Erro ao cadastrar funcionário. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Layout titulo="Cadastro de Novo Funcionário">
      <div className="max-w-6xl mx-auto">
        {/* Busca de Eleitor */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg shadow-md p-6 mb-6 border-l-4 border-teal-600">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faSearch} className="text-teal-600" />
            BUSCAR ELEITOR PARA CADASTRAR COMO FUNCIONÁRIO
          </h3>

          {!eleitorSelecionado ? (
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => buscarEleitor(e.target.value)}
                placeholder="Digite o nome ou CPF do eleitor..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              {mostrarResultados && resultados.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {resultados.map(eleitor => (
                    <button
                      key={eleitor.id}
                      onClick={() => selecionarEleitor(eleitor)}
                      className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b last:border-b-0 transition"
                    >
                      <div className="font-semibold text-gray-800">{eleitor.nome}</div>
                      <div className="text-sm text-gray-600">CPF: {eleitor.cpf}</div>
                    </button>
                  ))}
                </div>
              )}

              {mostrarResultados && resultados.length === 0 && busca.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                  Nenhum eleitor encontrado
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border-2 border-teal-500 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faCheckCircle} className="text-teal-600 text-xl" />
                <div>
                  <div className="font-semibold text-gray-800">{eleitorSelecionado.nome}</div>
                  <div className="text-sm text-gray-600">CPF: {eleitorSelecionado.cpf}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={limparSelecao}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faTimes} />
                Mudar
              </button>
            </div>
          )}
        </div>

        {eleitorSelecionado && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* INFORMAÇÕES DO ELEITOR (READ-ONLY) */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-6 text-teal-700 border-b-2 border-teal-500 pb-3">
                INFORMAÇÕES DO ELEITOR
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
                  <input type="text" name="cpf" value={formData.cpf} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NOME COMPLETO</label>
                  <input type="text" name="nome" value={formData.nome} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">EMAIL</label>
                  <input type="email" name="email" value={formData.email} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TELEFONE</label>
                  <input type="text" name="telefone" value={formData.telefone} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600" />
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
                  <input type="text" name="cargo" value={formData.cargo} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ex: Analista..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DEPARTAMENTO <span className="text-red-500">*</span></label>
                  <input type="text" name="departamento" value={formData.departamento} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ex: RH, TI..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DATA DE ADMISSÃO</label>
                  <input type="date" name="dataAdmissao" value={formData.dataAdmissao} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SALÁRIO</label>
                  <input type="text" name="salario" value={formData.salario} onChange={handleInputChange} inputMode="decimal" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="0,00" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CARGA HORÁRIA (h/semana)</label>
                  <input type="number" name="cargaHoraria" value={formData.cargaHoraria} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TIPO DE CONTRATO</label>
                  <select name="tipoContrato" value={formData.tipoContrato} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="TEMPORARIO">Temporário</option>
                    <option value="ESTAGIARIO">Estagiário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">MATRÍCULA</label>
                  <input type="text" name="matricula" value={formData.matricula} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
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

            {/* OBSERVAÇÕES */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">OBSERVAÇÕES</label>
              <textarea name="observacoes" value={formData.observacoes} onChange={handleInputChange} rows="4" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Observações..." />
            </div>

            {/* BOTÕES */}
            <div className="flex gap-4 justify-end">
              <button type="button" onClick={() => router.push('/cadastros/funcionarios')} disabled={carregando} className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold flex items-center gap-2 transition disabled:opacity-50">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista
              </button>
              <button type="submit" disabled={carregando} className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold flex items-center gap-2 transition disabled:opacity-50">
                {carregando ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faSave} />
                    Salvar Funcionário
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.type === 'success' ? 'Sucesso' : 'Erro'} message={modalState.message} type={modalState.type} />
    </Layout>
  );
}
