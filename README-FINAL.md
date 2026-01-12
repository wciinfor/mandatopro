# 🏛️ MandatoPro - Sistema de Gestão Política

Sistema completo de gestão política desenvolvido com **Next.js**, **Tailwind CSS**, **Supabase** e **Google Maps**.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)
![License](https://img.shields.io/badge/License-MIT-blue)
![Node](https://img.shields.io/badge/Node-20.x-green)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)

---

## 🎯 Características

### 📊 Módulos Principais
- **Dashboard** - Visão geral com estatísticas em tempo real
- **Eleitores** - Cadastro e gestão de base eleitoral
- **Lideranças** - Gestão de líderes comunitários
- **Solicitações** - Sistema de protocolo para solicitações públicas
- **Agenda** - Calendário de eventos e reuniões
- **Comunicação** - Chat interno e disparo de mensagens em massa
- **Documentos** - Gestão de artes, modelos e materiais
- **Financeiro** - Controle de receitas, despesas e doadores
- **Emendas** - Gestão de emendas parlamentares
- **Auditoria** - Logs completos de todas as ações

### 🔐 Segurança
- Autenticação via Supabase Auth
- Sistema de permissões por nível (Admin, Liderança, Operador)
- Row Level Security (RLS) no PostgreSQL
- Logs de auditoria completos
- HTTPS em produção
- CSRF Protection

### 🚀 Performance
- Next.js 16 com otimizações
- PostgreSQL no Supabase
- Índices de database para queries rápidas
- Image optimization automático
- Caching inteligente

---

## 🛠️ Stack Tecnológico

### Frontend
- **Next.js 16** - Framework React
- **React 19** - UI components
- **Tailwind CSS 3** - Estilos
- **FontAwesome** - Ícones
- **Google Maps API** - Geolocalização
- **Axios** - HTTP client

### Backend
- **Supabase (PostgreSQL)** - Banco de dados
- **Supabase Auth** - Autenticação
- **Node.js API Routes** - Endpoints customizados

### DevOps
- **Vercel** - Hosting e deployment
- **Git/GitHub** - Controle de versão
- **npm** - Gerenciador de dependências

---

## 📋 Requisitos

- Node.js 20.x ou superior
- npm ou yarn
- Conta no Supabase (https://supabase.com)
- Conta no Vercel (https://vercel.com) para deploy

---

## 🚀 Começando

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/mandato-pro.git
cd mandato-pro
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

### 4. Iniciar servidor de desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000/login

---

## 🔑 Credenciais de Teste

```
Email:  admin@mandatopro.com
Senha:  Teste123!
Nível:  ADMINISTRADOR
```

---

## 📦 Estrutura do Projeto

```
mandato-pro/
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   ├── contexts/            # Context API (Auth, Notifications)
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Bibliotecas (Supabase client)
│   ├── pages/               # Páginas Next.js
│   ├── services/            # Serviços (DB, logs, etc)
│   ├── styles/              # CSS global
│   └── utils/               # Utilitários (permissões, PDF, etc)
├── public/                  # Arquivos estáticos
├── scripts/                 # Scripts de automação
├── supabase/                # Migrações SQL
├── docs/                    # Documentação
├── .env.local               # Variáveis de ambiente (não commitar!)
├── next.config.mjs          # Configuração Next.js
├── vercel.json              # Configuração Vercel
├── tailwind.config.js       # Configuração Tailwind
└── package.json             # Dependências
```

---

## 🔧 Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de dev

# Produção
npm run build            # Build para produção
npm start                # Inicia servidor de produção

# Utilitários
npm run lint             # Verifica erros de sintaxe
node scripts/check-db.js # Verifica status do banco
node scripts/db.js seed  # Insere dados de teste
```

---

## 📚 Documentação

- [Guia de Integração Supabase](./docs/GUIA-INTEGRACAO-SUPABASE.md)
- [Referência de Database](./docs/REFERENCIA-DATABASE.md)
- [Deploy no Vercel](./DEPLOY-VERCEL.md)
- [Últimas Etapas](./ULTIMAS-ETAPAS.md)

---

## 🔐 Variáveis de Ambiente

### Obrigatórias
- `NEXT_PUBLIC_SUPABASE_URL` - URL do projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave pública do Supabase

### Opcionais
- `SUPABASE_SERVICE_ROLE_KEY` - Para operações admin no server
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Para mapa de geolocalização
- `WHATSAPP_BUSINESS_PHONE_ID` - Para integração WhatsApp
- `WHATSAPP_BUSINESS_ACCESS_TOKEN` - Token de acesso WhatsApp
- `WHATSAPP_WEBHOOK_TOKEN` - Token webhook para WhatsApp

---

## 🚀 Deploy

### Vercel (Recomendado)

1. Faça push do código para GitHub
2. Conecte seu repositório no Vercel
3. Configure variáveis de ambiente
4. Deploy automático!

Veja [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) para instruções detalhadas.

### Outros Hosts
O projeto funciona em qualquer host que suporte Node.js 20+:
- Heroku
- Railway
- Render
- AWS
- Google Cloud
- etc.

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja [LICENSE](./LICENSE) para mais detalhes.

---

## 📞 Suporte

- **Issues**: Abra uma issue no GitHub para bugs e features
- **Discussões**: Use a aba Discussions para dúvidas gerais
- **Email**: contato@mandatopro.com (quando disponível)

---

## 🎓 Recursos Úteis

- [Documentação Next.js](https://nextjs.org/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Tailwind CSS](https://tailwindcss.com/docs)
- [Documentação Google Maps API](https://developers.google.com/maps/documentation)

---

## ✨ Agradecimentos

Desenvolvido com ❤️ para melhorar a gestão política no Brasil.

---

**Versão**: 1.0.0  
**Data de Atualização**: 11 de janeiro de 2026  
**Status**: Em desenvolvimento ativo
