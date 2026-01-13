# 🚀 Próximas Ações - Deploy para Vercel

## Status Atual

✅ Build local: **SUCESSO**  
✅ Git inicializado: **SUCESSO**  
✅ Código commitado: **SUCESSO**  
⏳ GitHub: **Aguardando**  
⏳ Vercel: **Aguardando**  

---

## 📋 O Que Você Precisa Fazer Agora

### Passo 1: Criar Repositório GitHub (2 min)

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: `mandato-pro`
   - **Description**: Sistema de Gestão Política
   - **Visibility**: Public (ou Private, conforme preferir)
3. **NÃO** selecione "Initialize this repository"
4. Clique: **Create repository**

### Passo 2: Fazer Push para GitHub (1 min)

Copie estes comandos (substitua `seu-usuario`):

```bash
git remote add origin https://github.com/seu-usuario/mandato-pro.git
git branch -M main
git push -u origin main
```

**Cole no terminal e execute.**

### Passo 3: Importar no Vercel (5 min)

1. Acesse: https://vercel.com/dashboard
2. Clique: **"New Project"** ou **"Add New"**
3. Clique: **"Import Git Repository"**
4. Conecte GitHub (autorize uma vez)
5. Selecione: **mandato-pro**
6. Clique: **"Import"**

### Passo 4: Configurar Environment Variables

Na tela "Configure Project", adicione estas variáveis:

```
NEXT_PUBLIC_SUPABASE_URL = https://fhilsuwlllrnfpebtjvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_jpj_delZJJTcdIKJ8ZDHSQ_JIZ51bMi
SUPABASE_SERVICE_ROLE_KEY = sb_secret_iUm54fhzl87WIdbUHYlKXw_wQODZDV3
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = AIzaSyBc30k7GJW3UvC2RGKx4RY8XyxJDJStcWg
```

7. Clique: **"Deploy"**

⏱️ **Aguarde 5-10 minutos** para Vercel fazer o build

### Passo 5: Inserir Usuário Admin

Após Vercel indicar sucesso, execute novamente:

```bash
node scripts/setup-admin.js
```

Se ainda tiver erro de schema cache, execute SQL manualmente:

**Supabase Dashboard → SQL Editor → Nova Query:**

```sql
INSERT INTO usuarios (email, nome, nivel, status, ativo, data_cadastro)
VALUES ('admin@mandatopro.com', 'Admin Sistema', 'ADMINISTRADOR', 'ATIVO', true, NOW());
```

### Passo 6: Testar Login em Produção

1. Vercel te dará uma URL como: `seu-projeto.vercel.app`
2. Acesse: `seu-projeto.vercel.app/login`
3. Login:
   - **Email**: admin@mandatopro.com
   - **Senha**: Teste123!
4. Confirme que o dashboard carrega com dados

---

## 📊 Resumo do Deploy

| Componente | Status | Próximo |
|-----------|--------|---------|
| Build Local | ✅ Ok | Feito |
| Git | ✅ Ok | Push para GitHub |
| GitHub | ⏳ Pendente | Criar repo + Push |
| Vercel | ⏳ Pendente | Import + Deploy |
| Usuário Admin | ⏳ Pendente | Inserir após deploy |
| Login | ⏳ Pendente | Testar em produção |

---

## ✨ Seu Sistema Estará Online em 30 Minutos!

Tempo estimado:
- GitHub: 2 min
- Push: 1 min
- Vercel Import: 5 min
- **Total: 8 min** ⏰

---

**Data**: 12 de janeiro de 2026  
**Status**: Pronto para Vercel
