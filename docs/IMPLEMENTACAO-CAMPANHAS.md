# 📋 Módulo de Campanhas - Implementação Completa

## ✅ O que foi criado

### Estrutura de Arquivos

```
src/pages/cadastros/campanhas/
├── index.js              # Listagem de campanhas com filtros e paginação
├── novo.js              # Formulário para criar/editar campanhas
└── [id].js              # Rotas dinâmicas para edição

src/pages/api/cadastros/campanhas/
├── index.js             # GET/POST campanhas (CRUD)
├── [id].js              # PUT/DELETE campanhas (detalhes e edição)
├── liderancas.js        # GET buscar lideranças (buscador dinâmico)
└── servicos.js          # GET/POST categorias de serviços

supabase/migrations/
└── 201_create_campanhas_tables.sql  # Schema do banco de dados
```

### Componentes do Menu
- **Menu → Cadastros → Campanhas** (novo item adicionado ao Sidebar)

---

## 📊 Banco de Dados

### Tabelas Criadas

#### 1. `categorias_servicos`
Armazena as categorias de serviços oferecidos nas campanhas.

```sql
id (UUID)
nome (VARCHAR 255) - UNIQUE
descricao (TEXT)
ativo (BOOLEAN)
created_at, updated_at
```

**Dados iniciais:**
- Atendimento Médico
- Atendimento Odontológico
- Distribuição de Alimentos
- Orientação Jurídica
- Encaminhamento Social
- Cadastro de Benefícios
- Oficinas de Capacitação
- Emissão de documentos
- Orientação de Saúde
- Outros

#### 2. `campanhas`
Armazena os dados das campanhas.

```sql
id (UUID)
nome (VARCHAR 255)
descricao (TEXT)
local (VARCHAR 255)
data_campanha (DATE)
hora_inicio (TIME)
hora_fim (TIME)
latitude (DECIMAL)
longitude (DECIMAL)
status (VARCHAR 20) - PLANEJAMENTO, EXECUCAO, CONCLUIDA, CANCELADA
criado_por (UUID - FK auth.users)
observacoes (TEXT)
created_at, updated_at
```

***Status padrão:** PLANEJAMENTO*

#### 3. `campanhas_liderancas`
Associa lideranças às campanhas com papel específico.

```sql
id (UUID)
campanha_id (UUID - FK campanhas)
lideranca_id (UUID - FK liderancas)
papel (VARCHAR 50) - APOIO, COORDENADOR, SUPERVISOR
created_at
```

**Constraint:** Cada liderança aparece uma vez por campanha

#### 4. `campanhas_servicos`
Associa serviços às campanhas com quantidade.

```sql
id (UUID)
campanha_id (UUID - FK campanhas)
categoria_servico_id (UUID - FK categorias_servicos)
quantidade (INTEGER)
created_at
```

**Constraint:** Cada serviço aparece uma vez por campanha

---

