# 📚 Plano de Integração - Módulo Documentos com Supabase

## 📋 Avaliação Atual

### ✅ O Que Existe
- Interface completa do módulo de documentos (**3 categorias**: Artes, Modelos, Treinamento) 
- Sistema de UI/UX com busca, filtros e ações (download, visualizar, editar, deletar)
- Integração com sistema de logs (`registrarCadastro`, `registrarDelecao`)
- Componentes bem estruturados com Tailwind CSS
- Página hub e 3 páginas de categorias

### ❌ O Que Falta
1. **Banco de dados** - Nenhuma tabela Supabase criada
2. **Endpoint de API** - `/api/documentos` não existe
3. **Upload de arquivos** - Sem suporte a upload de arquivos reais
4. **Armazenamento** - Sem integração com Supabase Storage
5. **Autenticação** - Sem validação de permissões no backend

---

## 🏗️ Arquitetura Necessária

### 1. **Schema Supabase (Banco de Dados)**

#### Tabela: `documentos`
```sql
CREATE TABLE documentos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(50) NOT NULL, -- 'artes', 'modelos', 'treinamento'
  arquivo_nome VARCHAR(255) NOT NULL,
  arquivo_tipo VARCHAR(20), -- 'pdf', 'docx', 'pptx', etc
  arquivo_tamanho BIGINT, -- em bytes
  arquivo_url TEXT, -- URL do arquivo no Storage
  criador_id UUID REFERENCES auth.users(id),
  criador_nome VARCHAR(255),
  downloads_count INTEGER DEFAULT 0,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'ATIVO', -- 'ATIVO' ou 'INATIVO'
  tags TEXT[], -- array de tags para busca
  versao VARCHAR(20) DEFAULT '1.0'
);

-- Índices para performance
CREATE INDEX idx_documentos_categoria ON documentos(categoria);
CREATE INDEX idx_documentos_criador ON documentos(criador_id);
CREATE INDEX idx_documentos_status ON documentos(status);
```

#### Tabela: `documentos_downloads` (Log de Downloads)
```sql
CREATE TABLE documentos_downloads (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  documento_id BIGINT REFERENCES documentos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nivel VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  data_download TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_downloads_documento ON documentos_downloads(documento_id);
CREATE INDEX idx_downloads_usuario ON documentos_downloads(usuario_id);
```

#### Políticas RLS (Row Level Security)

```sql
-- Qualquer usuário autenticado pode VER documentos ATIVOS
CREATE POLICY "Documentos ativos visíveis para autenticados"
  ON documentos FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'ATIVO');

-- Apenas ADMIN pode CRIAR, EDITAR, DELETAR
CREATE POLICY "Admin pode gerenciar documentos"
  ON documentos
  USING (auth.role() = 'authenticated' AND 
         EXISTS (
           SELECT 1 FROM usuarios u 
           WHERE u.id = auth.uid() AND u.nivel = 'ADMINISTRADOR'
         ))
  WITH CHECK (auth.role() = 'authenticated' AND 
             EXISTS (
               SELECT 1 FROM usuarios u 
               WHERE u.id = auth.uid() AND u.nivel = 'ADMINISTRADOR'
             ));
```

### 2. **Storage Supabase (Armazenamento de Arquivos)**

#### Bucket: `documentos`

```yaml
Nome: documentos
Público: FALSE (controlar via políticas)
Organização:
  documentos/
  ├── artes/          # Artes de campanha
  ├── modelos/        # Modelos de grupos
  └── treinamento/    # Material de treinamento
```

#### Políticas de Storage

```sql
-- Qualquer usuário autenticado pode BAIXAR documentos
CREATE POLICY "Usuários podem baixar documentos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos' AND auth.role() = 'authenticated'
  );

-- Apenas ADMIN pode UPLOAD
CREATE POLICY "Admin pode fazer upload"
  ON storage.objects FOR INSERT
  USING (
    bucket_id = 'documentos' AND
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u 
      WHERE u.id = auth.uid() AND u.nivel = 'ADMINISTRADOR'
    )
  );

-- Apenas ADMIN pode DELETE
CREATE POLICY "Admin pode deletar arquivos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentos' AND
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u 
      WHERE u.id = auth.uid() AND u.nivel = 'ADMINISTRADOR'
    )
  );
```

---

## 🔌 Endpoints da API

### `GET /api/documentos`
**Listar todos os documentos com paginação e filtros**

