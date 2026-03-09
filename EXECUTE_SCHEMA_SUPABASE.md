# 📋 Executar Schema no novo Supabase

## ⚠️ Problema Identificado
As tabelas não foram criadas automaticamente no novo projeto Supabase. Precisamos executar o SQL manualmente.

## 🚀 Solução Passo a Passo

### Passo 1: Abrir Supabase Dashboard
- URL: https://supabase.com/dashboard/project/zgfctbixiqnyxzkukpsu/sql/new
- Ou:
  1. Acesse https://supabase.com/dashboard
  2. Selecione o projeto `mandatopro`
  3. Clique em **SQL Editor** (menu lateral)
  4. Clique em **New Query**

### Passo 2: Executar o Schema
1. Copie **TODO** o conteúdo do arquivo `SCHEMA_TO_EXECUTE.sql`
2. Cole no editor SQL do Supabase Dashboard
3. Clique em **Run** (ou pressione Ctrl+Enter)
4. Aguarde a execução completa

### Passo 2.1: Aplicar Migrations Recentes
Depois do schema base, execute tambem:

- `supabase/migrations/214_add_municipio_to_agenda_eventos.sql`
- `supabase/migrations/215_add_municipio_to_campanhas.sql`
- `supabase/migrations/216_add_municipio_bairro_to_liderancas.sql`

### Passo 3: Validar
Após executar, você deve ver:
- ✅ 24 tabelas criadas
- ✅ Índices criados
- ✅ Configurações iniciais inseridas
- ✅ Colunas municipio/bairro adicionadas nas tabelas novas

## 📁 Arquivo SQL
- **Localização:** `/SCHEMA_TO_EXECUTE.sql`
- **Tamanho:** ~533 linhas SQL
- **Tabelas:** 24 criadas
- **Índices:** 20+ criados

## 🔐 Credenciais do Novo Supabase
```
Project URL: https://zgfctbixiqnyxzkukpsu.supabase.co
Project ID: zgfctbixiqnyxzkukpsu
Database Password: laoA5Opr4p2HkWah
```

## ✅ Após Executar o Schema
Depois que o schema for criado com sucesso:

```bash
# 1. Validar que as tabelas foram criadas
node scripts/check-db.js

# 2. Inserir dados de teste
node scripts/seed-db.js

# 3. Rodar o servidor
npm run dev
```

## 🆘 Troubleshooting
Se encontrar erros ao executar:

### "Table already exists"
- Essa mensagem é normal se as tabelas já existem
- O `IF NOT EXISTS` previne erros duplicados

### "Could not find table"
- Execute novamente o schema completo
- Você pode dividir em partes menores se necessário

### Erro de Permissão
- Use sua conta de admin do Supabase
- Certifique-se que tem acesso ao projeto

## 📞 Próximas Etapas
1. ✅ Executar schema (este passo)
2. ⏳ Validar com `check-db.js`
3. ⏳ Inserir dados com `seed-db.js`
4. ⏳ Testar no browser (`npm run dev`)

