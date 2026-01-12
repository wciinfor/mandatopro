# MandatoPro - Análise Completa do Projeto

## 📋 Resumo Geral
**MandatoPro** é um sistema de gestão política completo desenvolvido com:
- **Framework**: Next.js + React
- **Styling**: Tailwind CSS
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Mapas**: Google Maps API
- **Notificações**: Sistema de Bell Notifications
- **Comunicação**: WhatsApp Business API

---

## 🏗️ Arquitetura do Projeto

### Estrutura de Pastas

```
mandato-pro/
├── docs/                    # Documentação (37 arquivos .md)
├── public/                  # Arquivos públicos
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   ├── config/              # Configurações (Maps, etc)
│   ├── contexts/            # Context API (Auth, Notifications)
│   ├── data/                # Dados mock
│   ├── hooks/               # Custom hooks
│   ├── pages/               # Páginas Next.js
│   ├── services/            # Serviços (logs, WhatsApp)
│   ├── styles/              # CSS global
│   └── utils/               # Utilitários (permissões, PDF, relatórios)
└── data/logs/               # Logs do sistema
```

---

## 🔐 Sistema de Autenticação e Permissões

### Contexto de Autenticação (`AuthContext.js`)
- Gerencia login/logout do usuário
- Armazena dados do usuário em localStorage
- Fornece context para toda a aplicação

### Níveis de Acesso
1. **ADMINISTRADOR**: Acesso total ao sistema
2. **LIDERANCA**: Acesso a módulos de liderança
3. **OPERADOR**: Acesso limitado a funcionalidades básicas
4. **DESCONHECIDO**: Usuário não autenticado

### Sistema de Permissões (`permissions.js`)
- Define permissões por nível de acesso
- Controla acesso a módulos específicos
- Validação em componentes (`ProtectedRoute.js`)

---

## 📄 Página de Login
**Arquivo**: `pages/login.js`

### Funcionalidades
- Autenticação por email e senha
- Registro de tentativas de login (sucesso e erro)
- Redirecionamento para dashboard após login
- Tratamento de erros com feedback ao usuário

### Sistema de Logs
- `registrarLogin()`: Registra logins bem-sucedidos
- `registrarErro()`: Registra tentativas falhas
- Dados armazenados em `data/logs/logs.json`

---

## 🎯 Dashboard Principal
**Arquivo**: `pages/dashboard.js` (391 linhas)

### Componentes Principais

#### 1. **Estatísticas Gerais**
- Funcionários cadastrados
- Eleitores ativos
- Solicitações pendentes
- Comunicados ativos
- Eventos agendados
- Aniversariantes do mês

#### 2. **Últimas Solicitações**
- Lista das 4 últimas solicitações
- Filtrado por nível de acesso do usuário
- Status: NOVA, EM_ANDAMENTO, ATENDIDA
- Prioridade: URGENTE, ALTA, MÉDIA, BAIXA

#### 3. **Próximos Eventos**
- Eventos da agenda próximos
- Tipos: PARLAMENTAR, LOCAL
- Exibição de local e horário

#### 4. **Registros de Acesso**
- Hook `useRegistrarAcesso()` registra cada acesso ao dashboard

---

## 📚 Módulos Implementados

### 1. **📋 AGENDA** (`pages/agenda/`)
**Arquivos**:
- `index.js` - Lista de eventos (553 linhas)
- `[id].js` - Detalhes do evento
- `novo.js` - Criar novo evento

**Funcionalidades**:
- ✅ Criar, editar, visualizar e excluir eventos
- ✅ Filtros por tipo (PARLAMENTAR/LOCAL) e período
- ✅ Busca por título ou descrição
- ✅ Exibição de participantes e confirmações
- ✅ Impressão em PDF
- ✅ Validação de permissões por nível

**Dados de Evento**:
```javascript
{
  id, titulo, descricao, data, horaInicio, horaFim,
  local, tipo, criadoPor, participantes, confirmados,
  categoria, observacoes
}
```

---

### 2. **👥 CADASTROS** (`pages/cadastros/`)

#### A. **Eleitores** (`eleitores/`)
- Cadastro completo de eleitores
- Vinculação com lideranças
- Status: ATIVO, INATIVO, TRANSFERIDO
- Dados: CPF, email, telefone, endereço

#### B. **Funcionários** (`funcionarios/`)
- Cadastro de funcionários da assessoria
- Cargos e departamentos
- Dados pessoais e profissionais
- Histórico de acesso

#### C. **Lideranças** (`liderancas/`)
- Gestão de líderes comunitários
- Nível de influência
- Área de atuação
- Eleitores vinculados

#### D. **Atendimentos** (`atendimentos/`)
- Registro de atendimentos ao público
- Protocolo de atendimento
- Histórico por eleitor

---

### 3. **📄 DOCUMENTOS** (`pages/documentos/`)

