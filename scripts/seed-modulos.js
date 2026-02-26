#!/usr/bin/env node

/**
 * Seed de registros de teste por modulo.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variaveis de ambiente nao configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getAdminUserId() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', 'admin@mandatopro.com')
    .single();

  if (error) {
    throw new Error('Admin nao encontrado na tabela usuarios');
  }

  return data.id;
}

async function upsertSingle(table, payload, conflict) {
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: conflict })
    .select()
    .single();

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data;
}

async function insertMany(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select();

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data;
}

async function getOrCreateByField(table, field, payload) {
  const { data: existing, error: findError } = await supabase
    .from(table)
    .select('*')
    .eq(field, payload[field])
    .maybeSingle();

  if (findError) {
    throw new Error(`${table}: ${findError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from(table)
    .insert([payload])
    .select()
    .single();

  if (createError) {
    throw new Error(`${table}: ${createError.message}`);
  }

  return created;
}

async function seed() {
  try {
    console.log('🌱 Criando registros de teste por modulo...');

    const adminId = await getAdminUserId();

    // LIDERANCAS
    const lideranca = await upsertSingle('liderancas', {
      nome: 'Lideranca Teste',
      cpf: '11122233344',
      email: 'lideranca.teste@example.com',
      telefone: '(91) 90000-0001',
      cidade: 'Belem',
      estado: 'PA',
      status: 'ATIVO'
    }, 'cpf');

    // ELEITORES
    const eleitor = await upsertSingle('eleitores', {
      nome: 'Eleitor Teste',
      cpf: '22233344455',
      email: 'eleitor.teste@example.com',
      telefone: '(91) 90000-0002',
      cidade: 'Belem',
      estado: 'PA',
      status: 'ATIVO',
      lideranca_id: lideranca.id
    }, 'cpf');

    // FUNCIONARIOS
    const funcionario = await upsertSingle('funcionarios', {
      nome: 'Funcionario Teste',
      cpf: '33344455566',
      email: 'funcionario.teste@example.com',
      telefone: '(91) 90000-0003',
      cargo: 'Assistente',
      departamento: 'Atendimento',
      status: 'ATIVO',
      cidade: 'Belem',
      estado: 'PA'
    }, 'cpf');

    // ORGAOS (nome nao tem unique no schema atual)
    const orgao = await getOrCreateByField('orgaos', 'nome', {
      nome: 'Secretaria Municipal de Saude',
      sigla: 'SMS',
      email: 'contato@sms.example.com',
      telefone: '(91) 90000-0004',
      status: 'ATIVO'
    });

    // EMENDAS
    const emenda = await upsertSingle('emendas', {
      numero_emenda: 'EMD-2026-001',
      titulo: 'Emenda Teste',
      descricao: 'Emenda de teste para o sistema',
      valor: 100000.00,
      status: 'APRESENTADA',
      responsavel_id: adminId,
      orgao_id: orgao.id
    }, 'numero_emenda');

    // REPASSES
    await insertMany('repasses', [
      {
        emenda_id: emenda.id,
        valor: 50000.00,
        data_prevista: new Date().toISOString().slice(0, 10),
        status: 'PENDENTE',
        responsavel_id: adminId
      }
    ]);

    // RESPONSAVEIS EMENDAS
    await insertMany('responsaveis_emendas', [
      {
        emenda_id: emenda.id,
        usuario_id: adminId,
        papel: 'Gestor'
      }
    ]);

    // ATENDIMENTOS
    await insertMany('atendimentos', [
      {
        protocolo: `ATD-${Date.now()}`,
        eleitor_id: eleitor.id,
        tipo_atendimento: 'GERAL',
        assunto: 'Atendimento de teste',
        descricao: 'Registro de atendimento para teste',
        atendente_id: adminId,
        status: 'REALIZADO'
      }
    ]);

    // AGENDA EVENTOS
    await insertMany('agenda_eventos', [
      {
        titulo: 'Reuniao de Teste',
        descricao: 'Evento para validacao do modulo',
        data: new Date().toISOString().slice(0, 10),
        local: 'Gabinete',
        tipo: 'PARLAMENTAR',
        categoria: 'Reuniao',
        criado_por_id: adminId,
        status: 'AGENDADO'
      }
    ]);

    // SOLICITACOES
    await insertMany('solicitacoes', [
      {
        protocolo: `SOL-${Date.now()}`,
        titulo: 'Solicitacao de Teste',
        descricao: 'Solicitacao criada para teste',
        solicitante: 'Cidadao Teste',
        categoria: 'Educação',
        prioridade: 'MÉDIA',
        status: 'NOVO',
        municipio: 'Belem',
        atendente_id: adminId
      }
    ]);

    console.log('✅ Seed concluido com sucesso!');
    console.log('➡️  Acesse: http://localhost:3001');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  }
}

seed();
