# Sistema de Logs e Auditoria

## Visão Geral

O sistema de logs do MandatoPro registra todas as atividades executadas pelos usuários para fins de auditoria e compliance. Apenas administradores têm acesso ao módulo de visualização de logs.

## Acesso

**Módulo**: Auditoria → Logs do Sistema  
**Permissão**: Apenas ADMINISTRADOR  
**URL**: `/auditoria/logs`

## Tipos de Eventos

O sistema registra os seguintes tipos de eventos:

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **LOGIN** | Login de usuário no sistema | Usuário efetua login |
| **LOGOUT** | Logout de usuário | Usuário clica em "Sair" |
| **CADASTRO** | Criação de novo registro | Novo eleitor cadastrado |
| **EDICAO** | Edição de registro existente | Dados de liderança alterados |
| **DELECAO** | Exclusão de registro | Eleitor removido do sistema |
| **RELATORIO** | Geração de relatório | Relatório de solicitações gerado |
| **EXPORTACAO** | Exportação de dados | Dados exportados em CSV |
| **ACESSO** | Acesso a página/módulo | Acesso ao dashboard |
| **ERRO** | Erro do sistema | Falha em validação |
| **CONFIGURACAO** | Alteração de configurações | WhatsApp Business configurado |

## Informações Registradas

Cada log contém:

```javascript
{
  id: "1732484920000",                    // ID único do log
  tipoEvento: "LOGIN",                    // Tipo de evento
  modulo: "AUTENTICACAO",                 // Módulo afetado
  descricao: "Login realizado por João",  // Descrição legível
  status: "SUCESSO",                      // SUCESSO ou ERRO
  usuarioId: "user123",                   // ID do usuário
  usuarioNome: "João Silva",              // Nome do usuário
  usuarioEmail: "joao@email.com",         // Email do usuário
  usuarioNivel: "ADMINISTRADOR",          // Nível de acesso
  enderecoBrowser: "http://...",          // URL da página
  agenteBrowser: "Mozilla/5.0...",        // Informações do navegador
  enderecoIP: "192.168.1.100",            // IP do cliente
  dados: { ... },                         // Dados adicionais
  timestamp: "2024-11-25T...",            // Data/hora ISO
  dataLocal: "25/11/2024 14:30:45",      // Data/hora em português
  dataRegistro: "2024-11-25T..."          // Data de registro no servidor
}
```

## Como Usar

### 1. Registrar um Novo Log

```javascript
import { registrarCadastro } from '@/services/logService';

const usuario = { 
  id: '123', 
  nome: 'João', 
  email: 'joao@email.com',
  nivel: 'LIDERANCA'
};

await registrarCadastro(
  usuario,
  'ELEITORES',                    // módulo
  'Eleitor',                      // entidade
  'eleitor-id-123',              // ID do novo registro
  { nome: 'Maria', email: '...' } // dados
);
```

### 2. Registrar Edição de Dados

```javascript
import { registrarEdicao } from '@/services/logService';

await registrarEdicao(
  usuario,
  'LIDERANCAS',
  'Liderança',
  'lid-456',
  { 
    nome: 'João Silva',  // dados antigos
    celular: '11987654321'
  },
  { 
    nome: 'João da Silva',  // dados novos
    celular: '11987654321'
  }
);
```

### 3. Registrar Exclusão

```javascript
import { registrarDelecao } from '@/services/logService';

await registrarDelecao(
  usuario,
  'ELEITORES',
  'Eleitor',
  'eleitor-id-789',
  { 
    nome: 'Maria Santos',
    cpf: '123.456.789-00',
    email: 'maria@email.com'
  }
);
```

### 4. Registrar Geração de Relatório

```javascript
import { registrarRelatorio } from '@/services/logService';

await registrarRelatorio(
  usuario,
  'SOLICITACOES',
  'Relatório de Solicitações Pendentes',
  { 
    dataInicio: '2024-11-01',
    dataFim: '2024-11-25',
    status: ['NOVA', 'EM_ANDAMENTO']
  }
);
```

### 5. Registrar Acesso a Módulo/Página

```javascript
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';

export default function MinhaPage() {
  const [usuario, setUsuario] = useState(null);
  
  // Registra automaticamente o acesso quando o usuário entra na página
  useRegistrarAcesso(usuario, 'ELEITORES', 'Lista de Eleitores');
  
  return <Layout>...</Layout>;
}
```

### 6. Registrar Erros

```javascript
import { registrarErro } from '@/services/logService';

try {
  // operação
} catch (error) {
  await registrarErro(
    usuario,
    'ELEITORES',
    'Erro ao salvar eleitor',
    error
  );
}
```

## Filtros Disponíveis