#### A. **Artes de Campanha** (`artes-campanha/`)
- Gestão de materiais visuais
- Upload e armazenamento
- Categorização por tipo

#### B. **Material de Treinamento** (`material-treinamento/`)
- Documentos educacionais
- Vídeos e apresentações
- Controle de acesso

#### C. **Modelos para Grupos** (`modelos-grupos/`)
- Templates de mensagens
- Modelos de documentos
- Reuso em disparos

---

### 4. **💰 FINANCEIRO** (`pages/financeiro/`)

#### A. **Caixa** (`caixa/`)
- Saldo de caixa
- Movimentações financeiras
- Reconciliação bancária

#### B. **Despesas** (`despesas/`)
- Registro de despesas
- Categorização
- Aprovações

#### C. **Receitas/Doadores** (`doadores/`)
- Registro de doações
- Controle de doadores
- Limites legais

#### D. **Lançamentos** (`lancamentos/`)
- Transações financeiras
- Auditoria de movimentos

#### E. **Faturas** (`faturas/`)
- Gestão de faturas
- Pagamentos

#### F. **Relatórios** (`relatorios/`)
- Relatórios financeiros
- Exportação em PDF/Excel

---

### 5. **🗓️ EMENDAS** (`pages/emendas/`)

#### A. **Emendas** (`emendas/`)
- Gestão de emendas parlamentares
- Valor, descrição, beneficiários

#### B. **Órgãos** (`orgaos/`)
- Órgãos responsáveis
- Contatos

#### C. **Repasses** (`repasses/`)
- Controle de repasses de valores
- Datas e valores

#### D. **Responsáveis** (`responsaveis/`)
- Gestão de responsáveis pelos repasses

---

### 6. **🗺️ GEOLOCALIZAÇÃO** (`pages/geolocalizacao/index.js`)
**552 linhas**

**Funcionalidades**:
- ✅ Integração Google Maps API
- ✅ Marcadores de eleitores e lideranças
- ✅ Filtros por liderança, cidade, bairro, status
- ✅ InfoWindow com dados ao clicar
- ✅ Zoom e controles de mapa
- ✅ Tipos de marcador: ELEITOR, LIDERANCA
- ✅ Status de atividade

**Dados de Marcador**:
```javascript
{
  id, tipo, nome, cidade, bairro, endereco,
  latitude, longitude, status, telefone, influencia
}
```

---

### 7. **💬 COMUNICAÇÃO** (`pages/comunicacao/index.js`)
**579 linhas**

#### Funcionalidades:
- ✅ Sistema de Chat entre usuários
- ✅ Disparo de Mensagens em Massa
- ✅ Integração WhatsApp Business
- ✅ Status de leitura (✓, ✓✓)
- ✅ Notificações em tempo real

#### Abas:
1. **Chat** - Comunicação 1:1 entre usuários
2. **Disparo** - Envio de mensagens para grupos/listas

**Dados de Mensagem**:
```javascript
{
  id, remetenteId, destinatarioId, texto,
  dataHora, lida, tipo, anexos
}
```

---

### 8. **🔔 SOLICITAÇÕES** (`pages/solicitacoes/index.js`)
**467 linhas**

**Funcionalidades**:
- ✅ Registro de solicitações da população
- ✅ Protocolo único por solicitação
- ✅ Categorização (Educação, Infraestrutura, Saúde, etc)
- ✅ Priorização (URGENTE, ALTA, MÉDIA, BAIXA)
- ✅ Status: NOVO, EM_ANDAMENTO, ATENDIDA, RECUSADA
- ✅ Busca e filtros avançados
- ✅ Atribuição de atendente
- ✅ Rastreamento completo

**Dados de Solicitação**:
```javascript
{
  id, protocolo, titulo, solicitante, tipoSolicitante,
  categoria, prioridade, status, municipio, bairro,
  dataAbertura, descricao, observacoes, atendente
}
```

---

### 9. **🎂 ANIVERSARIANTES** (`pages/aniversariantes/`)
- Lista de aniversariantes
- Filtros por período
- Envio de mensagens personalizadas
- Configurações de automação

---

### 10. **👤 USUÁRIOS** (`pages/usuarios/index.js`)
**432 linhas**

**Funcionalidades**:
- ✅ Gestão de usuários do sistema
- ✅ Criação, edição, desativação
- ✅ Atribuição de níveis (ADMIN, LIDERANÇA, OPERADOR)
- ✅ Vinculação com lideranças
- ✅ Histórico de acesso
- ✅ Controle de senha e permissões
- ✅ Bloqueio/desbloqueio de contas

**Dados de Usuário**:
```javascript
{
  id, nome, email, nivel, status, liderancaVinculada,
  dataCadastro, ultimoAcesso
}
```

---

### 11. **⚖️ JURÍDICO** (`pages/jurídico/`)
- Documentos legais
- Contratos
- Pareceres jurídicos
- Conformidade legal

---

