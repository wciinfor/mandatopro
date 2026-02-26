#!/usr/bin/env node

/**
 * Script para criar um eleitor de teste
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function criarEleitorTeste() {
  try {
    console.log('👤 Criando eleitor de teste...\n');

    const eleitorTeste = {
      nome: 'João Silva Teste',
      cpf: '12345678901',
      email: 'joao.teste@example.com',
      telefone: '(91) 99999-1111',
      endereco: 'Rua das Flores',
      numero: '123',
      complemento: 'Apt 45',
      bairro: 'Centro',
      cidade: 'São Luís',
      estado: 'MA',
      cep: '65000000',
      latitude: -2.8869,
      longitude: -44.2960,
      data_nascimento: '1990-05-15',
      sexo: 'M',
      profissao: 'Assistente Administrativo',
      status: 'ATIVO'
    };

    const { data: eleitor, error } = await supabase
      .from('eleitores')
      .insert([eleitorTeste])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar eleitor:', error.message);
      process.exit(1);
    }

    console.log('✅ Eleitor criado com sucesso!\n');
    console.log('📋 Dados do Eleitor:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:        ${eleitor.id}`);
    console.log(`Nome:      ${eleitor.nome}`);
    console.log(`CPF:       ${eleitor.cpf}`);
    console.log(`Email:     ${eleitor.email}`);
    console.log(`Telefone:  ${eleitor.telefone}`);
    console.log(`Endereço:  ${eleitor.endereco}, ${eleitor.numero} - ${eleitor.bairro}`);
    console.log(`           ${eleitor.cidade}, ${eleitor.estado} - ${eleitor.cep}`);
    console.log(`Status:    ${eleitor.status}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🚀 Acesse em: http://localhost:3001/cadastros/eleitores');
    console.log('✏️  Para editar, clique no botão Editar (lápis azul)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

criarEleitorTeste();
