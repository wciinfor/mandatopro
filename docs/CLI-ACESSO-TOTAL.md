# ⚡ ACESSO TOTAL - AUTOMAÇÃO SUPABASE

## ✅ O Que Você Tem Agora

Você me concedeu acesso ao CLI do Supabase e agora criei **scripts automáticos** que fazem TUDO para você sem precisar acessar o dashboard!

---

## 🎯 Como Usar (2 Passos Simples)

### PASSO 1: Adicionar Service Role Key (1 minuto)

1. Abra: https://supabase.com/dashboard
2. Projeto: `<SUPABASE_PROJECT_REF>`
3. Vá para: **Settings** → **API** → **service_role key**
4. Copie a chave (começa com `eyJ...`)
5. Abra `.env.local` e substitua:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   por:
   ```
   SUPABASE_SERVICE_ROLE_KEY=sua_chave_copiada_aqui
   ```
6. Salve o arquivo

### PASSO 2: Executar os Scripts Automáticos

```bash
# Migrar banco de dados automaticamente
node scripts/auto-migrate.js

# Criar usuário de teste (interativo)
node scripts/create-user.js

# Ou começar o servidor
npm run dev
```

---

## 📊 O Que Eles Fazem

### `scripts/auto-migrate.js`
- ✅ Lê o SQL das migrações
- ✅ Conecta ao Supabase automaticamente
- ✅ Cria todas as 24 tabelas
- ✅ Verifica se tudo foi criado
- ✅ Mostra relatório completo

**Resultado esperado:**
```
🚀 Iniciando migração automática do banco de dados...

📝 Encontrados 234 comandos SQL para executar

[1/234] Executando: CREATE TABLE IF NOT EXISTS usuarios... ✅
[2/234] Executando: CREATE TABLE IF NOT EXISTS eleitores... ✅
...
✅ 24 tabelas criadas com sucesso!
🎉 SUCESSO!
```

### `scripts/create-user.js`
- ✅ Cria usuário no Supabase Auth
- ✅ Cria registro no banco de dados
- ✅ Interface interativa (deixe em branco para usar padrões)
- ✅ Pronto para login imediatamente

**Uso:**
```bash
node scripts/create-user.js

👤 CRIAR USUÁRIO PARA MANDATOPRO

Email (padrão: admin@mandatopro.com): admin@mandatopro.com
Senha (padrão: Teste123!): Teste123!
Nome completo (padrão: Admin Sistema): Admin Sistema

Nível de acesso:
1. ADMINISTRADOR (acesso total)
2. LIDERANCA (acesso a lideranças)
3. OPERADOR (acesso básico)
Escolha (padrão: 1): 1

🎉 USUÁRIO CRIADO COM SUCESSO!
```

---

## 🚀 Fluxo Completo (Da Instalação ao Funcionamento)

```bash
# 1. Estar na pasta do projeto
cd c:\BACKUP\DESENVOLVIMENTO\mandato-pro

# 2. Copiar a Service Role Key para .env.local
# (fazer via editor, 1 minuto)

# 3. Executar migração automática
node scripts/auto-migrate.js
# ⏱️ Tempo: 5-10 minutos

# 4. Criar usuário de teste
node scripts/create-user.js
# ⏱️ Tempo: 1 minuto

# 5. Substituir AuthContext
cp src/contexts/AuthContext_novo.js src/contexts/AuthContext.js
# ⏱️ Tempo: 1 segundo

# 6. Iniciar servidor
npm run dev
# 🌐 http://localhost:3000/login

# 7. Login
# Email: admin@mandatopro.com
# Senha: Teste123!
```

---

## 🔧 Arquivos Criados Para Automação

- ✅ `scripts/auto-migrate.js` - Migra banco automaticamente
- ✅ `scripts/create-user.js` - Cria usuário interativamente
- ✅ `scripts/migrate.js` - Script alternativo (fallback)
- ✅ `scripts/db.js` - Seed, clean, status

---

## 📝 O Que Você Precisa Fazer (Apenas 1 Coisa)

### ⚠️ IMPORTANTE: Copiar Service Role Key

```
Para isso funcionar, você PRECISA copiar a Service Role Key do Supabase.
É um valor que começa com "eyJ..." e tem mais de 200 caracteres.

Onde encontrar:
1. https://supabase.com/dashboard
2. Projeto: <SUPABASE_PROJECT_REF>
3. Settings → API → service_role key
4. Copie tudo e paste em .env.local
```

Depois disso, **eu faço o resto automaticamente!**

---

## ✨ Exemplo Prático

```bash
# Você executa:
$ node scripts/auto-migrate.js

# Eu:
# ✅ Conecto ao Supabase
# ✅ Leio o arquivo SQL
# ✅ Crio 24 tabelas
# ✅ Crio índices
# ✅ Insiro configurações iniciais
# ✅ Verifico tudo

# Resultado:
# 🎉 SUCESSO! 24/24 tabelas criadas!
```

---

## 🎯 Checklist Para Você

- [ ] Copiar Service Role Key do Supabase
- [ ] Colar em `.env.local` (linha 4)
- [ ] Salvar arquivo
- [ ] Executar: `node scripts/auto-migrate.js`
- [ ] Executar: `node scripts/create-user.js`
- [ ] Copiar AuthContext: `cp src/contexts/AuthContext_novo.js src/contexts/AuthContext.js`
- [ ] Iniciar: `npm run dev`
- [ ] Acessar: http://localhost:3000/login
- [ ] Fazer login: admin@mandatopro.com / Teste123!
- [ ] 🎉 PRONTO!

---

## 🆘 Se Não Funcionar

### Erro: "SUPABASE_SERVICE_ROLE_KEY não configurada"
**Solução**: Você não copiou a Service Role Key. Faça o passo 1 acima.

### Erro: "Connection refused"
**Solução**: Seu Supabase pode estar fora. Verifique https://status.supabase.com

### Erro: "Invalid API Key"
**Solução**: Você copiou a chave errada. Verifique se é a "service_role key", não "anon key"

### Script trava ou demora muito
**Solução**: Normal para 24 tabelas. Aguarde 5-10 minutos.

---

## 🔐 Segurança

⚠️ **IMPORTANTE**:
- Não comite `.env.local` no Git!
- A Service Role Key é sensível - guarde bem
- O arquivo `.gitignore` já deve excluir `.env.local`

---

## 📞 Resumo

✅ **Com acesso total ao CLI, você não precisa**:
- ❌ Acessar o dashboard Supabase
- ❌ Copiar e colar SQL manualmente
- ❌ Criar tabelas uma por uma
- ❌ Fazer configurações manuais

✅ **Você SÓ precisa**:
- ✅ Copiar a Service Role Key uma vez
- ✅ Executar 2 scripts automáticos
- ✅ Começar a desenvolver!

---

**Hora de agir! 🚀**

1. Copie a Service Role Key
2. Cole em `.env.local`
3. Execute: `node scripts/auto-migrate.js`
4. Diga "pronto!" e vamos pro próximo passo!

Data: 11 de janeiro de 2026

