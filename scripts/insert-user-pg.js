#!/usr/bin/env node

/**
 * Script para inserir usuário via conexão direta ao PostgreSQL
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Erro: DATABASE_URL não configurada');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false } // Necessário para Supabase
});

(async () => {
  try {
    console.log('📝 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado!');

    console.log('📝 Inserindo usuário de teste...');
    
    const result = await client.query(
      `INSERT INTO usuarios (email, nome, nivel, status, ativo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      ['admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true]
    );

    console.log('✅ Usuário inserido com sucesso!\n');
    console.log('Dados do usuário:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TUDO PRONTO!\n');
    console.log('Você pode fazer login agora:');
    console.log('  📧 Email: admin@mandatopro.com');
    console.log('  Senha: configure/redefina pelo fluxo seguro de usuarios/Auth');
    console.log('='.repeat(60));

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
