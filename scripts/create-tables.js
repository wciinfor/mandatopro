#!/usr/bin/env node

/**
 * Script para criar todas as 24 tabelas - execução real via Supabase Admin API
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const TABELAS = [
  {
    name: 'liderancas',
    sql: `CREATE TABLE IF NOT EXISTS liderancas (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(11) UNIQUE,
      email VARCHAR(255),
      telefone VARCHAR(20),
      endereco VARCHAR(500),
      numero VARCHAR(20),
      bairro VARCHAR(100),
      cidade VARCHAR(100),
      estado VARCHAR(2),
      cep VARCHAR(8),
      influencia VARCHAR(50) DEFAULT 'MÉDIA',
      area_atuacao VARCHAR(255),
      status VARCHAR(50) DEFAULT 'ATIVO',
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      latitude NUMERIC(10, 8),
      longitude NUMERIC(11, 8),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'usuarios',
    sql: `CREATE TABLE IF NOT EXISTS usuarios (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      nome VARCHAR(255) NOT NULL,
      nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('ADMINISTRADOR', 'LIDERANCA', 'OPERADOR')),
      status VARCHAR(50) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'BLOQUEADO')),
      lideranca_id BIGINT REFERENCES liderancas(id) ON DELETE SET NULL,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ultimo_acesso TIMESTAMP,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'eleitores',
    sql: `CREATE TABLE IF NOT EXISTS eleitores (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(11) UNIQUE NOT NULL,
      email VARCHAR(255),
      telefone VARCHAR(20),
      endereco VARCHAR(500),
      numero VARCHAR(20),
      complemento VARCHAR(255),
      bairro VARCHAR(100),
      cidade VARCHAR(100),
      estado VARCHAR(2),
      cep VARCHAR(8),
      status VARCHAR(50) DEFAULT 'ATIVO',
      lideranca_id BIGINT REFERENCES liderancas(id) ON DELETE SET NULL,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data_nascimento DATE,
      sexo VARCHAR(1),
      profissao VARCHAR(100),
      latitude NUMERIC(10, 8),
      longitude NUMERIC(11, 8),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'funcionarios',
    sql: `CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(11) UNIQUE,
      email VARCHAR(255),
      telefone VARCHAR(20),
      cargo VARCHAR(100),
      departamento VARCHAR(100),
      data_admissao DATE,
      salario NUMERIC(10, 2),
      status VARCHAR(50) DEFAULT 'ATIVO',
      endereco VARCHAR(500),
      numero VARCHAR(20),
      bairro VARCHAR(100),
      cidade VARCHAR(100),
      estado VARCHAR(2),
      data_nascimento DATE,
      cep VARCHAR(8),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'atendimentos',
    sql: `CREATE TABLE IF NOT EXISTS atendimentos (
      id BIGSERIAL PRIMARY KEY,
      protocolo VARCHAR(50) UNIQUE,
      eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE CASCADE,
      data_atendimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tipo_atendimento VARCHAR(100),
      assunto VARCHAR(255),
      descricao TEXT,
      resultado TEXT,
      atendente_id BIGINT REFERENCES usuarios(id),
      status VARCHAR(50) DEFAULT 'REALIZADO',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'agenda_eventos',
    sql: `CREATE TABLE IF NOT EXISTS agenda_eventos (
      id BIGSERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      data DATE NOT NULL,
      hora_inicio TIME,
      hora_fim TIME,
      local VARCHAR(255),
      tipo VARCHAR(50) DEFAULT 'PARLAMENTAR',
      categoria VARCHAR(100),
      criado_por_id BIGINT REFERENCES usuarios(id),
      status VARCHAR(50) DEFAULT 'AGENDADO',
      participantes INTEGER DEFAULT 0,
      confirmados INTEGER DEFAULT 0,
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'solicitacoes',
    sql: `CREATE TABLE IF NOT EXISTS solicitacoes (
      id BIGSERIAL PRIMARY KEY,
      protocolo VARCHAR(50) UNIQUE NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      solicitante VARCHAR(255),
      tipo_solicitante VARCHAR(50) DEFAULT 'MORADOR',
      categoria VARCHAR(100),
      prioridade VARCHAR(50) DEFAULT 'MÉDIA',
      status VARCHAR(50) DEFAULT 'NOVO',
      municipio VARCHAR(100),
      bairro VARCHAR(100),
      endereco VARCHAR(255),
      data_abertura DATE DEFAULT CURRENT_DATE,
      data_conclusao DATE,
      atendente_id BIGINT REFERENCES usuarios(id),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'documentos',
    sql: `CREATE TABLE IF NOT EXISTS documentos (
      id BIGSERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(100) NOT NULL,
      caminho_arquivo VARCHAR(500),
      url_arquivo VARCHAR(500),
      categoria VARCHAR(100),
      tamanho_bytes BIGINT,
      mime_type VARCHAR(100),
      criado_por_id BIGINT REFERENCES usuarios(id),
      data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data_expiracao DATE,
      publico BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'orgaos',
    sql: `CREATE TABLE IF NOT EXISTS orgaos (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      sigla VARCHAR(20),
      email VARCHAR(255),
      telefone VARCHAR(20),
      endereco VARCHAR(500),
      responsavel VARCHAR(255),
      status VARCHAR(50) DEFAULT 'ATIVO',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'emendas',
    sql: `CREATE TABLE IF NOT EXISTS emendas (
      id BIGSERIAL PRIMARY KEY,
      numero_emenda VARCHAR(50) UNIQUE NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      valor NUMERIC(15, 2),
      data_apresentacao DATE,
      data_aprovacao DATE,
      status VARCHAR(50) DEFAULT 'APRESENTADA',
      beneficiarios TEXT,
      responsavel_id BIGINT REFERENCES usuarios(id),
      orgao_id BIGINT REFERENCES orgaos(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'repasses',
    sql: `CREATE TABLE IF NOT EXISTS repasses (
      id BIGSERIAL PRIMARY KEY,
      emenda_id BIGINT REFERENCES emendas(id) ON DELETE CASCADE,
      valor NUMERIC(15, 2),
      data_prevista DATE,
      data_efetiva DATE,
      status VARCHAR(50) DEFAULT 'PENDENTE',
      observacoes TEXT,
      responsavel_id BIGINT REFERENCES usuarios(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'responsaveis_emendas',
    sql: `CREATE TABLE IF NOT EXISTS responsaveis_emendas (
      id BIGSERIAL PRIMARY KEY,
      emenda_id BIGINT REFERENCES emendas(id) ON DELETE CASCADE,
      usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
      papel VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'financeiro_caixa',
    sql: `CREATE TABLE IF NOT EXISTS financeiro_caixa (
      id BIGSERIAL PRIMARY KEY,
      data DATE DEFAULT CURRENT_DATE,
      saldo_anterior NUMERIC(15, 2),
      saldo_atual NUMERIC(15, 2),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'financeiro_despesas',
    sql: `CREATE TABLE IF NOT EXISTS financeiro_despesas (
      id BIGSERIAL PRIMARY KEY,
      descricao VARCHAR(255) NOT NULL,
      categoria VARCHAR(100),
      valor NUMERIC(15, 2),
      data_despesa DATE,
      data_pagamento DATE,
      status VARCHAR(50) DEFAULT 'PENDENTE',
      responsavel_id BIGINT REFERENCES usuarios(id),
      documento_ref VARCHAR(100),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'financeiro_lancamentos',
    sql: `CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
      id BIGSERIAL PRIMARY KEY,
      data DATE NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      descricao VARCHAR(255),
      categoria VARCHAR(100),
      valor NUMERIC(15, 2),
      referencia VARCHAR(100),
      responsavel_id BIGINT REFERENCES usuarios(id),
      observacoes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'financeiro_doadores',
    sql: `CREATE TABLE IF NOT EXISTS financeiro_doadores (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cpf_cnpj VARCHAR(14),
      email VARCHAR(255),
      telefone VARCHAR(20),
      endereco VARCHAR(500),
      limite_anual NUMERIC(15, 2),
      total_doado NUMERIC(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'ATIVO',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'financeiro_faturas',
    sql: `CREATE TABLE IF NOT EXISTS financeiro_faturas (
      id BIGSERIAL PRIMARY KEY,
      numero_fatura VARCHAR(50) UNIQUE,
      data_emissao DATE,
      data_vencimento DATE,
      valor NUMERIC(15, 2),
      status VARCHAR(50) DEFAULT 'ABERTA',
      descricao TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'comunicacao_mensagens',
    sql: `CREATE TABLE IF NOT EXISTS comunicacao_mensagens (
      id BIGSERIAL PRIMARY KEY,
      remetente_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
      destinatario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      tipo VARCHAR(50) DEFAULT 'TEXTO',
      data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      lida BOOLEAN DEFAULT false,
      data_leitura TIMESTAMP,
      anexos TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'comunicacao_conversas',
    sql: `CREATE TABLE IF NOT EXISTS comunicacao_conversas (
      id BIGSERIAL PRIMARY KEY,
      usuario1_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
      usuario2_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
      ultima_mensagem TEXT,
      data_ultima_mensagem TIMESTAMP,
      ativa BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'comunicacao_disparos',
    sql: `CREATE TABLE IF NOT EXISTS comunicacao_disparos (
      id BIGSERIAL PRIMARY KEY,
      titulo VARCHAR(255),
      mensagem TEXT NOT NULL,
      tipo_envio VARCHAR(50) DEFAULT 'WHATSAPP',
      destinatarios INTEGER,
      enviadas INTEGER DEFAULT 0,
      falhas INTEGER DEFAULT 0,
      data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'PROGRAMADO',
      criado_por_id BIGINT REFERENCES usuarios(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'aniversariantes',
    sql: `CREATE TABLE IF NOT EXISTS aniversariantes (
      id BIGSERIAL PRIMARY KEY,
      eleitor_id BIGINT REFERENCES eleitores(id) ON DELETE CASCADE,
      data_nascimento DATE,
      mes_ano VARCHAR(7),
      mes INTEGER,
      ano_nascimento INTEGER,
      enviado_mensagem BOOLEAN DEFAULT false,
      data_envio_mensagem TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'logs_auditoria',
    sql: `CREATE TABLE IF NOT EXISTS logs_auditoria (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
      acao VARCHAR(100) NOT NULL,
      modulo VARCHAR(100),
      descricao TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      dados_anteriores JSONB,
      dados_novos JSONB,
      status VARCHAR(50) DEFAULT 'SUCESSO',
      data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'logs_acessos',
    sql: `CREATE TABLE IF NOT EXISTS logs_acessos (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
      pagina VARCHAR(255),
      titulo_pagina VARCHAR(255),
      data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  },
  {
    name: 'configuracoes_sistema',
    sql: `CREATE TABLE IF NOT EXISTS configuracoes_sistema (
      id BIGSERIAL PRIMARY KEY,
      chave VARCHAR(100) UNIQUE NOT NULL,
      valor TEXT,
      tipo VARCHAR(50) DEFAULT 'STRING',
      descricao TEXT,
      editavel BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  }
];

async function createTable(tabela) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql: tabela.sql })
  });

  if (!response.ok) {
    // Tenta via graphql
    return await createTableViaGraphQL(tabela);
  }
  
  return response.ok;
}

async function createTableViaGraphQL(tabela) {
  // Fallback: reportar e continuar
  console.log(`⚠️  ${tabela.name} (requer criação manual)`);
  return false;
}

async function createAllTables() {
  console.log('🚀 Criando 24 tabelas no Supabase...\n');

  let created = 0;
  let failed = 0;

  for (let i = 0; i < TABELAS.length; i++) {
    const tabela = TABELAS[i];
    process.stdout.write(`[${i + 1}/${TABELAS.length}] ${tabela.name.padEnd(30)}`);
    
    try {
      const success = await createTable(tabela);
      if (success) {
        console.log(' ✅');
        created++;
      } else {
        console.log(' ⚠️');
        failed++;
      }
    } catch (error) {
      console.log(` ❌ ${error.message.substring(0, 30)}`);
      failed++;
    }

    // Pequeno delay para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Resultado: ${created} ✅ | ${failed} ⚠️`);
  console.log('\n⚠️  Se algumas tabelas falharem, execute manualmente no Supabase Dashboard.');
}

createAllTables().then(() => {
  console.log('\n✨ Processo concluído!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
