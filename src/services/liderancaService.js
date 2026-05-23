import supabase from '@/lib/supabaseClient';

const getMissingColumn = (message) => {
  const text = String(message || '');
  let match = text.match(/Could not find the '(.+?)' column/i);
  if (match) return match[1];
  match = text.match(/column "(.+?)" does not exist/i);
  if (match) return match[1];
  return '';
};

/**
 * Cria uma nova liderança no banco de dados
 * @param {Object} dados - Dados da liderança
 * @returns {Promise<Object>} Dados da liderança criada
 */
export async function criarLideranca(dados) {
  try {
    const endereco = dados.endereco || null;
    const estado = dados.estado || null;
    const telefone = dados.telefone || dados.celular || null;
    const payload = {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      telefone,
      endereco,
      estado,
      municipio: dados.municipio || null,
      bairro: dados.bairro || null,
      influencia: dados.influencia || 'MÉDIA',
      area_atuacao: dados.areaAtuacao || dados.area_atuacao || null,
      areaAtuacao: dados.areaAtuacao || dados.area_atuacao || null,
      status: dados.status || 'ATIVO',
      observacoes: dados.observacoes || null,
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      sexo: dados.sexo || null,
      nomePai: dados.nomePai || null,
      nomeMae: dados.nomeMae || null,
      naturalidade: dados.naturalidade || null,
      estadoCivil: dados.estadoCivil || null,
      profissao: dados.profissao || null,
      foto: dados.foto || null,
      projecao_votos: dados.projecaoVotos || dados.projecao_votos || 0
    };

    const insertWithPayload = async (payloadAtual) => supabase
      .from('liderancas')
      .insert([payloadAtual])
      .select();

    let payloadAtual = { ...payload };
    let result = await insertWithPayload(payloadAtual);

    for (let attempt = 0; attempt < 6 && result.error; attempt += 1) {
      const missingColumn = getMissingColumn(result.error.message);
      if (!missingColumn || !(missingColumn in payloadAtual)) {
        break;
      }
      const nextPayload = { ...payloadAtual };
      delete nextPayload[missingColumn];
      payloadAtual = nextPayload;
      result = await insertWithPayload(payloadAtual);
    }

    const { data, error } = result;

    if (error) {
      console.error('Erro ao criar liderança:', error);
      throw new Error(`Erro ao criar liderança: ${error.message}`);
    }

    return data[0];
  } catch (error) {
    console.error('Erro ao criar liderança:', error);
    throw error;
  }
}

/**
 * Cria um marcador de geolocalização para a liderança
 * @param {Object} dados - Dados da liderança e geolocalização
 * @param {number} liderancaId - ID da liderança criada
 * @returns {Promise<Object>} Dados do marcador criado
 */
export async function criarGeolocalizacaoLideranca(dados, liderancaId) {
  try {
    // Nota: Geolocalização é criada a partir dos dados do eleitor
    // Se necessário, pode ser implementado em futuro
    console.log('Geolocalização será registrada em futuro (para liderança ID:', liderancaId, ')');
    return { success: true, message: 'Geolocalização preparada para futuro registro' };
  } catch (error) {
    console.error('Erro ao preparar geolocalização:', error);
    throw error;
  }
}

/**
 * Cria uma liderança com geolocalização
 * @param {Object} dados - Dados completos da liderança
 * @returns {Promise<Object>} Objeto com liderança e geolocalização
 */
export async function criarLiderancaComGeolocalizacao(dados) {
  try {
    // 1. Criar liderança
    const lideranca = await criarLideranca(dados);

    // 2. Criar geolocalização
    const geolocalizacao = await criarGeolocalizacaoLideranca(dados, lideranca.id);

    return {
      lideranca,
      geolocalizacao,
      success: true
    };
  } catch (error) {
    console.error('Erro ao criar liderança com geolocalização:', error);
    throw error;
  }
}

/**
 * Obtém todas as lideranças
 * @param {Object} filtros - Filtros opcionais
 * @returns {Promise<Array>} Lista de lideranças
 */