## 🚀 Como Executar a Migration

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Abra [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo de: `supabase/migrations/201_create_campanhas_tables.sql`
5. Execute a query

### Opção 2: Via Script Node.js

```bash
# Editar o script para apontar para a migration correta
# Depois executar:
node scripts/execute-schema.js
```

### Opção 3: Via CLI Supabase (se configurado)

```bash
supabase db push
```

---

## 📋 Funcionalidades

### Página de Listagem (`/cadastros/campanhas`)

#### Filtros Disponíveis
- ✅ Busca por nome ou descrição
- ✅ Filtro por localidade/bairro
- ✅ Filtro por status (Planejamento, Execução, Concluída, Cancelada)
- ✅ Filtro por período (data início e fim)
- ✅ Limpar todos os filtros

#### Dados Exibidos na Tabela
| Coluna | Dados |
|--------|-------|
| # | ID (primeiros 8 caracteres) |
| Nome | Nome da campanha |
| Local | Local/endereço |
| Data | Data formatada (dd/mm/yyyy) |
| Lideranças | Quantidade de lideranças |
| Status | Badge colorida (Planejamento/Execução/Concluída/Cancelada) |
| Ações | Visualizar, Editar, Excluir |

#### Paginação
- 10 itens por página
- Navegação: Primeira, Anterior, Números, Próxima, Última
- Exibe intervalo de itens mostrados

#### Ações
- **Imprimir**: Gera PDF da listagem
- **Nova Campanha**: Abre formulário
- **Editar**: Abre formulário com dados preenchidos
- **Visualizar**: Exibe popup com detalhes
- **Excluir**: Com confirmação

---

### Página de Formulário (`/cadastros/campanhas/novo` ou `[id]`)

#### Seção 1: Informações Básicas
- Nome da campanha (obrigatório)
- Descrição (opcional)
- Local (obrigatório)
- Latitude (opcional, para geolocalização)
- Longitude (opcional, para geolocalização)

#### Seção 2: Data e Horário
- Data da campanha (obrigatório)
- Hora início (opcional)
- Hora fim (opcional)

#### Seção 3: Lideranças Envolvidas
**Buscador Dinâmico**
- Campo de busca por nome ou CPF
- Botão de busca
- Dropdown com resultados (máx. 10)
- Seleciona apenas lideranças ATIVO

**Tabela de Lideranças Selecionadas**
- Nome
- CPF
- Papel (select: Apoio, Coordenador, Supervisor)
- Botão remove

#### Seção 4: Serviços Oferecidos
**Select de Serviços Existentes**
- Dropdown com categorias disponíveis
- Seleciona várias ao clicar

**Criar Novo Serviço**
- Nome do serviço (obrigatório)
- Descrição (opcional)
- Botão "Criar Serviço" (POST)

**Tabela de Serviços Selecionados**
- Nome do serviço
- Campo de quantidade (number)
- Botão remove

#### Seção 5: Configurações (Coluna Lateral)
- Status (select: Planejamento, Execução, Concluída, Cancelada)
- Observações (textarea)

#### Resumo (Coluna Lateral)
- Contagem de lideranças
- Contagem de serviços
- Status atual

#### Botões de Ação
- **Criar/Atualizar Campanha**: Salva os dados
- **Cancelar**: Volta para a listagem

---

## 🔌 Endpoints da API

### GET `/api/cadastros/campanhas`
Lista campanhas com filtros.

**Query Parameters:**
```js
{
  status: "PLANEJAMENTO|EXECUCAO|CONCLUIDA|CANCELADA",
  search: "termo_busca",
  localidade: "bairro_ou_regiao",
  dataInicio: "2026-02-01",
  dataFim: "2026-03-01",
  limit: 100,
  offset: 0
}
```

**Response:**
```json
{
  "data": [{
    "id": "uuid",
    "nome": "...",
    "local": "...",
    "data_campanha": "2026-02-25",
    "status": "PLANEJAMENTO",
    "campanhas_liderancas": [...],
    "campanhas_servicos": [...],
    ...
  }],
  "total": 15,
  "limit": 100,
  "offset": 0
}
```

### POST `/api/cadastros/campanhas`
Cria nova campanha.

**Request Body:**
```json
{
  "nome": "Campanha de Saúde",
  "descricao": "Atendimento médico no bairro centro",
  "local": "Praça Central",
  "dataCampanha": "2026-03-15",
  "horaInicio": "09:00",
  "horaFim": "17:00",
  "latitude": -5.132683,
  "longitude": -38.256621,
  "status": "PLANEJAMENTO",
  "observacoes": "...",
  "liderancos": [{
    "id": "uuid",
    "nome": "João Silva",
    "papel": "COORDENADOR"
  }],
  "servicos": [{
    "id": "uuid",
    "nome": "Atendimento Médico",
    "quantidade": 50
  }]
}
```

**Response:** Status 201 + objeto campanha criada

### GET `/api/cadastros/campanhas/[id]`
Obtém detalhes de uma campanha.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "nome": "...",
    "campanhas_liderancas": [
      {
        "id": "uuid",
        "lideranca_id": "uuid",
        "papel": "APOIO",
        "liderancas": { "id": "uuid", "nome": "João", "cpf": "...", ... }
      }
    ],
    "campanhas_servicos": [
      {
        "id": "uuid",
        "categoria_servico_id": "uuid",
        "quantidade": 50,
        "categorias_servicos": { "id": "uuid", "nome": "Atendimento Médico", ... }
      }
    ],
    ...
  }
}
```

### PUT `/api/cadastros/campanhas/[id]`
Atualiza uma campanha.

**Request Body:** Mesmo do POST

**Response:** Status 200 + objeto atualizado

### DELETE `/api/cadastros/campanhas/[id]`
Deleta uma campanha (e todas as associações).

**Response:** Status 200 + mensagem de sucesso

---

### GET `/api/cadastros/campanhas/liderancas`
Busca lideranças ativas (para o buscador dinâmico).

**Query Parameters:**
```js
{
  search: "nome_ou_cpf",
  limit: 20
}
```

**Response:**
```json
{
  "data": [{
    "id": "uuid",
    "nome": "João Silva",
    "cpf": "123.456.789-00",
    "telefone": "(85) 98888-9999",
    "influencia": 5,
    "areaAtuacao": "Centro",
    "status": "ATIVO"
  }]
}
```

---

### GET `/api/cadastros/campanhas/servicos`
Lista categorias de serviços disponíveis.

**Response:**
```json
{
  "data": [{
    "id": "uuid",
    "nome": "Atendimento Médico",
    "descricao": "...",
    "ativo": true,
    "created_at": "2026-02-25T10:30:00Z"
  }]
}
```

### POST `/api/cadastros/campanhas/servicos`
Cria nova categoria de serviço.

**Request Body:**
```json
{
  "nome": "Novo Serviço",
  "descricao": "Descrição opcional"
}
```

**Response:** Status 201 + objeto criado

---

## 🎨 Styling & UX

### Cores Utilizadas
- **Primária**: Teal (#14b8a6) - Button principal, headers
- **Secundária**: Gray (#6B7280) - Texto secundário
- **Status**:
  - Planejamento: Blue (#3B82F6)
  - Execução: Amber (#F59E0B)
  - Concluída: Green (#10B981)
  - Cancelada: Red (#EF4444)

### Componentes
- ✅ Cards com sombras sutis
- ✅ Tabelas responsivas com hover
- ✅ Modals para confirmações
- ✅ Badges para status
- ✅ Buscadores dinâmicos com dropdown
- ✅ Paginação completa

### Responsividade
- Mobile: Stack vertical, menus colapsáveis
- Tablet: Grid 2 colunas
- Desktop: Grid completo com sidebar

---

## 🔐 Segurança

### Row Level Security (RLS)
Todas as tabelas têm RLS habilitado com políticas:
- **SELECT**: Todos os usuários autenticados podem visualizar
- **INSERT/UPDATE/DELETE**: Apenas usuários autenticados

### Validações
- Backend: Validação de campos obrigatórios
- Frontend: Validação com warnings
- Database: Constraints e checks

---

## 🧪 Para Testar

### 1. Executar a Migration
Siga as instruções em "Como Executar a Migration" acima

### 2. Criar Campanhas de Teste
```bash
# Acesse o dashboard
http://localhost:3000/dashboard

