# 🎯 GUIA RÁPIDO - Deploy em 3 Passos

## Seu sistema está 100% pronto para Vercel! ✅

---

## 📋 Passo 1: Completar Banco (5 min)

Execute este SQL no **[Supabase Dashboard](https://supabase.com/dashboard)**:

```sql
INSERT INTO usuarios (email, nome, nivel, status, ativo)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true);
```

**Como fazer:**
1. Abra Supabase → Seu Projeto
2. SQL Editor → Nova Query
3. Cole o comando acima
4. Clique Executar

✅ Feito!

---

## 💻 Passo 2: Testar Localmente (10 min)

```bash
# Compilar para produção
npm run build

# Deve terminar com: ✓ Build successful

# Iniciar servidor dev
npm run dev

# Teste em: http://localhost:3000/login
# Email: admin@mandatopro.com
# Senha: Teste123!
```

✅ Se login funcionar, vai para próximo passo!

---

## 🚀 Passo 3: Deploy Vercel (10 min)

### 3a. Colocar no GitHub

```bash
git init
git add .
git commit -m "Initial commit - MandatoPro"
git remote add origin https://github.com/seu-usuario/mandato-pro.git
git branch -M main
git push -u origin main
```

### 3b. Importar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Clique: "New Project"
3. Conecte GitHub (autorize)
4. Selecione: **mandato-pro**
5. Clique: "Import"

### 3c. Adicionar Environment Variables

Na tela que aparecer, adicione:

```
NEXT_PUBLIC_SUPABASE_URL = https://<SUPABASE_PROJECT>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY = <SUPABASE_SERVICE_ROLE_KEY>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = <GOOGLE_MAPS_API_KEY>
```

Clique: **"Deploy"**

⏳ Aguarde 2-5 minutos...

✅ **Pronto!** Seu projeto está online!

---

## ✔️ Validar em Produção

1. Clique no botão "Visit" na Vercel
2. Teste login com `admin@mandatopro.com` / `Teste123!`
3. Confirme que o dashboard carrega com dados

---

## 📚 Documentação Completa

Para instruções detalhadas:
- **PASSOS-FINAIS-DEPLOY.md** - Tudo passo-a-passo
- **STATUS-FINAL.md** - Visão geral do projeto
- **CHECKLIST-DEPLOY.md** - Verificações
- **DEPLOY-VERCEL.md** - Troubleshooting

---

## 🎉 Pronto!

Seu sistema está em produção! 🚀

**URL**: `seu-projeto.vercel.app`

