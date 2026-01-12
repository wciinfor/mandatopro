# 🚀 Deploy no Vercel - Guia Completo

## ✅ Pré-requisitos

1. ✅ Código no GitHub (ou GitLab/Bitbucket)
2. ✅ Conta no Vercel (vercel.com)
3. ✅ Supabase configurado e rodando
4. ✅ Variáveis de ambiente prontas

---

## 📋 Passo 1: Preparar o Repositório Git

### 1.1 Inicializar Git (se ainda não tiver)
```bash
cd c:\BACKUP\DESENVOLVIMENTO\mandato-pro
git init
git add .
git commit -m "Initial commit - MandatoPro with Supabase integration"
```

### 1.2 Criar repositório no GitHub
1. Acesse: https://github.com/new
2. Nome: `mandato-pro`
3. Descrição: "Sistema de Gestão Política - MandatoPro"
4. Clique em "Create repository"

### 1.3 Conectar ao repositório remoto
```bash
git remote add origin https://github.com/SEU_USER/mandato-pro.git
git branch -M main
git push -u origin main
```

---

## 🚀 Passo 2: Deploy no Vercel

### 2.1 Método 1: Via Dashboard Vercel (Recomendado)

1. Acesse: https://vercel.com/dashboard
2. Clique em **"New Project"**
3. Selecione **"Import Git Repository"**
4. Conecte sua conta GitHub
5. Selecione o repositório `mandato-pro`
6. Clique em **"Import"**

### 2.2 Método 2: Via CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer login
vercel login

# Deploy
vercel
```

---

## 🔐 Passo 3: Configurar Variáveis de Ambiente no Vercel

### Via Dashboard:

1. No Vercel Dashboard, vá para seu projeto
2. Clique em **"Settings"**
3. Vá para **"Environment Variables"**
4. Adicione as seguintes variáveis:

```
NEXT_PUBLIC_SUPABASE_URL=https://fhilsuwlllrnfpebtjvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jpj_delZJJTcdIKJ8ZDHSQ_JIZ51bMi
SUPABASE_SERVICE_ROLE_KEY=sb_secret_iUm54fhzl87WIdbUHYlKXw_wQODZDV3
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBc30k7GJW3UvC2RGKx4RY8XyxJDJStcWg
WHATSAPP_BUSINESS_PHONE_ID=seu_phone_id_aqui
WHATSAPP_BUSINESS_ACCESS_TOKEN=seu_access_token_aqui
WHATSAPP_WEBHOOK_TOKEN=seu_webhook_token_aqui
```

### Via CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... adicionar as demais
```

---

## ✅ Passo 4: Verificar o Build

```bash
# Testar build localmente
npm run build

# Se não houver erros, deploy está pronto!
```

---

## 📊 Passo 5: Configurações Extras

### 5.1 Domain Customizado (Opcional)

1. No Vercel Dashboard
2. Projeto → Settings → Domains
3. Adicione seu domínio (ex: mandatopro.com)

### 5.2 Environment para Diferentes Ambientes

```bash
# Production
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Preview (staging)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview

# Development (local)
# Já está em .env.local
```

---

## 🔄 Passo 6: Configurar Supabase para Produção

### Via Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard
2. Projeto: fhilsuwlllrnfpebtjvx
3. Settings → API
4. **Enable replication** (opcional, para melhor performance)
5. Verifique RLS policies se necessário

### Adicionar Vercel URL ao CORS do Supabase:

1. Settings → API → CORS
2. Adicione: `https://seu-projeto.vercel.app`
3. Salve

---

## 🧪 Passo 7: Testar o Deploy

Após o deploy:

1. Acesse: `https://seu-projeto.vercel.app`
2. Tente fazer login com `admin@mandatopro.com` / `Teste123!`
3. Verifique se o dashboard carrega com dados do Supabase
4. Teste algumas funcionalidades (criar solicitação, etc)

---

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
# Limpar cache e reinstalar
rm -r node_modules package-lock.json
npm install
npm run build
```

### Erro: "Supabase connection failed"
- Verifique se as variáveis de ambiente estão configuradas no Vercel
- Verifique se o Supabase está rodando
- Verifique CORS no Supabase

### Erro: "Build failed"
- Verifique `npm run build` localmente
- Veja os logs no Vercel Dashboard
- Corrija qualquer erro e faça push novamente

---

## 📈 Monitoramento Pós-Deploy

### Vercel Analytics
- Dashboard → Monitoring
- Veja performance, erros, etc

### Supabase Logs
- Dashboard Supabase → Logs
- Veja queries e erros do banco

---

## 🔄 Fluxo de Desenvolvimento Contínuo

```
Local → GitHub → Vercel (Auto Deploy)
  ↓
npm run dev
  ↓
git commit
  ↓
git push origin main
  ↓
Vercel detecta mudança
  ↓
Build automático
  ↓
Deploy em produção
```

---

## ✨ Checklist Final

- [ ] Repositório Git criado no GitHub
- [ ] Código enviado para GitHub (`git push`)
- [ ] Projeto criado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Build testado localmente (`npm run build`)
- [ ] Deploy realizado com sucesso
- [ ] Login funciona no site de produção
- [ ] Dashboard carrega dados reais
- [ ] Domínio customizado configurado (opcional)

---

## 📞 Suporte

**Vercel Docs**: https://vercel.com/docs  
**Next.js Docs**: https://nextjs.org/docs  
**Supabase Docs**: https://supabase.com/docs

---

**Pronto para produção! 🚀**

Data: 11 de janeiro de 2026