# Navegue para
Cadastros → Campanhas

# Clique em "Nova Campanha"
# Preencha todos os campos obrigatórios
# Selecione lideranças
# Selecione serviços
# Clique em "Criar Campanha"
```

### 3. Validar Listagem
- Verifique se a campanha aparece na listagem
- Teste os filtros
- Teste a paginação
- Teste os botões de ação

### 4. Validar Edição
- Clique em editar
- Modifique dados
- Adicione/remova lideranças e serviços
- Clique em "Atualizar Campanha"

### 5. Validar Exclusão
- Clique em excluir
- Confirme a exclusão
- Verifique se foi removida

---

## 📝 Notas Importantes

1. **Tabela de Lideranças**: Apenas lideranças com status "ATIVO" aparecem no buscador
2. **Papéis de Lideranças**: Apoio, Coordenador, Supervisor
3. **Quantidade de Serviços**: Pode ser 0 (para controle apenas)
4. **Datas**: Formato ISO (YYYY-MM-DD) no banco, exibida como dd/mm/yyyy no frontend
5. **Geolocalização**: Opcional, permite integração com Google Maps futuramente
6. **Cascata de Deletes**: Deletar campanha remove todas as associações automaticamente

---

## 🔄 Fluxo de Dados

```
Frontend (novo.js)
    ↓
    └─→ Busca Lideranças (GET /api/.../liderancas)
    └─→ Carrega Serviços (GET /api/.../servicos)
    └─→ Submete Formulário (POST/PUT /api/cadastros/campanhas)
        ↓
Backend (API)
    ↓
    └─→ Validação
    └─→ Persiste em Campanhas
    └─→ Persiste em Campanhas_Liderancas
    └─→ Persiste em Campanhas_Servicos
        ↓
Supabase (PostgreSQL + RLS)
    ↓
    └─→ Response JSON
        ↓
Frontend (index.js)
    ↓
    └─→ Exibe em Tabela com Filtros/Paginação
```

---

## ✨ Próximas Melhorias (Sugestões)

1. **Integração com Agenda**: Vincular campanhas à agenda oficial do parlamentar
2. **Relatórios**: Gerar relatórios PDF com presença, serviços oferecidos, etc.
3. **WhatsApp**: Enviar notificações para lideranças via WhatsApp Business
4. **Mapa**: Exibir localização das campanhas em mapa (Google Maps)
5. **Presença**: Registrar presença de eleitores nas campanhas
6. **Histórico**: Exibir histórico de mudanças de status
7. **Exportação**: Exportar listas para Excel
8. **Notificações**: Sistema de notificações em tempo real

---

## 📞 Suporte

Para dúvidas sobre implementação ou integração com outras partes do sistema, consulte:
- Documentação de Campanhas no Sidebar
- Código-fonte em `src/pages/cadastros/campanhas/`
- APIs em `src/pages/api/cadastros/campanhas/`
