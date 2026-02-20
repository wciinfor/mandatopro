# ⚡ Comandos Essenciais - MandatoPro

## 🚀 Desenvolvimento

### Iniciar servidor de desenvolvimento
```bash
npm run dev
```
- Abre em: http://localhost:3000
- Hot reload automático
- Errors em tempo real

### Compilar para produção (teste local)
```bash
npm run build
```
- Simula o build da Vercel
- Deve terminar com: `✓ Build successful`
- Cria pasta `.next/`

### Iniciar servidor de produção
```bash
npm start
```
- Executa o build compilado
- Acesso em: http://localhost:3000
- Para: `Ctrl+C`

### Verificar erros de sintaxe
```bash
npm run lint
```
- Encontra problemas no código
- Avisa sobre warnings

---

## 🗄️ Banco de Dados

### Verificar status do banco
```bash
node scripts/check-db.js
```
- Lista todas as 24 tabelas
- Mostra quantidade de registros
- Confirma conexão com Supabase

### Limpar dados de teste
```bash
node scripts/db.js clean
```
- Deleta todos os registros
- Mantém estrutura das tabelas
- ⚠️ Irreversível!

### Inserir dados de teste
```bash
node scripts/db.js seed
```
- Popula banco com dados de exemplo
- Útil para testes
- Eleitores, eventos, etc

### Status completo do banco
```bash
node scripts/db.js status
```
- Informações detalhadas
- Índices, permissões
- Configurações

### Criar novo usuário
```bash
node scripts/create-user.js
```
- Interativo (pede email e senha)
- Cria em Auth e database
- Pronto para usar

### Criar usuário de teste rápido
```bash
node scripts/create-test-user.js
```
- Email: test@test.com
- Senha: Test123!
- Admin access

---

## 🐙 Git & GitHub

### Inicializar repositório
```bash
git init
```

### Adicionar todos os arquivos
```bash
git add .
```

### Fazer commit
```bash
git commit -m "Mensagem descritiva"
```

### Conectar ao GitHub (primeira vez)
```bash
git remote add origin https://github.com/seu-usuario/mandato-pro.git
```

### Fazer push para GitHub
```bash
git branch -M main
git push -u origin main
```

### Fazer push de updates (depois)
```bash
git add .
git commit -m "Descrição da mudança"
git push
```
- Vercel detecta automaticamente e redeploy!

---

## 📦 Dependências

### Instalar todas as dependências
```bash
npm install
```

### Instalar dependência específica
```bash
npm install nome-da-dependencia
```

### Atualizar todas as dependências
```bash
npm update
```

### Ver dependências desatualizadas
```bash
npm outdated
```

---

## 🔐 Segurança & Configuração

### Gerar nova senha
```bash
openssl rand -base64 32
```

### Verificar variáveis de ambiente
```bash
cat .env.local
```

### Listar variáveis configuradas
```bash
env | grep NEXT_PUBLIC
```

---

## 🧹 Limpeza

### Remover node_modules (libera espaço)
```bash
rm -rf node_modules
npm install
```

### Limpar cache Next.js
```bash
rm -rf .next
npm run build
```

### Limpar tudo e reinstalar
```bash
rm -rf node_modules .next package-lock.json
npm install
npm run build
```

---

## 📊 Utilitários

### Ver versão do Node.js
```bash
node --version
```

### Ver versão do npm
```bash
npm --version
```

### Listar arquivos modificados (Git)
```bash
git status
```

### Ver histórico de commits
```bash
git log --oneline
```

### Desfazer último commit (cuidado!)
```bash
git reset --soft HEAD~1
```

---

## 🚨 Troubleshooting

### Build falha com erro de módulo
```bash
# Solução:
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Porta 3000 já está em uso
```bash
# Solução (Windows PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Solução (Mac/Linux):
lsof -ti:3000 | xargs kill -9

# Ou usar porta diferente:
npm run dev -- -p 3001
```

### Login não funciona
```bash
# 1. Verificar .env.local:
cat .env.local | grep SUPABASE

# 2. Verificar Supabase está online:
ping supabase.com

# 3. Testar localmente e em produção
npm run build
npm start
```

### Dados não carregam do banco
```bash
# 1. Verificar status:
node scripts/check-db.js

# 2. Verificar tabelas:
# Supabase Dashboard → SQL Editor → SELECT * FROM usuarios;

# 3. Verificar permissões RLS:
# Supabase Dashboard → Authentication → Policies
```

---

## 🎯 Fluxo Típico de Desenvolvimento

```bash
# 1. Começar novo dia
npm run dev

# 2. Fazer mudanças no código
# (o servidor recarrega automaticamente)

# 3. Testar login
# http://localhost:3000/login

# 4. Testar funcionalidades
# Clicar nos módulos, criar dados

# 5. Antes de fazer push
npm run build
# (deve compilar sem erros)

# 6. Fazer commit e push
git add .
git commit -m "Descrição da mudança"
git push

# 7. Vercel faz deploy automático!
# Acompanhe em: vercel.com/dashboard
```

---

## 🔍 Monitoramento em Produção

### Ver logs da Vercel (no terminal)
```bash
vercel logs seu-projeto.vercel.app
```

### Ver erros em tempo real
```bash
# Supabase Dashboard → Logs → Query Performance
# Vercel Dashboard → Analytics → Error Rate
```

---

## 📝 Referência Rápida

| Tarefa | Comando |
|--------|---------|
| Iniciar dev | `npm run dev` |
| Build | `npm run build` |
| Iniciar prod | `npm start` |
| Git push | `git push` |
| Ver status BD | `node scripts/check-db.js` |
| Criar usuário | `node scripts/create-user.js` |
| Lint | `npm run lint` |
| Limpar cache | `rm -rf .next && npm run build` |

---

## ✅ Comandos Essenciais (Top 5)

```bash
# Desenvolvimento
npm run dev              # Iniciar servidor (SEMPRE)

# Antes de fazer push
npm run build            # Verificar que compila (CRÍTICO)

# Controle de versão
git push                 # Atualizar GitHub (DISPARA DEPLOY)

# Troubleshooting
node scripts/check-db.js # Verificar banco (DEBUG)
npm install              # Reinstalar deps (EMERGÊNCIA)
```

---

**Data**: 11 de janeiro de 2026