Na página de logs, você pode filtrar por:

| Filtro | Descrição |
|--------|-----------|
| **Busca** | Por nome de usuário, email ou descrição |
| **Tipo de Evento** | LOGIN, CADASTRO, EDICAO, etc. |
| **Módulo** | ELEITORES, LIDERANCAS, EMENDAS, etc. |
| **Status** | SUCESSO ou ERRO |
| **Data Início** | Data inicial do período |
| **Data Fim** | Data final do período |

## Operações na Interface

### Visualizar Detalhes
Clique no ícone de olho para ver todos os detalhes de um log:
- Dados adicionais
- Mudanças antes/depois (para edições)
- Stack trace (para erros)
- Informações do navegador

### Exportar para CSV
Use o botão "Exportar CSV" para baixar logs em formato de planilha Excel.

### Limpar Logs Antigos
Use o botão "Limpar Logs Antigos" para remover logs com mais de 90 dias.
**Atenção**: Esta ação não pode ser desfeita!

### Atualizar
Clique em "Atualizar" para recarregar os logs com os filtros atuais.

## Retenção de Dados

- **Limite máximo**: 50.000 logs
- **Período de retenção**: 90 dias (configurable via API DELETE)
- **Frequência de limpeza**: Manual (via interface)

## API Endpoints

### GET /api/logs
Recupera logs com filtros e paginação

**Query Parameters:**
```
tipoEvento=LOGIN
modulo=ELEITORES
usuarioId=user123
status=SUCESSO
dataInicio=2024-11-01T00:00:00Z
dataFim=2024-11-25T23:59:59Z
busca=João
pagina=1
limite=50
```

**Resposta:**
```json
{
  "sucesso": true,
  "logs": [...],
  "paginacao": {
    "pagina": 1,
    "limite": 50,
    "total": 1250,
    "totalPaginas": 25
  }
}
```

### POST /api/logs
Registra um novo log

**Body:**
```json
{
  "tipoEvento": "CADASTRO",
  "modulo": "ELEITORES",
  "descricao": "Eleitor cadastrado",
  "status": "SUCESSO",
  "usuarioId": "123",
  "usuarioNome": "João",
  "usuarioEmail": "joao@email.com",
  "dados": { ... }
}
```

### DELETE /api/logs
Remove logs antigos

**Query Parameters:**
```
diasRetencao=90
```

## Boas Práticas

1. **Registre ações importantes**: CADASTRO, EDICAO, DELECAO
2. **Inclua contexto**: Descreva claramente o que foi feito
3. **Use dados adicionais**: Registre IDs e mudanças específicas
4. **Trate erros**: Use `registrarErro()` em exceções
5. **Respeite privacidade**: Não registre senhas ou dados sensíveis
6. **Revise regularmente**: Monitore a seção de Auditoria

## Exemplo Completo

```javascript
// Em src/pages/cadastros/eleitores/novo.js
import { registrarCadastro, registrarErro } from '@/services/logService';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';

export default function NovoEleitor() {
  const [usuario, setUsuario] = useState(null);

  // Registra acesso quando entra na página
  useRegistrarAcesso(usuario, 'ELEITORES', 'Cadastro de Novo Eleitor');

  const handleSubmit = async (formData) => {
    try {
      const response = await fetch('/api/eleitores', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const resultado = await response.json();
        
        // Registra o cadastro bem-sucedido
        await registrarCadastro(
          usuario,
          'ELEITORES',
          'Eleitor',
          resultado.id,
          {
            nome: formData.nome,
            cpf: formData.cpf,
            email: formData.email
          }
        );

        showSuccess('Eleitor cadastrado com sucesso!');
      }
    } catch (error) {
      // Registra o erro
      await registrarErro(
        usuario,
        'ELEITORES',
        'Erro ao cadastrar eleitor',
        error
      );
      showError('Erro ao cadastrar: ' + error.message);
    }
  };

  return <Layout>...</Layout>;
}
```

## Segurança

- ✅ Apenas administradores podem acessar logs
- ✅ IPs dos usuários são registrados
- ✅ Informações do navegador são capturadas
- ✅ Timestamps são imutáveis
- ✅ Dados são armazenados em arquivo JSON criptografado (recomendado)

## Monitoramento

Recomendações para monitoramento:

1. **Revisar diariamente**: Logs de erros e ações críticas
2. **Investigar anomalias**: Múltiplos acessos falhados, deletions em massa
3. **Alertas**: Configure alertas para atividades suspeitas
4. **Compliance**: Mantenha histórico por período regulatório
5. **Backup**: Faça backup regular dos logs

---

**Última atualização**: Novembro 2024  
**Versão**: 1.0