export async function obterLiderancas(filtros = {}) {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(`Erro ao verificar sessao: ${sessionError.message}`);
    }
    if (!sessionData?.session) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    let query = supabase.from('liderancas').select('*');

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros.busca) {
      query = query.ilike('nome', `%${filtros.busca}%`);
    }

    const timeoutMs = 10000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tempo limite ao consultar liderancas.')), timeoutMs);
    });

    const { data, error } = await Promise.race([query, timeoutPromise]);

    if (error) {
      throw new Error(`Erro ao obter lideranças: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao obter lideranças:', error);
    throw error;
  }
}

/**
 * Obtém uma liderança por ID
 * @param {number} id - ID da liderança
 * @returns {Promise<Object>} Dados da liderança
 */
export async function obterLiderancaPorId(id) {
  try {
    const { data, error } = await supabase
      .from('liderancas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Erro ao obter liderança: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Erro ao obter liderança:', error);
    throw error;
  }
}

/**
 * Atualiza uma liderança
 * @param {number} id - ID da liderança
 * @param {Object} dados - Dados a atualizar
 * @returns {Promise<Object>} Dados atualizados
 */
export async function atualizarLideranca(id, dados) {
  try {
    if (!id) {
      throw new Error('ID da liderança não informado.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(`Erro ao verificar sessao: ${sessionError.message}`);
    }
    if (!sessionData?.session) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    const endereco = dados.endereco || null;
    const estado = dados.estado || null;
    const telefone = dados.telefone || dados.celular || null;
    const payload = {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      telefone,
      endereco,
      estado,
      municipio: dados.municipio || null,
      bairro: dados.bairro || null,
      influencia: dados.influencia || 'MÉDIA',
      area_atuacao: dados.areaAtuacao || dados.area_atuacao || null,
      areaAtuacao: dados.areaAtuacao || dados.area_atuacao || null,
      status: dados.status || 'ATIVO',
      observacoes: dados.observacoes || null,
      rg: dados.rg || null,
      dataNascimento: dados.dataNascimento || null,
      sexo: dados.sexo || null,
      nomePai: dados.nomePai || null,
      nomeMae: dados.nomeMae || null,
      naturalidade: dados.naturalidade || null,
      estadoCivil: dados.estadoCivil || null,
      profissao: dados.profissao || null,
      foto: dados.foto || null,
      projecao_votos: dados.projecaoVotos || dados.projecao_votos || 0,
      updated_at: new Date().toISOString()
    };

    const updateWithPayload = async (payloadAtual) => {
      const timeoutMs = 10000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tempo limite ao atualizar lideranca.')), timeoutMs);
      });

      const requestPromise = supabase
        .from('liderancas')
        .update(payloadAtual)
        .eq('id', id)
        .select();

      return Promise.race([requestPromise, timeoutPromise]);
    };

    let payloadAtual = { ...payload };
    let result = await updateWithPayload(payloadAtual);

    for (let attempt = 0; attempt < 6 && result.error; attempt += 1) {
      const missingColumn = getMissingColumn(result.error.message);
      if (!missingColumn || !(missingColumn in payloadAtual)) {
        break;
      }
      const nextPayload = { ...payloadAtual };
      delete nextPayload[missingColumn];
      payloadAtual = nextPayload;
      result = await updateWithPayload(payloadAtual);
    }

    const { data, error } = result;

    if (error) {
      throw new Error(`Erro ao atualizar liderança: ${error.message}`);
    }

    return data[0];
  } catch (error) {
    console.error('Erro ao atualizar liderança:', error);
    throw error;
  }
}

/**
 * Deleta uma liderança
 * @param {number} id - ID da liderança
 * @returns {Promise<void>}
 */
export async function deletarLideranca(id) {
  try {
    // 1. Deletar geolocalização associada
    await supabase
      .from('geolocalizacao')
      .delete()
      .eq('lideranca_id', id);

    // 2. Deletar liderança
    const { error } = await supabase
      .from('liderancas')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar liderança: ${error.message}`);
    }
  } catch (error) {
    console.error('Erro ao deletar liderança:', error);
    throw error;
  }
}

/**
 * Busca eleitores para cadastro como liderança
 * @param {string} termo - Termo de busca (nome ou CPF)
 * @returns {Promise<Array>} Lista de eleitores encontrados
 */
export async function buscarEleitoresParaLideranca(termo) {
  try {
    let query = supabase.from('eleitores').select('*');

    if (termo.length >= 3) {
      // Buscar por nome ou CPF
      query = query.or(`nome.ilike.%${termo}%,cpf.eq.${termo}`);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      throw new Error(`Erro ao buscar eleitores: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar eleitores:', error);
    return [];
  }
}
