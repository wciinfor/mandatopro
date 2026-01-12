# 🔐 Guia de Integração Supabase - MandatoPro

## ✅ Status: Configuração Preparada

### Credenciais Configuradas
- **Project URL**: `https://fhilsuwlllrnfpebtjvx.supabase.co`
- **Publishable API Key**: `sb_publishable_jpj_delZJJTcdIKJ8ZDHSQ_JIZ51bMi`
- **Arquivo `.env.local`**: ✅ Criado

---

## 📋 Checklist de Implementação

### 1. **Instalar Dependências** ✅
Arquivo `package.json` já foi atualizado com:
```bash
npm install @supabase/supabase-js
```

### 2. **Estrutura de Banco de Dados** ✅
Scripts SQL criados em: `supabase/migrations/001_create_initial_schema.sql`

Tabelas criadas:
- ✅ `usuarios` - Usuários do sistema
- ✅ `eleitores` - Cadastro de eleitores
- ✅ `liderancas` - Gestão de lideranças
- ✅ `funcionarios` - Funcionários
- ✅ `atendimentos` - Registro de atendimentos
- ✅ `agenda_eventos` - Agenda de eventos
- ✅ `solicitacoes` - Solicitações públicas
- ✅ `documentos` - Gestão de documentos
- ✅ `emendas` - Emendas parlamentares
- ✅ `orgaos` - Órgãos responsáveis
- ✅ `repasses` - Controle de repasses
- ✅ `financeiro_*` - Módulo financeiro
- ✅ `comunicacao_*` - Comunicação e mensagens
- ✅ `aniversariantes` - Controle de aniversariantes
- ✅ `logs_auditoria` - Auditoria de ações
- ✅ `logs_acessos` - Rastreamento de acesso
- ✅ `configuracoes_sistema` - Configurações globais

---

## 🚀 Passo a Passo para Aplicar as Migrações

### Opção 1: Usando Supabase Dashboard (Recomendado)

1. **Acesse o Supabase**
   - URL: https://supabase.com/dashboard
   - Selecione o projeto: `fhilsuwlllrnfpebtjvx`

2. **Abra o SQL Editor**
   - Clique em "SQL Editor" no menu lateral
   - Clique em "New Query"

3. **Copie o SQL das Migrações**
   - Abra: `supabase/migrations/001_create_initial_schema.sql`
   - Copie TODO o conteúdo SQL

4. **Execute no Supabase**
   - Cole todo o SQL no editor
   - Clique em "Run" ou pressione `Ctrl+Enter`

5. **Verifique a Execução**
   - Vá para "Database" → "Tables"
   - Você deve ver todas as 24 tabelas criadas

---

### Opção 2: Usando Supabase CLI

```bash
# 1. Instalar Supabase CLI (se não tiver)
npm install -g supabase

# 2. Fazer login
supabase login

# 3. Link com seu projeto
supabase link --project-ref fhilsuwlllrnfpebtjvx

# 4. Push das migrações
supabase db push
```

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos
- ✅ `.env.local` - Variáveis de ambiente
- ✅ `src/lib/supabaseClient.js` - Cliente Supabase
- ✅ `src/services/database.js` - Serviço de banco de dados
- ✅ `supabase/migrations/001_create_initial_schema.sql` - Migrações SQL
- ✅ `scripts/migrate.js` - Script de migração
- ✅ `src/contexts/AuthContext_novo.js` - Context com Supabase (para substituir)

### Modificados
- ✅ `package.json` - Adicionada dependência `@supabase/supabase-js`

---

## 🔧 Próximas Etapas

### 1. **Aplicar as Migrações**
```bash
# No Supabase Dashboard:
# 1. SQL Editor → New Query
# 2. Copiar conteúdo de supabase/migrations/001_create_initial_schema.sql
# 3. Executar
```

### 2. **Atualizar AuthContext**
```bash
# Substituir o arquivo antigo
cp src/contexts/AuthContext_novo.js src/contexts/AuthContext.js
```

### 3. **Instalar Dependências**
```bash
npm install
```

### 4. **Configurar Supabase Auth**
- Acesse: https://supabase.com/dashboard
- Projeto → Authentication → Providers
- Email: Ativar (já está por padrão)

### 5. **Criar Usuário de Teste**
No Supabase Dashboard:
- Authentication → Users → Add User
- Email: `admin@mandatopro.com`
- Password: `Mandatopro035862m5`

Depois criar no banco de dados:
```sql
INSERT INTO usuarios (email, nome, nivel, status)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO');
```

### 6. **Testar o Login**
```bash
npm run dev
# Acesse http://localhost:3000/login
# Use as credenciais acima
```

---

## 🔐 Segurança - RLS (Row Level Security)

Após aplicar as migrações, configure RLS (opcional mas recomendado):

```sql
-- Exemplo para tabela usuários
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver apenas a si mesmos"
ON usuarios FOR SELECT
USING (auth.uid()::text = id::text);
```

---

## 📊 Estrutura de Dados

### Tabela: usuarios
```
id (BIGSERIAL) - PK
email (VARCHAR) - UNIQUE
nome (VARCHAR)
nivel (VARCHAR) - ADMINISTRADOR, LIDERANCA, OPERADOR
status (VARCHAR) - ATIVO, INATIVO, BLOQUEADO
lideranca_id (BIGINT) - FK
data_cadastro (TIMESTAMP)
ultimo_acesso (TIMESTAMP)
```

### Tabela: eleitores
```
id (BIGSERIAL) - PK
nome (VARCHAR)
cpf (VARCHAR) - UNIQUE
email, telefone, endereco
lideranca_id (BIGINT) - FK
latitude, longitude (NUMERIC)
status (VARCHAR) - ATIVO, INATIVO, TRANSFERIDO
```

*(Consulte o arquivo SQL para estrutura completa)*

---

## 🎯 Funcionalidades Disponíveis

Após integração, você terá acesso a:

### Database Service (`src/services/database.js`)
```javascript
// Exemplo de uso
import { obterEleitores, criarSolicitacao } from '@/services/database';

// Obter eleitores com filtro
const eleitores = await obterEleitores({ 
  busca: 'João',
  status: 'ATIVO'
});

// Criar solicitação
const solicitacao = await criarSolicitacao({
  titulo: 'Reparo de via',
  categoria: 'Infraestrutura',
  prioridade: 'ALTA'
});
```

### Autenticação
```javascript
import { useAuth, loginUser } from '@/contexts/AuthContext';

const { user, logout } = useAuth();

// Login
const usuario = await loginUser(email, senha);
```

---

## ⚠️ Notas Importantes

1. **Environment Variables**: O arquivo `.env.local` contém suas credenciais. **NÃO FAÇA COMMIT** dele no Git!

2. **Service Role Key**: Você precisa adicionar a chave de serviço (Service Role Key) do Supabase em `.env.local`. Encontre em:
   - Dashboard → Project Settings → API → service_role key

3. **Migrations**: As migrações foram criadas como um arquivo `.sql` para facilitar a execução manual no Supabase Dashboard.

4. **CORS**: Supabase já vem com CORS configurado para `localhost:3000`.

---

## 📞 Suporte

Se encontrar erros ao aplicar as migrações:
1. Verifique o console do Supabase Dashboard
2. Tente executar as migrações em partes menores
3. Verifique se as dependências foram instaladas: `npm install`

---

**Data**: 11 de janeiro de 2026  
**Status**: 🟢 Pronto para aplicar migrações  
**Próxima Ação**: Executar SQL no Supabase Dashboard
