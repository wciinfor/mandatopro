# Módulo Documentos - Implementação Completa

## 📋 Visão Geral

O módulo **Documentos** foi criado como um repositório centralizado para gerenciar materiais de campanha, modelos de documentos e materiais de treinamento. O sistema utiliza uma arquitetura hub-and-spoke com 3 categorias principais interconectadas.

## 🏗️ Estrutura do Módulo

```
src/pages/documentos/
├── index.js                           (Hub - Galeria de Categorias)
├── artes-campanha/
│   └── index.js                       (Lista de Artes)
├── modelos-grupos/
│   └── index.js                       (Lista de Modelos)
└── material-treinamento/
    └── index.js                       (Lista de Materiais)
```

## 🎯 Três Categorias Principais

### 1. **Artes de Campanha** 🎨
- **Cor Principal**: Rosa/Vermelho (`bg-pink-100`, `text-pink-600`)
- **Ícone**: `faPalette`
- **Conteúdo**: Folders, santinhos, cartazes, designs, adesivos, camisetas
- **Público**: Todos os usuários
- **Recursos**:
  - 6 artes de exemplo com diferentes tipos (PDF, PSD, PNG)
  - Preview visual com emoji
  - Download e visualização
  - Estatísticas de downloads por arte
  - Admin pode criar, editar e deletar

### 2. **Modelos de Grupos** 👥
- **Cor Principal**: Azul (`bg-blue-100`, `text-blue-600`)
- **Ícone**: `faUsers`
- **Conteúdo**: Petições, ofícios, atas de reunião, termos, relatórios, formulários
- **Público**: Lideranças, grupos, admin
- **Recursos**:
  - 6 modelos de exemplo organizados por categoria
  - Agrupamento por tipo de documento
  - Versionamento (v1.0, v2.1)
  - Botão de duplicação para criar cópias personalizadas
  - Filtro por categoria de documento
  - Rastreamento de downloads
  - Admin pode criar, editar e deletar

### 3. **Material de Treinamento** 📚
- **Cor Principal**: Verde (`bg-green-100`, `text-green-600`)
- **Ícone**: `faBook`
- **Conteúdo**: Guias, vídeos, apresentações, checklists, ferramentas
- **Público**: Todos os usuários
- **Recursos**:
  - 8 materiais de exemplo (5 vídeos, 2 PDFs, 1 Excel)
  - Classificação por nível (Iniciante, Intermediário, Avançado)
  - Duração indicada para cada material
  - Indicador de favoritos
  - Botão "Assistir" para vídeos
  - Filtro por tipo de material
  - Admin pode criar, editar e deletar

## 🔗 Página Hub (Index)

**Arquivo**: `src/pages/documentos/index.js`

### Funcionalidades:
1. **Galeria de Categorias**
   - 3 cards grandes representando cada categoria
   - Cores e ícones distintos para cada uma
   - Descrição clara do conteúdo
   - Estatísticas (número de documentos, downloads totais)

2. **Resumo Geral**
   - Total de categorias
   - Total de documentos
   - Total de downloads
   - Espaço utilizado (MB)

3. **Navegação**
   - Click em um card abre aquela categoria
   - Gerenciamento de estado com `categoriaSelecionada`

## 💾 Dados e Estado

Cada página de categoria mantém seu próprio estado com dados mock incluindo:
- `id`: Identificador único
- `nome`: Nome do documento
- `descricao`: Descrição do conteúdo
- `arquivo`: Nome do arquivo
- `tipo`: Extensão (pdf, docx, xlsx, mp4, psd, png, etc)
- `tamanho`: Tamanho do arquivo em MB/KB
- `dataCriacao`: Data de criação
- `criador`: Quem criou
- `downloads`: Número de downloads

### Dados Específicos por Categoria:

**Artes de Campanha**:
- `imagem`: Emoji para representação visual

**Modelos de Grupos**:
- `categoria`: Tipo de documento (Documentos Formais, Registro de Atividades, etc)
- `status`: Estado do modelo (Ativo, Inativo)
- `versao`: Número da versão

**Material de Treinamento**:
- `categoria`: Tipo de material (Guias, Vídeos, Apresentações, Ferramentas)
- `favoritos`: Número de usuários que favoritaram
- `duracao`: Duração ou extensão do material
- `nivel`: Nível de dificuldade

## 🔐 Controle de Acesso

**Públicos (Todos os Usuários)**:
- Visualizar documentos
- Pesquisar e filtrar
- Baixar arquivos
- Visualizar/Assistir conteúdo

**Apenas Administradores**:
- Criar novos documentos
- Editar documentos existentes
- Deletar documentos
- Botões adicionais aparecem apenas para admin

Verificação: `usuario?.nivel === 'ADMINISTRADOR'`

## 🔍 Recursos de Busca e Filtro

### Artes de Campanha
- Busca por nome e descrição
- Em tempo real com `searchTerm` state

### Modelos de Grupos
- Busca por nome, descrição e categoria
- Agrupamento automático por categoria após filtro
- Em tempo real

### Material de Treinamento
- Busca por nome, descrição e categoria
- Filtro por tipo (Todos, Vídeos, PDFs, Apresentações, Ferramentas)
- Ambos funcionam juntos

