import { supabase } from '@/config/supabaseClient';

/**
 * Cria um novo funcionário no banco de dados
 * @param {Object} dados - Dados do funcionário
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function criarFuncionario(dados) {
  try {
    const { data, error } = await supabase
      .from('funcionarios')
      .insert([{
        nome: dados.nome,
        cpf: dados.cpf,
        rg: dados.rg,
        data_nascimento: dados.dataNascimento,
        sexo: dados.sexo,
        nome_pai: dados.nomePai,
        nome_mae: dados.nomeMae,
        naturalidade: dados.naturalidade,
        estado_civil: dados.estadoCivil,
        email: dados.email,
        telefone: dados.telefone,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        cargo: dados.cargo,
        departamento: dados.departamento,
        data_admissao: dados.dataAdmissao,
        salario: parseFloat(dados.salario) || null,
        carga_horaria: parseInt(dados.cargaHoraria) || 40,
        tipo_contrato: dados.tipoContrato,
        matricula: dados.matricula,
        pis: dados.pis,
        ctps: dados.ctps,
        banco: dados.banco,
        agencia: dados.agencia,
        conta: dados.conta,
        tipo_conta: dados.tipoConta,
        pix: dados.pix,
        status: dados.status || 'ATIVO',
        observacoes: dados.observacoes,
        eleitor_id: dados.eleitorId || null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Erro ao criar funcionário:', error);
      throw error;
    }

    console.log('Funcionário criado com sucesso:', data);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('Erro na função criarFuncionario:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém todos os funcionários com filtros opcionais
 * @param {Object} filtros - Filtros de busca
 * @returns {Promise<Array>} - Lista de funcionários
 */
export async function obterFuncionarios(filtros = {}) {
  try {
    let query = supabase.from('funcionarios').select('*');

    if (filtros.departamento) {
      query = query.eq('departamento', filtros.departamento);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,cpf.ilike.%${filtros.busca}%`);
    }

    if (filtros.ordem) {
      query = query.order(filtros.ordem.campo, { ascending: filtros.ordem.asc !== false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao obter funcionários:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erro na função obterFuncionarios:', error);
    return [];
  }
}

/**
 * Obtém um funcionário específico pelo ID
 * @param {number} id - ID do funcionário
 * @returns {Promise<Object|null>} - Dados do funcionário ou null
 */
export async function obterFuncionarioPorId(id) {
  try {
    const { data, error } = await supabase
      .from('funcionarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao obter funcionário:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro na função obterFuncionarioPorId:', error);
    return null;
  }
}

/**
 * Atualiza um funcionário existente
 * @param {number} id - ID do funcionário
 * @param {Object} dados - Dados a atualizar
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function atualizarFuncionario(id, dados) {
  try {
    const { data, error } = await supabase
      .from('funcionarios')
      .update({
        nome: dados.nome,
        cpf: dados.cpf,
        rg: dados.rg,
        data_nascimento: dados.dataNascimento,
        sexo: dados.sexo,
        nome_pai: dados.nomePai,
        nome_mae: dados.nomeMae,
        naturalidade: dados.naturalidade,
        estado_civil: dados.estadoCivil,
        email: dados.email,
        telefone: dados.telefone,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        cargo: dados.cargo,
        departamento: dados.departamento,
        data_admissao: dados.dataAdmissao,
        salario: parseFloat(dados.salario) || null,
        carga_horaria: parseInt(dados.cargaHoraria) || 40,
        tipo_contrato: dados.tipoContrato,
        matricula: dados.matricula,
        pis: dados.pis,
        ctps: dados.ctps,
        banco: dados.banco,
        agencia: dados.agencia,
        conta: dados.conta,
        tipo_conta: dados.tipoConta,
        pix: dados.pix,
        status: dados.status || 'ATIVO',
        observacoes: dados.observacoes,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Erro ao atualizar funcionário:', error);
      throw error;
    }

    console.log('Funcionário atualizado com sucesso:', data);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('Erro na função atualizarFuncionario:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deleta um funcionário
 * @param {number} id - ID do funcionário
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function deletarFuncionario(id) {
  try {
    const { error } = await supabase
      .from('funcionarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar funcionário:', error);
      throw error;
    }

    console.log('Funcionário deletado com sucesso');
    return { success: true };
  } catch (error) {
    console.error('Erro na função deletarFuncionario:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca eleitores para cadastro como funcionário
 * @param {string} termo - Termo de busca (nome ou CPF)
 * @returns {Promise<Array>} - Lista de eleitores encontrados
 */
export async function buscarEleitoresParaFuncionario(termo) {
  try {
    if (!termo || termo.length < 2) {
      return [];
    }

    // TODO: Implementar busca real no Supabase
    // Atualmente usando dados mock no componente
    const { data, error } = await supabase
      .from('eleitores')
      .select('*')
      .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
      .limit(10);

    if (error) {
      console.error('Erro ao buscar eleitores:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro na função buscarEleitoresParaFuncionario:', error);
    return [];
  }
}

export default {
  criarFuncionario,
  obterFuncionarios,
  obterFuncionarioPorId,
  atualizarFuncionario,
  deletarFuncionario,
  buscarEleitoresParaFuncionario
};
