#!/usr/bin/env node

/**
 * Script que copia o SQL completo para clipboard
 * Você colará no Supabase SQL Editor
 */

const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_initial_schema.sql');
const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

console.log('📋 SQL para copiar e colar no Supabase Dashboard:\n');
console.log('='.repeat(80));
console.log(sqlContent);
console.log('='.repeat(80));

console.log('\n📌 Instruções:');
console.log('1. Abra: https://supabase.com/dashboard/project/fhilsuwlllrnfpebtjvx/sql/new');
console.log('2. Selecione TODO o SQL acima (Ctrl+A no seu terminal)');
console.log('3. Cole no SQL Editor do Supabase');
console.log('4. Clique "Run" (botão verde ▶)');
console.log('5. Pronto! Suas 24 tabelas serão criadas!');

// Também salvar em um arquivo
const outputFile = path.join(__dirname, '..', 'SCHEMA_TO_EXECUTE.sql');
fs.writeFileSync(outputFile, sqlContent);
console.log(`\n✅ SQL salvo em: SCHEMA_TO_EXECUTE.sql`);