```javascript
// Query Parameters:
- categoria?: 'artes' | 'modelos' | 'treinamento'
- busca?: string (busca em nome, descricao, tags)
- limite?: number (padrão: 20)
- offset?: number (padrão: 0)
- ordenar?: 'nome' | 'data' | 'downloads' (padrão: 'data')

// Response:
{
  success: true,
  data: [
    {
      id: 1,
      nome: "Folder Campanha 2024",
      descricao: "...",
      categoria: "artes",
      arquivo_nome: "folder-2024.pdf",
      arquivo_tipo: "pdf",
      arquivo_tamanho: 2621440, // bytes
      arquivo_url: "https://...",
      criador_nome: "Admin",
      downloads_count: 45,
      data_criacao: "2024-11-20T...",
      versao: "1.0"
    }
  ],
  total: 42,
  limite: 20,
  offset: 0
}
```

### `POST /api/documentos`
**Criar novo documento com upload de arquivo**

```javascript
// Body (multipart/form-data):
- nome: string (obrigatório)
- descricao: string
- categoria: 'artes' | 'modelos' | 'treinamento' (obrigatório)
- arquivo: File (obrigatório)
- tags: string (opcional, comma-separated)

// Response:
{
  success: true,
  data: {
    id: 123,
    nome: "Folder Campanha 2024",
    categoria: "artes",
    arquivo_url: "https://...",
    data_criacao: "2024-11-20T..."
  }
}
```

### `PUT /api/documentos/[id]`
**Atualizar documento (ADMIN only)**

```javascript
// Body (JSON):
- nome?: string
- descricao?: string
- tags?: string[]
- status?: 'ATIVO' | 'INATIVO'

// Response:
{
  success: true,
  data: { updated documento }
}
```

### `DELETE /api/documentos/[id]`
**Deletar documento e arquivo (ADMIN only)**

```javascript
// Response:
{
  success: true,
  message: "Documento deletado com sucesso"
}
```

### `POST /api/documentos/[id]/download`
**Registrar download e retornar URL assinada**

```javascript
// Response:
{
  success: true,
  downloadUrl: "https://..signed-url..",
  expiresIn: 3600 // segundos
}
```

---

## 📂 Arquivos a Criar/Modificar

### Criar:
- `src/pages/api/documentos/index.js` - CRUD básico
- `src/pages/api/documentos/[id].js` - PUT, DELETE
- `src/pages/api/documentos/[id]/download.js` - Download com tracking

### Modificar:
- `src/pages/documentos/index.js` - Integração API
- `src/pages/documentos/artes-campanha/index.js` - Integração API
- `src/pages/documentos/modelos-grupos/index.js` - Integração API
- `src/pages/documentos/material-treinamento/index.js` - Integração API

---

## 🚀 Sequência de Implementação

### Fase 1: Setup Supabase (30 min)
1. Criar tabelas SQL (`documentos`, `documentos_downloads`)
2. Criar Storage bucket (`documentos`)
3. Configurar RLS e políticas de Storage
4. Testar conexão com Supabase CLI

### Fase 2: Backend (2h)
1. Criar `/api/documentos/index.js` (GET, POST)
2. Criar `/api/documentos/[id].js` (PUT, DELETE)
3. Criar `/api/documentos/[id]/download.js` (Download tracking)
4. Integrar com upload de arquivos
5. Validar autenticação e permissões

### Fase 3: Frontend (2h)
1. Atualizar componentes para chamar API
2. Implementar upload com drag-and-drop
3. Atualizar listagem para dados reais
4. Implementar delete com confirmação
5. Tratar erros e loading states

### Fase 4: Testes (1h)
1. Testar upload e download
2. Testar listagem com filtros
3. Testar permissões (ADMIN only)
4. Testar performance com muitos documentos

---

## 📊 Melhorias Futuras (Backlog)

1. **Versionamento de Modelos** - Histórico de versões
2. **Preview de Arquivos** - Visualizar PDF/DOCX online
3. **Busca Full-Text** - Pesquisa avançada
4. **Tags e Categorização** - Melhor organização
5. **Compartilhamento** - Links públicos
6. **Analytics** - Dashboard de documentos
7. **Compressão** - Otimizar tamanho de arquivos
8. **Conversão** - Converter entre formatos

---

## ✅ Checklist

- [ ] Tabelas SQL criadas
- [ ] Storage bucket criado
- [ ] RLS e políticas configuradas
- [ ] `/api/documentos` implementado
- [ ] Upload funcional
- [ ] Download com tracking
- [ ] Listagem com filtros
- [ ] Delete com confirmação
- [ ] Frontend atualizado
- [ ] Testes completos
- [ ] Deploy em produção