## 🎨 Design e UX

### Cores Temáticas:
- **Hub**: Gradiente teal (principal do sistema)
- **Artes**: Rosa/Vermelho (criatividade)
- **Modelos**: Azul (profissionalismo)
- **Treinamento**: Verde (aprendizado)

### Componentes Reutilizados:
- `Layout`: Wrapper padrão com sidebar
- `Modal`: Para confirmações e mensagens
- `useModal`: Hook para gerenciar estado do modal
- FontAwesome icons para visualização

### Padrões de UI:
- Cards com hover effects
- Gradientes nos headers
- Badges para categorias/tipos
- Estatísticas em cardinhos
- Botões com ícones para ações

## 📊 Integração com Sistema de Logs

Cada ação é registrada automaticamente:

1. **Acesso**: `useRegistrarAcesso()` no mount de cada página
   - Rastreia quando usuário acessa cada categoria

2. **Deleção**: `registrarDelecao()` quando admin deleta documento
   - Registra qual documento foi removido

3. **Criação**: `registrarCadastro()` quando duplica modelo ou cria novo
   - Rastreia novos documentos adicionados

4. **Acesso a Material**: `registrarAcesso()` quando abre vídeo/material
   - Rastreia visualizações de conteúdo

5. **Erros**: `registrarErro()` se algo der errado
   - Log de problemas durante operações

## 🔄 Fluxos de Usuário

### Descobrir Materiais:
1. Usuário acessa `/documentos`
2. Vê galeria com 3 categorias
3. Clica na categoria de interesse
4. Vê lista com filtro e busca
5. Clica para baixar/visualizar

### Duplicar Modelo (Modelos de Grupos):
1. Usuário vê modelo interessante
2. Clica em "Duplicar" (botão com ícone de cópia)
3. Cópia é criada com "(Cópia)" no nome
4. Lista é atualizada automaticamente
5. Usuário pode agora editar sua cópia

### Administrador Gerencia:
1. Admin vê botões extras: "Novo Documento", "Editar", "Deletar"
2. Ao deletar, confirma ação em modal
3. Sistema registra todas as ações nos logs

## 🚀 Próximas Implementações

### Funcionalidades Propostas:
1. **Upload de Arquivos**
   - Criar endpoint `/api/documentos/upload`
   - Suportar drag-and-drop
   - Validar tipo e tamanho de arquivo

2. **Armazenamento Real**
   - Migrar de dados mock para banco de dados
   - Salvar arquivos no servidor/cloud storage

3. **Busca Avançada**
   - Full-text search em banco de dados
   - Faceted navigation

4. **Versionamento de Modelos**
   - Histórico de versões anteriores
   - Reverter para versão anterior

5. **Compartilhamento**
   - Link de download público
   - Compartilhamento com grupos específicos

6. **Analytics**
   - Dashboard de documentos mais baixados
   - Materiais mais assistidos
   - Tendências de uso

7. **Integração Social**
   - Comentários nos documentos
   - Avaliações/ratings
   - Recomendações baseadas em acesso

## 📝 Arquivos Criados

1. `src/pages/documentos/index.js` - Hub principal (360 linhas)
2. `src/pages/documentos/artes-campanha/index.js` - Artes (280 linhas)
3. `src/pages/documentos/modelos-grupos/index.js` - Modelos (340 linhas)
4. `src/pages/documentos/material-treinamento/index.js` - Treinamento (420 linhas)

**Total: ~1.400 linhas de código**

## ✅ Checklist de Implementação

- [x] Estrutura de diretórios criada
- [x] Página hub com galeria de categorias
- [x] Página de Artes de Campanha com dados mock
- [x] Página de Modelos de Grupos com dados mock
- [x] Página de Material de Treinamento com dados mock
- [x] Busca e filtros em todas as páginas
- [x] Integração com sistema de logs
- [x] Modal de confirmação para deleção
- [x] Controle de acesso por nível de usuário
- [x] Atualizações ao Sidebar
- [x] Design responsivo (mobile, tablet, desktop)
- [x] Ícones FontAwesome apropriados
- [x] Cores temáticas por categoria
- [x] Estatísticas por categoria
- [ ] Upload de arquivos real
- [ ] Armazenamento em banco de dados
- [ ] Busca full-text
- [ ] Versionamento real

## 🧪 Testando o Módulo

1. Verifique se o menu "Documentos" aparece no Sidebar
2. Clique em "Documentos" → "Artes de Campanha" (ou outra categoria)
3. Teste a busca e filtros
4. Se admin, teste os botões "Editar" e "Deletar"
5. Verifique os logs em `/auditoria/logs` para ver registros das ações

## 📚 Referências Técnicas

- **React Hooks**: useState, useEffect
- **Next.js**: useRouter, pages API
- **FontAwesome**: Icons para UI
- **Tailwind CSS**: Estilos responsivos
- **Sistema de Logs**: logService.js com 10 tipos de eventos
- **Modal**: Hook useModal para gerenciar diálogos

---

**Status**: ✅ Implementação Completa - Pronto para Uso
**Data**: Novembro 2024
**Versão**: 1.0

