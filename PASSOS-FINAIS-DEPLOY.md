# 🎯 Passos Finais para Deploy - MandatoPro

## ✨ Sistema Pronto para Produção

Seu projeto **MandatoPro** está completamente configurado para deploy. Siga os passos abaixo:

---

## 📋 Fase 1: Completar Setup do Banco de Dados (5 min)

### ✅ Inserir Usuário Admin

Se não fez ainda, execute este SQL no **Supabase Dashboard**:

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. SQL Editor → Nova Query
4. Cole este comando:

```sql
INSERT INTO usuarios (
  email, 
  nome, 
  nivel, 
  status, 
  ativo, 
  data_cadastro
) VALUES (
  'admin@mandatopro.com',
  'Admin Sistema',
  'ADMINISTRADOR',
  'ATIVO',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;
```

5. Execute (Ctrl+Enter)
6. Deve retornar: `"Rows affected: 1"`

✅ **Pronto**: Agora admin pode fazer login!

---

## 📦 Fase 2: Verificação Local (10 min)

Antes de subir para Vercel, teste tudo localmente:

```bash
# 1. Instalar dependências (se não fez)
npm install

# 2. Build de produção (mesmo que Vercel vai fazer)
npm run build

# Resultado esperado: ✓ Build successful
# Não deve ter erros vermelhos
```

### Testar Login Local
```bash
# 3. Inicie servidor de desenvolvimento
npm run dev

# 4. Abra: http://localhost:3000/login
# 5. Teste login com:
#    Email: admin@mandatopro.com
#    Senha: Teste123!
#    
# Deve redirecionar para dashboard com dados!
```

✅ **Sucesso**: Build sem erros + Login funciona = Pronto para Vercel!

---

## 🐙 Fase 3: GitHub (10 min)

MandatoPro precisa estar no GitHub para Vercel detectar mudanças:

```bash
# 1. Inicializar Git (se não fez)
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Primeiro commit
git commit -m "Initial commit - MandatoPro com Supabase integrado"

# 4. Criar repositório em https://github.com/new
#    Nome: mandato-pro
#    Descrição: Sistema de Gestão Política
#    Deixar PRIVATE ou PUBLIC conforme preferir

# 5. Conectar repositório remoto (substitua seu-usuario)
git remote add origin https://github.com/seu-usuario/mandato-pro.git

# 6. Push inicial
git branch -M main
git push -u origin main
```

✅ **Pronto**: Código no GitHub!

---

## 🚀 Fase 4: Vercel Deployment (15 min)

### Importar Projeto

1. Acesse: https://vercel.com/dashboard
2. Clique: **"New Project"** ou **"Add New"**
3. Selecione: **"Import Git Repository"**
4. Conecte GitHub (autorize uma vez)
5. Selecione: **mandato-pro**
6. Clique: **"Import"**

> 💡 Vercel detecta `next.config.mjs` e `vercel.json` automaticamente

### Configurar Variáveis de Ambiente

Após importar, você será levado a "Configure Project":

1. Seção: **"Environment Variables"**
2. Adicione estas 5 variáveis (copie de `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL = https://fhilsuwlllrnfpebtjvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_jpj_delZJJTcdIKJ8ZDHSQ_JIZ51bMi
SUPABASE_SERVICE_ROLE_KEY = sb_secret_iUm54fhzl87WIdbUHYlKXw_wQODZDV3
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = AIzaSyBc30k7GJW3UvC2RGKx4RY8XyxJDJStcWg
```

3. Clique: **"Deploy"**

> ⏱️ Leva 2-5 minutos para fazer build e deploy

### Aguardar Deploy

Vercel mostrará progresso em tempo real:
```
✓ Built and pushed to GitHub
✓ Building...
✓ Testing...
✓ Deployed to production
```

Quando terminar, você receberá:
- **URL de Produção**: `seu-projeto.vercel.app`
- Botão: **"Visit"** para acessar

✅ **Sucesso**: Site ao vivo!

---

## ✔️ Fase 5: Validação em Produção (10 min)

### Teste a Aplicação Online

1. Clique em **"Visit"** na Vercel
2. Página abre em: `seu-projeto.vercel.app/login`
3. Teste login:
   ```
   Email: admin@mandatopro.com
   Senha: Teste123!
   ```

### Verificações Críticas

- [ ] Página carrega (sem erros branco)
- [ ] Formulário de login renderiza
- [ ] Login bem-sucedido
- [ ] Dashboard carrega com dados reais
- [ ] Sidebar e navegação funcionam
- [ ] Clique em alguns módulos (Eleitores, Solicitações, etc)
- [ ] Dados aparecem (vindos do Supabase real)

### Se algo der errado:

**Erro de CORS?**
- Verificar em Supabase: Settings → API → CORS Allowed Origins
- Adicionar: `seu-projeto.vercel.app`

**Variáveis faltando?**
- Vercel → Project → Settings → Environment Variables
- Adicionar variáveis faltantes
- Clicar: "Redeploy"

**Build falhou?**
- Vercel → Deployments → Clique no deployment com ❌
- Ver logs do erro
- Executar localmente: `npm run build`
- Corrigir erro localmente, fazer push para GitHub
- Vercel redeploy automático

---

## 🔄 Fase 6: Configuração Contínua (Depois de deploy)

### Ativar Auto-Deploy

Quando você fizer `git push` para GitHub, Vercel faz deploy automático:

```bash
# Para futuros updates:
git add .
git commit -m "Descrição da mudança"
git push origin main

# Vercel detecta push e faz deploy automático!
```

### Adicionar Domínio Customizado (Opcional)

Se tiver domínio próprio:
1. Vercel → Project → Settings → Domains
2. Adicione seu domínio
3. Configure DNS conforme instruções

---

## 📊 Próximas Ações

Após confirmar que está online:

- [ ] Compartilhar URL com equipe
- [ ] Treinar usuários finais
- [ ] Monitorar logs em produção
- [ ] Configurar backups automáticos no Supabase
- [ ] Ativar email transacional (opcional)
- [ ] Configurar integração WhatsApp (se precisar)

---

## 🆘 Suporte Rápido

| Problema | Solução |
|----------|---------|
| Build falha | `npm run build` local + git push |
| Login não funciona | Verificar env vars em Vercel |
| Dados não carregam | Confirmar Supabase online + RLS policies |
| Estilos incorretos | Hard refresh (Ctrl+Shift+R) |
| Erro 500 | Verificar logs Vercel |

---

## 🎉 Parabéns!

Seu sistema está em **produção** pronto para usar!

### Dashboard Vercel
https://vercel.com/dashboard

### Supabase Console
https://supabase.com/dashboard

### Seu Projeto
https://seu-projeto.vercel.app

---

**Data**: 11 de janeiro de 2026  
**Status**: ✅ Pronto para Produção
