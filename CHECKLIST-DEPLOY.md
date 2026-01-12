# ✅ Checklist de Deployment - MandatoPro

## 📋 Pré-Deploy (Antes de subir para Vercel)

### 1. Preparação da Aplicação
- [ ] Código compila sem erros (`npm run build`)
- [ ] Sem warnings críticos no console
- [ ] Testes locais passam (`npm run dev`)
- [ ] Login funciona com Supabase real
- [ ] Dashboard carrega dados corretamente
- [ ] Não há erros de console em produção

### 2. Banco de Dados
- [ ] Usuário admin inserido na tabela `usuarios`
- [ ] Todas as 24 tabelas criadas no Supabase
- [ ] Índices criados para performance
- [ ] Row Level Security (RLS) configurado
- [ ] Backups configurados no Supabase

### 3. Variáveis de Ambiente
- [ ] `.env.local` preenchido com credenciais corretas
- [ ] Não há variáveis hardcodeadas no código
- [ ] Chaves secretas não estão no Git
- [ ] `.gitignore` está configurado

### 4. Configuração Next.js
- [ ] `next.config.mjs` otimizado
- [ ] `vercel.json` criado
- [ ] `package.json` com todas as dependências
- [ ] Scripts de build funcionam localmente

### 5. Segurança
- [ ] HTTPS habilitado
- [ ] CORS configurado corretamente
- [ ] Headers de segurança presentes
- [ ] Sem dados sensíveis em logs
- [ ] Rate limiting configurado (se necessário)

---

## 🚀 Processo de Deploy

### Step 1: Preparar GitHub
- [ ] Repositório Git inicializado (`git init`)
- [ ] Todos os arquivos commitados
- [ ] Repositório criado no GitHub
- [ ] Primeiro push realizado (`git push -u origin main`)
- [ ] Código disponível em `https://github.com/seu-usuario/mandato-pro`

### Step 2: Conectar Vercel
- [ ] Conta Vercel criada
- [ ] GitHub conectado ao Vercel
- [ ] Repositório autorizado
- [ ] Projeto importado no Vercel

### Step 3: Configurar Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] Variáveis de WhatsApp (se configurado)
- [ ] Variáveis definidas em: Production, Preview, Development

### Step 4: Deploy Inicial
- [ ] Vercel iniciou build automático
- [ ] Build completou sem erros
- [ ] URL de deploy gerada
- [ ] Projeto acessível em `projeto-nome.vercel.app`

---

## ✔️ Testes Pós-Deploy (Após Vercel indicar sucesso)

### 1. Verificações Básicas
- [ ] Site carrega (https://seu-projeto.vercel.app)
- [ ] Página de login renderiza
- [ ] Favicon carrega
- [ ] Estilos (Tailwind) funcionam
- [ ] Imagens carregam corretamente

### 2. Autenticação
- [ ] Login com email/senha funciona
- [ ] Redirecionamento para dashboard após login
- [ ] Logout funciona
- [ ] Sessão persiste ao recarregar
- [ ] Erro de credenciais inválidas exibido

### 3. Dashboard
- [ ] Dashboard carrega com dados reais do Supabase
- [ ] Gráficos/estatísticas exibem dados
- [ ] Sidebar renderiza com todos os módulos
- [ ] Links de navegação funcionam
- [ ] Notificações funcionam

### 4. Módulos Principais
- [ ] **Eleitores**: Pode visualizar e criar
- [ ] **Solicitações**: Pode visualizar e criar protocolo
- [ ] **Agenda**: Eventos carregam do banco
- [ ] **Comunicação**: Chat funciona
- [ ] **Financeiro**: Dados carregam corretamente

### 5. Performance
- [ ] Página carrega em < 3 segundos
- [ ] Interações são responsivas
- [ ] Sem erros de conexão ao Supabase
- [ ] Console limpo (sem erros vermelhos)
- [ ] Mobile responsivo

### 6. Relatórios de Vercel
- [ ] Web Vitals (Performance)
- [ ] Lighthouse Score > 80
- [ ] Sem erros críticos
- [ ] Build time < 5 minutos

---

## 🔧 Troubleshooting

### Se o build falhar
1. Verificar erro específico no log Vercel
2. Replicar erro localmente: `npm run build`
3. Fixes comuns:
   - [ ] Faltam dependências: `npm install`
   - [ ] Erro de sintaxe: verificar erros eslint
   - [ ] Variáveis missing: verificar env vars no Vercel
   - [ ] Erro de módulo: `rm -rf node_modules && npm install`

### Se login não funcionar
1. Verificar se Supabase está acessível (não está em plano free bloqueado)
2. Confirmar credenciais no Vercel
3. Testar localmente com credenciais de produção
4. Verificar console browser para erros de CORS
5. Confirmar usuário admin existe em Supabase

### Se dados não carregam
1. Verificar se Service Role Key está configurada
2. Testar query direto no Supabase dashboard
3. Verificar RLS policies na tabela
4. Confirmar que dados existem no banco
5. Verificar conexão de rede

### Se estilos não aparecem
1. Limpar cache Vercel (Settings → Deployments → Invalidate cache)
2. Fazer novo push para GitHub (force redeploy)
3. Verificar build local: `npm run build`
4. Verificar `next.config.mjs` e `tailwind.config.js`

---

## 📊 Monitoramento Contínuo

### Daily
- [ ] Verificar logs de erro no Vercel
- [ ] Monitorar status do Supabase
- [ ] Conferir notificações de deployment

### Weekly
- [ ] Revisar logs de auditoria
- [ ] Fazer backup do banco
- [ ] Conferir uso de recursos (CPU, storage)

### Monthly
- [ ] Revisar analytics de uso
- [ ] Atualizar dependências
- [ ] Executar health check completo

---

## 📝 Documentação a Consultar

1. **DEPLOY-VERCEL.md** - Instruções passo-a-passo
2. **GUIA-INTEGRACAO-SUPABASE.md** - Detalhes do banco
3. **REFERENCIA-DATABASE.md** - Schema e funções SQL
4. **ULTIMAS-ETAPAS.md** - Setup final antes do deploy

---

## 🎯 Objetivos Pós-Deploy

- [ ] URL de produção documentada
- [ ] Equipe notificada de novo deploy
- [ ] Documentação atualizada para usuários finais
- [ ] Plano de manutenção definido
- [ ] Processo de rollback documentado

---

## 📞 Contatos de Emergência

- **Supabase Status**: https://status.supabase.com
- **Vercel Status**: https://www.vercel-status.com
- **GitHub Status**: https://www.githubstatus.com

---

## ✨ Versão
**Data**: 11 de janeiro de 2026  
**Status**: ✅ Pronto para Deploy
