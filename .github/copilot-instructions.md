# MandatoPro - Sistema de Gestão Política

## Projeto
- **Nome**: MandatoPro
- **Tipo**: Next.js + Tailwind CSS
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth

## Estrutura
- [x] Criar estrutura Next.js
- [x] Configurar Tailwind CSS
- [ ] Criar página de login
- [ ] Criar dashboard com sidebar
- [ ] Configurar módulos principais

## Módulos do Sistema
1. Dashboard (Início)
2. Funcionários
3. Cadastros
4. Emendas
5. Financeiro
6. Geolocalização
7. Comunicados
8. Agenda
9. Aniversariantes
10. Documentos
11. Solicitações
12. Usuários
13. Jurídico
14. Disparo de mensagens

## Tema Visual
- Cor principal: Teal (#14b8a6)
- Sidebar: Dark teal
- Cards: White com sombras
- Ícones: Coloridos por categoria

## Git e Deploy (Contexto Atual)
- Repositório GitHub do projeto está funcionando normalmente.
- Integração com Vercel está funcionando.
- Deploy em produção já foi realizado com sucesso.
- URL de produção ativa: https://mandato-pro.vercel.app

### Diretrizes para o Agente de IA
- Não repetir setup inicial de GitHub ou Vercel quando não for solicitado.
- Assumir que o projeto já está vinculado e operacional para fluxo de deploy.
- Quando solicitado deploy, priorizar apenas build/validação e publicação.
- Evitar etapas redundantes de criação de projeto no Vercel.

### Comandos Padrão (Projeto)
- Desenvolvimento local: `npm run dev`
- Build de produção: `npm run build`
- Iniciar build local: `npm run start`
- Lint do projeto: `npm run lint`
- Deploy produção (Vercel CLI): `npx vercel --prod --yes`

### Sequência Recomendada para Deploy
1. Rodar lint (`npm run lint`) e corrigir erros relevantes.
2. Rodar build local (`npm run build`) para validar compilação.
3. Publicar na Vercel (`npx vercel --prod --yes`).
4. Validar URL de produção e principais fluxos (login, dashboard e usuários).
