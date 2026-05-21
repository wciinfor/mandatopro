import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faSearch, faTimesCircle, faArrowLeft, faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { applyMask, onlyDigits } from '@/utils/inputMasks';
import { getMunicipioIBGEByName } from '@/utils/municipiosIBGE';

export default function NovoEleitor() {
  const router = useRouter();
  const { modalState, closeModal, showSuccess, showError, showWarning } = useModal();
  const inputRGRef = useRef(null);
  const lookupRequestRef = useRef(0);
  const [formData, setFormData] = useState({
    // Dados Pessoais
    cpf: '',
    nome: '',
    nomeSocial: '',
    rg: '',
    dataNascimento: '',
    sexo: 'MASCULINO',
    nomePai: '',
    nomeMae: '',
    naturalidade: '',
    estadoCivil: '',
    profissao: '',
    localTrabalho: '',
    
    // Endereço Residencial
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    latitude: '',
    longitude: '',
    
    // Dados Eleitorais
    tituloEleitoral: '',
    secao: '',
    municipio: '',
    id_municipio: '', // Código IBGE - preenchido automaticamente
    zona: '',
    localVotacao: '',
    situacaoTSE: 'ATIVO', // ATIVO ou INATIVO
    biometria: '',
    
    // Dados de Contato
    email: '',
    telefone: '',
    celular: '',
    whatsapp: '',
    
    // Observações
    lideranca: '',
    observacoes: '',
    
    // Status do cadastro
    statusCadastro: 'ATIVO'
  });

  // Estados para controle de duplicidade
  const [duplicidadeInfo, setDuplicidadeInfo] = useState(null);
  const [liderancas, setLiderancas] = useState([]);

  const normalizarTexto = (valor = '') =>
    String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const correspondeTexto = (base, referencia) => {
    if (!base || !referencia) return false;
    return base === referencia || base.includes(referencia) || referencia.includes(base);
  };

  const obterLiderancasFiltradas = (lista, bairro, municipio, cidade) => {
    if (!Array.isArray(lista) || lista.length === 0) return [];

    const bairroRef = normalizarTexto(bairro);
    const municipioRef = normalizarTexto(municipio || cidade);

    // Regra de negocio: prioriza bairro; municipio/cidade e fallback quando bairro nao informado.
    if (bairroRef) {
      return lista.filter((item) => {
        const bairroLideranca = normalizarTexto(item?.bairro);
        return correspondeTexto(bairroLideranca, bairroRef);
      });
    }

    if (municipioRef) {
      return lista.filter((item) => {
        const municipioLideranca = normalizarTexto(item?.municipio || item?.cidade);
        return correspondeTexto(municipioLideranca, municipioRef);
      });
    }

    return [];
  };

  const liderancasFiltradas = obterLiderancasFiltradas(
    liderancas,
    formData.bairro,
    formData.municipio,
    formData.cidade
  );

  const possuiBairroPreenchido = Boolean(String(formData.bairro || '').trim());
  const possuiMunicipioOuCidadePreenchido = Boolean(
    String(formData.municipio || formData.cidade || '').trim()
  );
  const podeSelecionarLideranca = possuiBairroPreenchido || possuiMunicipioOuCidadePreenchido;
  const criterioFiltroLideranca = possuiBairroPreenchido ? 'bairro' : 'município/cidade';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const maskedValue = applyMask(name, value);

    setFormData((prev) => {
      const nextState = {
        ...prev,
        [name]: maskedValue
      };

      // Mantem id_municipio localmente em sincronia ao digitar
      if (name === 'municipio' || name === 'uf') {
        const municipioRef = name === 'municipio' ? maskedValue : prev.municipio;
        const ufRef = name === 'uf' ? maskedValue : prev.uf;
        const idMunicipioLocal = municipioRef
          ? getMunicipioIBGEByName(municipioRef, ufRef)
          : null;

        nextState.id_municipio = idMunicipioLocal || '';
      }

      return nextState;
    });
  };

  useEffect(() => {
    const municipio = String(formData.municipio || '').trim();
    const uf = String(formData.uf || '').trim();

    if (!municipio || municipio.length < 2) {
      if (formData.id_municipio) {
        setFormData((prev) => ({ ...prev, id_municipio: '' }));
      }
      return;
    }

    const idMunicipioLocal = getMunicipioIBGEByName(municipio, uf);
    if (idMunicipioLocal) {
      if (String(formData.id_municipio || '') !== String(idMunicipioLocal)) {
        setFormData((prev) => ({ ...prev, id_municipio: String(idMunicipioLocal) }));
      }
      return;
    }

    const requestId = ++lookupRequestRef.current;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ municipio });
        if (uf) {
          params.set('uf', uf);
        }

        const response = await fetch(`/api/localidades/municipio-ibge?${params.toString()}`);
        if (!response.ok) {
          if (lookupRequestRef.current === requestId) {
            setFormData((prev) => ({ ...prev, id_municipio: '' }));
          }
          return;
        }

        const data = await response.json();
        if (lookupRequestRef.current !== requestId) {
          return;
        }

        const idMunicipio = data?.id_municipio ? String(data.id_municipio) : '';
        setFormData((prev) => ({ ...prev, id_municipio: idMunicipio }));
      } catch {
        if (lookupRequestRef.current === requestId) {
          setFormData((prev) => ({ ...prev, id_municipio: '' }));
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.id_municipio, formData.municipio, formData.uf]);

  useEffect(() => {
    const carregarLiderancas = async () => {
      try {
        const response = await fetch('/api/cadastros/liderancas?limit=500&status=ATIVO');
        if (!response.ok) return;
        const payload = await response.json();
        setLiderancas(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        setLiderancas([]);
      }
    };

    carregarLiderancas();
  }, []);

  useEffect(() => {
    const nomesValidos = new Set(
      liderancasFiltradas
        .map((item) => String(item?.nome || '').trim())
        .filter(Boolean)
    );

    setFormData((prev) => {
      const atual = String(prev.lideranca || '').trim();

      if (atual && nomesValidos.has(atual)) {
        return prev;
      }

      if (liderancasFiltradas.length === 1) {
        return {
          ...prev,
          lideranca: String(liderancasFiltradas[0]?.nome || '')
        };
      }

      if (!atual) {
        return prev;
      }

      return {
        ...prev,
        lideranca: ''
      };
    });
  }, [liderancasFiltradas]);

  const verificarDuplicidade = async (campo, valor) => {
    if (!valor || valor.length < 3) return;

    try {
      const digitos = onlyDigits(valor);
      const response = await fetch(`/api/cadastros/eleitores?search=${encodeURIComponent(digitos)}`);
      
      if (response.ok) {
        const dados = await response.json();
        const eleitores = dados.data || [];
        
        // Verificar se há duplicidade no campo específico
        const duplicado = eleitores.find(e => {
          if (campo === 'cpf') {
            const cpfExistente = (e.cpf || '').replace(/\D/g, '');
            return cpfExistente === digitos;
          } else if (campo === 'rg') {
            const rgExistente = (e.rg || '').replace(/\D/g, '');
            return rgExistente === digitos;
          }
          return false;
        });

        if (duplicado) {
          const nomeCampo = campo.toUpperCase();
          setDuplicidadeInfo({
            campo: nomeCampo,
            nome: duplicado.nome,
            valor: valor
          });
          showWarning(
            'Cadastro Duplicado',
            `Já existe um cadastro com este ${nomeCampo}\n\nNome: ${duplicado.nome}`,
            () => {
              // Reset do campo de duplicidade
              setFormData(prev => ({
                ...prev,
                [campo]: ''
              }));
              // Focar no input RG
              if (inputRGRef.current) {
                inputRGRef.current.focus();
              }
            }
          );
        } else {
          setDuplicidadeInfo(null);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar duplicidade:', error);
    }
  };

  const handleRGBlur = () => {
    if (formData.rg.length >= 3) {
      verificarDuplicidade('rg', formData.rg);
    }
  };

  const handleCPFBlur = () => {
    if (formData.cpf.length >= 3) {
      verificarDuplicidade('cpf', formData.cpf);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validações básicas
      if (!formData.nome.trim()) {
        showWarning('Nome é obrigatório');
        return;
      }

      if (!formData.cpf.trim()) {
        showWarning('CPF é obrigatório');
        return;
      }

      if (formData.tituloEleitoral && formData.tituloEleitoral.length > 12) {
        showWarning('Nº Título deve ter no máximo 12 caracteres');
        return;
      }

      console.log('Dados do formulário:', formData);
      
      let latitude = formData.latitude ? parseFloat(formData.latitude) : null;
      let longitude = formData.longitude ? parseFloat(formData.longitude) : null;

      // Geocodificar endereco se coordenadas estiverem vazias
      if (!latitude || !longitude) {
        const enderecoPartes = [
          formData.logradouro,
          formData.numero,
          formData.bairro,
          formData.cidade,
          formData.uf,
          formData.cep
        ].filter(Boolean);

        if (enderecoPartes.length < 3) {
          showWarning('Preencha endereco completo para gerar as coordenadas.');
          return;
        }

        const endereco = enderecoPartes.join(', ');
        const geoResponse = await fetch('/api/geolocalizacao/geocodificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: endereco })
        });

        if (!geoResponse.ok) {
          const geoError = await geoResponse.json();
          throw new Error(geoError.error || 'Erro ao gerar coordenadas');
        }

        const geoData = await geoResponse.json();
        latitude = geoData.latitude;
        longitude = geoData.longitude;
      }

      // Normalizar campos numericos
      const payload = {
        ...formData,
        cpf: onlyDigits(formData.cpf),
        rg: onlyDigits(formData.rg),
        telefone: onlyDigits(formData.telefone),
        celular: onlyDigits(formData.celular),
        whatsapp: onlyDigits(formData.whatsapp),
        cep: onlyDigits(formData.cep),
        tituloEleitoral: onlyDigits(formData.tituloEleitoral),
        id_municipio: formData.id_municipio ? parseInt(formData.id_municipio) : null,
        latitude,
        longitude
      };

      // Enviar para API
      const response = await fetch('/api/cadastros/eleitores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        const detalhes = [error.message, error.details, error.hint].filter(Boolean).join(' | ');
        throw new Error(detalhes || 'Erro ao criar eleitor');
      }

      const eleitorCriado = await response.json();

      // Registra o cadastro bem-sucedido
      console.log('Eleitor criado com sucesso:', eleitorCriado);
      
      showSuccess('Eleitor cadastrado com sucesso!', () => {
        router.push('/cadastros/eleitores');
      });
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      showError('Erro ao cadastrar: ' + error.message);
    }
  };

  const gerarRelatorioPDF = () => {
    const pdfGen = new PDFGenerator();
    const doc = pdfGen.gerarRelatorioEleitor(formData);
    doc.save(`Relatorio_Eleitor_${formData.nome || 'eleitor'}_${Date.now()}.pdf`);
  };

  const buscarCep = async () => {
    const cepDigits = onlyDigits(formData.cep);
    if (cepDigits.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const consultarTSE = async () => {
    if (!formData.zona || !formData.secao) {
      showWarning('Por favor, informe zona e secao para consultar o TSE');
      return;
    }

    try {
      const response = await fetch('/api/consulta-tse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zona: formData.zona,
          secao: formData.secao
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          municipio: data.municipio || prev.municipio,
          zona: data.zona?.toString() || prev.zona,
          localVotacao: data.localVotacao || prev.localVotacao
        }));
        
        showSuccess('Dados do TSE consultados com sucesso!');
      } else {
        showError(data.error || 'Erro ao consultar TSE. Verifique zona e secao informadas.');
      }
    } catch (error) {
      console.error('Erro ao consultar TSE:', error);
      showError('Erro ao conectar com o servidor.');
    }
  };

  const handleVoltar = () => {
    router.push('/cadastros/eleitores');
  };

  return (
    <Layout>
      {/* Modal */}
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleVoltar}
              className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              title="Voltar"
              type="button"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Novo Eleitor</h1>
              <p className="text-gray-600">Cadastro com integração de dados eleitorais</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📋 DADOS PESSOAIS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">NOME COMPLETO *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  placeholder="Digite o nome completo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CPF *</label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleInputChange}
                  onBlur={handleCPFBlur}
                  placeholder="000.000.000-00"
                  maxLength="14"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">NOME SOCIAL</label>
                <input
                  type="text"
                  name="nomeSocial"
                  value={formData.nomeSocial}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome social (se houver)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">RG</label>
                <input
                  ref={inputRGRef}
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleInputChange}
                  onBlur={handleRGBlur}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Somente números"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">DATA DE NASCIMENTO</label>
                <input
                  type="date"
                  name="dataNascimento"
                  value={formData.dataNascimento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SEXO</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">NOME DO PAI</label>
                <input
                  type="text"
                  name="nomePai"
                  value={formData.nomePai}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome do pai"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">NOME DA MÃE</label>
                <input
                  type="text"
                  name="nomeMae"
                  value={formData.nomeMae}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nome da mãe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">NATURALIDADE</label>
                <input
                  type="text"
                  name="naturalidade"
                  value={formData.naturalidade}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Cidade de nascimento"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ESTADO CIVIL</label>
                <select
                  name="estadoCivil"
                  value={formData.estadoCivil}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="SOLTEIRO">Solteiro(a)</option>
                  <option value="CASADO">Casado(a)</option>
                  <option value="DIVORCIADO">Divorciado(a)</option>
                  <option value="VIUVO">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">PROFISSÃO</label>
                <input
                  type="text"
                  name="profissao"
                  value={formData.profissao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Profissão"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">LOCAL DE TRABALHO</label>
                <input
                  type="text"
                  name="localTrabalho"
                  value={formData.localTrabalho}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Local onde trabalha"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              🏠 ENDEREÇO RESIDENCIAL
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="00000-000"
                    maxLength="9"
                  />
                  <button
                    type="button"
                    onClick={buscarCep}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold"
                  >
                    <FontAwesomeIcon icon={faSearch} className="mr-2" />
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">LOGRADOURO</label>
                <input
                  type="text"
                  name="logradouro"
                  value={formData.logradouro}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Rua, avenida, etc"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">NÚMERO</label>
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Número"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">COMPLEMENTO</label>
                <input
                  type="text"
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Apto, sala, etc"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">BAIRRO</label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Bairro"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CIDADE</label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Cidade"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">UF</label>
                <input
                  type="text"
                  name="uf"
                  value={formData.uf}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="UF"
                  maxLength="2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">LATITUDE</label>
                <input
                  type="text"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="-3.119028"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">LONGITUDE</label>
                <input
                  type="text"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="-60.021308"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1" />
              Coordenadas serão usadas para exibir no mapa de geolocalização
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              🗳️ DADOS ELEITORAIS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">TÍTULO ELEITORAL</label>
                <input
                  type="text"
                  name="tituloEleitoral"
                  value={formData.tituloEleitoral}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Título eleitoral"
                  maxLength="12"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SEÇÃO</label>
                <input
                  type="text"
                  name="secao"
                  value={formData.secao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Número da seção"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ZONA</label>
                <input
                  type="text"
                  name="zona"
                  value={formData.zona}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Zona eleitoral"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={consultarTSE}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Consultar TSE
              </button>
              <button
                type="button"
                onClick={() => window.open('https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor', '_blank')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold"
              >
                Site do TSE
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">MUNICÍPIO</label>
                <input
                  type="text"
                  name="municipio"
                  value={formData.municipio}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Município eleitoral"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID MUNICÍPIO (IBGE)</label>
                <input
                  type="text"
                  name="id_municipio"
                  value={formData.id_municipio}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  placeholder="Preenchido automaticamente"
                />
                <p className="text-xs text-gray-500 mt-1">Preenchido automaticamente</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SITUAÇÃO TSE</label>
                <select
                  name="situacaoTSE"
                  value={formData.situacaoTSE}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">LOCAL DE VOTAÇÃO</label>
                <input
                  type="text"
                  name="localVotacao"
                  value={formData.localVotacao}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Escola/Local"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">BIOMETRIA</label>
                <select
                  name="biometria"
                  value={formData.biometria}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📞 DADOS DE CONTATO
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-MAIL</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">TELEFONE RESIDENCIAL</label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(00) 0000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CELULAR</label>
                <input
                  type="text"
                  name="celular"
                  value={formData.celular}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="(00) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">WHATSAPP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="(00) 99999-9999"
                  />
                  {formData.whatsapp && (
                    <a
                      href={`https://wa.me/55${formData.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      title="Abrir no WhatsApp"
                    >
                      <FontAwesomeIcon icon={faWhatsapp} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">STATUS DO CADASTRO</label>
                <select
                  name="statusCadastro"
                  value={formData.statusCadastro}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-3 border-b-2 border-teal-500">
              📝 OBSERVAÇÕES
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">LIDERANÇA</label>
              <select
                name="lideranca"
                value={formData.lideranca}
                onChange={handleInputChange}
                disabled={!podeSelecionarLideranca}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Selecione uma liderança</option>
                {liderancasFiltradas.map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome}
                  </option>
                ))}
              </select>
              {!podeSelecionarLideranca && (
                <p className="text-xs text-amber-700 mt-1">
                  Preencha bairro ou município/cidade para habilitar a seleção.
                </p>
              )}
              <p className="text-xs text-teal-700 mt-1">
                Filtro aplicado por <strong>{criterioFiltroLideranca}</strong>. Apenas lideranças cadastradas são permitidas.
              </p>
              {liderancasFiltradas.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Nenhuma liderança ativa encontrada para este {criterioFiltroLideranca}.
                </p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">OBSERVAÇÕES GERAIS</label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows="4"
                placeholder="Adicione observações sobre este eleitor..."
              />
            </div>
          </div>

          <div className="flex gap-4 justify-end mb-8">
            <button
              type="button"
              onClick={handleVoltar}
              className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faTimesCircle} />
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faSave} />
              SALVAR CADASTRO
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