### 12. **🔐 CONFIGURAÇÕES** (`pages/configuracoes/`)
- Configurações do sistema (`sistema.js`)
- Preferências de usuário
- Integrações
- Backup e restauração

---

### 13. **📊 AUDITORIA** (`pages/auditoria/logs.js`)
- Logs de todas as ações do sistema
- Rastreamento de quem fez o quê e quando
- Relatórios de auditoria
- Exportação de registros

---

## 🔌 API Endpoints

### Arquivo: `pages/api/`

#### 1. **Consulta TSE** (`consulta-tse.js`)
- Integração com banco de dados de eleitores do TSE
- Validação de CPF
- Consulta de dados eleitorais

#### 2. **Notificações** (`enviar-notificacao.js`)
- Envio de notificações in-app
- Integração com NotificationContext
- Bell de notificações

#### 3. **Comunicação** (`comunicacao/`)
- Endpoints para chat
- Envio de mensagens
- Historico de conversas

#### 4. **WhatsApp Business** (`whatsapp-business/`)
- Integração com WhatsApp Business API
- Envio de mensagens em massa
- Confirmação de entrega
- Webhook para respostas

#### 5. **Configurações** (`configuracoes/`)
- CRUD de configurações do sistema
- Preferências de integração

#### 6. **Logs** (`logs/`)
- Registro de ações do usuário
- Armazenamento em arquivo JSON
- Consulta de logs

---

## 🎨 Componentes Principais

### Layout & Estrutura
- **Layout.js** - Template principal com sidebar
- **Sidebar.js** - Menu lateral com navegação
- **ProtectedRoute.js** - Proteção de rotas por permissão

### Formulários & Modais
- **Modal.js** - Componente modal reutilizável
- **DisparoMassaModal.js** - Modal para disparo em massa
- **BuscaEleitor.js** - Busca integrada de eleitores

### Notificações
- **NotificationBell.js** - Bell de notificações
- **NotificationContext.js** - Gerenciamento de notificações

### Autenticação
- **ProtectedRoute.js** - Validação de acesso
- **AuthContext.js** - Gerenciamento de autenticação

---

## 🛠️ Utilitários

### `utils/permissions.js`
- Define roles: ADMINISTRADOR, LIDERANCA, OPERADOR
- Define módulos e permissões por nível
- Funções de validação de acesso

### `utils/pdfGenerator.js`
- Geração de PDFs
- Exportação de relatórios
- Impressão de documentos

### `utils/relatorios.js`
- Geração de relatórios
- Formatação de dados
- Estatísticas

### `services/logService.js`
- Registro de ações do usuário
- Log de tentativas de login
- Log de erros

### `services/whatsapp-business.js`
- Integração WhatsApp Business API
- Envio de mensagens
- Webhook handler

---

## 📊 Hooks Customizados

### `useModal.js`
- Gerenciamento de modal
- Estados: open, close, showSuccess, showConfirm
- Reutilizável em componentes

### `useRegistrarAcesso.js`
- Hook que registra acesso do usuário a páginas
- Integrado com logService
- Rastreamento de navegação

---

## 🔄 Fluxo de Dados

### Autenticação
```
Login → AuthContext → localStorage → ProtectedRoute → Dashboard
```

### Navegação
```
Sidebar → Next.js Router → Página → Componentes → Modais
```

### Notificações
```
Ação do Usuário → NotificationContext → NotificationBell
```

### Registros
```
Ação → logService → logs.json → Auditoria/Dashboard
```

---

## 🚀 Funcionalidades em Destaque

### ✅ Implementadas
- [x] Autenticação completa
- [x] Dashboard com estatísticas
- [x] Gestão de eleitores, funcionários e lideranças
- [x] Agenda com eventos
- [x] Solicitações com protocolo
- [x] Sistema de documentos
- [x] Geolocalização com Google Maps
- [x] Chat e disparos de mensagens
- [x] Auditoria e logs
- [x] Permissões por nível de acesso
- [x] Gestão de usuários
- [x] Notificações

### 🔄 Em Desenvolvimento
- Sistema financeiro completo
- WhatsApp Business API
- Configurações avançadas
- Jurídico

---

## 📈 Próximos Passos Recomendados

1. **Integração com Banco de Dados**
   - Conectar Supabase
   - Substituir mock data por queries reais
   - Implementar migrations

2. **Melhorias de Performance**
   - Otimizar renderização
   - Implementar lazy loading
   - Cache de dados

3. **Segurança**
   - Validação de CSRF
   - Rate limiting
   - Criptografia de dados sensíveis

4. **Testes**
   - Testes unitários (Jest)
   - Testes de integração
   - Testes E2E (Cypress)

5. **Deploy**
   - Configuração CI/CD
   - Deploy em produção
   - Monitoramento

---

**Última atualização**: 11 de janeiro de 2026
**Status**: Análise completa do projeto estruturado e documentado
