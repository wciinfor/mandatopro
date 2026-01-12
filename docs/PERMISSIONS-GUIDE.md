# Guia de Uso - Sistema de Permissões

## Estrutura do Sistema

O sistema de permissões foi criado com 3 níveis de acesso:

### 1. ADMINISTRADOR
- **Acesso Total**: Visualiza e gerencia todos os registros
- **Módulos Exclusivos**: Financeiro, Jurídico, Usuários
- **Permissões**: Criar, editar, excluir em todos os módulos

### 2. LIDERANÇA
- **Acesso Restrito**: Visualiza apenas registros de sua equipe
- **Dados Visíveis**: 
  - Registros criados por ele
  - Registros criados por operadores vinculados a ele
  - Agendas relacionadas à sua liderança
  - Solicitações de sua equipe
- **Permissões de Edição**: Pode editar dados comuns, mas **NÃO** pode editar dados sensíveis (CPF, RG, etc)
- **Exclusão**: **NÃO PODE DELETAR** nenhum registro (apenas Admin)
- **Módulos Bloqueados**: Emendas, Financeiro, Jurídico, Usuários

### 3. OPERADOR
- **Acesso Mínimo**: Visualiza apenas seus próprios registros
- **Permissões**: Criar cadastros, editar dados comuns (não sensíveis)
- **Exclusão**: **NÃO PODE DELETAR** nenhum registro (apenas Admin)
- **Deve estar vinculado a uma Liderança**
- **Módulos Bloqueados**: Funcionários, Emendas, Financeiro, Jurídico, Usuários

---

## Como Usar

### 1. Proteger uma Página Completa

```javascript
import ProtectedRoute from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

export default function MinhaPage() {
  return (
    <ProtectedRoute module={MODULES.FINANCEIRO}>
      {/* Conteúdo da página - apenas Admin verá */}
      <h1>Módulo Financeiro</h1>
    </ProtectedRoute>
  );
}
```

### 2. Proteger com Papel Específico

```javascript
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/utils/permissions';

export default function ConfiguracaoAdmin() {
  return (
    <ProtectedRoute requiredRole={ROLES.ADMINISTRADOR}>
      {/* Apenas administradores podem acessar */}
      <h1>Configurações do Sistema</h1>
    </ProtectedRoute>
  );
}
```

### 3. Ocultar Botões Condicionalmente

```javascript
import { Can } from '@/components/ProtectedRoute';
import { MODULES } from '@/utils/permissions';

function MeuComponente() {
  return (
    <div>
      {/* Botão aparece apenas para quem pode criar */}
      <Can do="create" in={MODULES.CADASTROS}>
        <button>Novo Cadastro</button>
      </Can>

      {/* Botão aparece apenas para quem pode editar */}
      <Can do="edit" in={MODULES.CADASTROS}>
        <button>Editar</button>
      </Can>

      {/* Botão aparece apenas para quem pode deletar */}
      <Can do="delete" in={MODULES.CADASTROS}>
        <button>Excluir</button>
      </Can>
    </div>
  );
}
```

### 4. Exibir Apenas para Papel Específico

```javascript
import { RoleOnly } from '@/components/ProtectedRoute';
import { ROLES } from '@/utils/permissions';

function Dashboard() {
  return (
    <div>
      <RoleOnly role={ROLES.ADMINISTRADOR}>
        <div>Painel administrativo completo</div>
      </RoleOnly>

      <RoleOnly role={ROLES.LIDERANCA}>
        <div>Painel da liderança</div>
      </RoleOnly>

      <RoleOnly role={ROLES.OPERADOR}>
        <div>Painel do operador</div>
      </RoleOnly>
    </div>
  );
}
```

### 5. Filtrar Dados Baseado no Usuário

```javascript
import { useAuth } from '@/contexts/AuthContext';
import { filterRecordsByRole, MODULES } from '@/utils/permissions';

function ListaEleitores() {
  const { user } = useAuth();
  const [eleitores, setEleitores] = useState([]);

  useEffect(() => {
    // Buscar todos os eleitores
    const todosEleitores = buscarEleitores();
    
    // Filtrar baseado no papel do usuário
    const eleitoresFiltrados = filterRecordsByRole(
      todosEleitores,
      user.nivel,          // Papel do usuário
      user.id,             // ID do usuário
      user.liderancaId,    // ID da liderança (se aplicável)
      MODULES.CADASTROS    // Módulo atual
    );

    setEleitores(eleitoresFiltrados);
  }, [user]);

  return (
    <div>
      {eleitores.map(eleitor => (
        <div key={eleitor.id}>{eleitor.nome}</div>
      ))}
    </div>
  );
}
```

### 6. Verificar Permissões no Código

```javascript
import { useAuth } from '@/contexts/AuthContext';
import { 
  hasPermission, 
  canCreate, 
  canEdit, 
  canDelete,
  canDeleteRecord,
  canEditSensitive,
  isSensitiveField,
  MODULES 
} from '@/utils/permissions';

function MinhaFuncao() {
  const { user } = useAuth();

  // Verificar permissão específica
  if (hasPermission(user.nivel, MODULES.CADASTROS, 'create')) {
    // Usuário pode criar
  }

  // Atalhos
  if (canCreate(user.nivel, MODULES.CADASTROS)) {
    // Usuário pode criar
  }

  if (canEdit(user.nivel, MODULES.EMENDAS)) {
    // Usuário pode editar emendas
  }

  // IMPORTANTE: Verificar se pode deletar (apenas Admin)
  if (canDeleteRecord(user.nivel)) {
    // Apenas Admin chegará aqui
  }

  // Verificar se pode editar dados sensíveis
  if (canEditSensitive(user.nivel, MODULES.CADASTROS)) {
    // Apenas Admin pode editar CPF, RG, etc
  }

  // Verificar se um campo específico é sensível
  if (isSensitiveField('eleitores', 'cpf')) {
    // Campo CPF é sensível - desabilitar para não-admin
  }
}
```

### 7. Integrar com _app.js

```javascript
import { AuthProvider } from '@/contexts/AuthContext';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

### 8. Sistema de Login

```javascript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { loginUser } from '@/contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    try {
      const userData = await loginUser(email, senha);
      login(userData);
      router.push('/dashboard');
    } catch (error) {
      setErro(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input 
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
      />
      {erro && <p className="text-red-600">{erro}</p>}
      <button type="submit">Entrar</button>
    </form>
  );
}
```

---

## Credenciais de Teste

Para testar o sistema:

**Administrador:**
- Email: admin@mandatopro.com
- Senha: 123456

**Liderança:**
- Email: lideranca@mandatopro.com
- Senha: 123456

**Operador:**
- Email: operador@mandatopro.com
- Senha: 123456

---

## Matriz de Permissões

| Módulo              | Admin | Liderança | Operador |
|---------------------|-------|-----------|----------|
| Dashboard           | ✅ Todos | ✅ Seus | ✅ Seus |
| Funcionários        | ✅ CRUD | ✅ CRU | ❌ |
| Cadastros           | ✅ CRUD + Sensível | ✅ CRU* | ✅ CRU* |
| **Emendas**         | ✅ CRUD | ❌ | ❌ |
| **Financeiro**      | ✅ CRUD | ❌ | ❌ |
| Geolocalização      | ✅ CRUD | ✅ Leitura | ✅ Leitura |
| Comunicados         | ✅ CRUD | ✅ CRU* | ✅ Leitura |
| Agenda              | ✅ CRUD | ✅ CRU* | ✅ CRU* |
| Aniversariantes     | ✅ Leitura | ✅ Leitura | ✅ Leitura |
| Documentos          | ✅ CRUD | ✅ CRU* | ✅ Leitura |
| Solicitações        | ✅ CRUD | ✅ CRU* | ✅ C* |
| **Usuários**        | ✅ CRUD | ❌ | ❌ |
| **Jurídico**        | ✅ CRUD | ❌ | ❌ |
| Disparo Mensagens   | ✅ CRUD | ✅ C | ❌ |

**Legenda:**
- ✅ = Acesso permitido
- ❌ = Acesso negado
- **CRUD** = Create, Read, Update, **Delete** (completo)
- **CRU** = Create, Read, Update (**SEM Delete**)
- C = Create
- \* = Apenas registros próprios ou da equipe
- **Sensível** = Pode editar dados sensíveis (CPF, RG, Título Eleitor, etc)

---
## Observações Importantes

1. **Operadores** devem sempre estar vinculados a uma liderança
2. **Lideranças** veem apenas dados de sua equipe
3. **Admin** é o único com acesso aos módulos: Emendas, Financeiro, Jurídico e Usuários
4. **EXCLUSÃO**: Apenas Admin pode deletar registros. Liderança e Operador NÃO podem deletar
5. **Dados Sensíveis**: Apenas Admin pode editar CPF, RG, Título de Eleitor, Data de Nascimento, Salário
6. **Liderança e Operador**: Podem editar apenas dados comuns (nome, endereço, telefone, etc)
7. Registros sempre salvam `criadoPor` para controle de acesso
8. Use `canDeleteRecord(userRole)` antes de mostrar botão de exclusão
9. Use `isSensitiveField(module, field)` para desabilitar campos sensíveis
10. Use `filterRecordsByRole()` ao buscar dados do banco

### Campos Sensíveis por Módulo

**Eleitores:**
- CPF, RG, Título de Eleitor, Data de Nascimento

**Lideranças:**
- CPF, RG, Data de Nascimento

**Funcionários:**
- CPF, RG, Data de Nascimento, Salário

**Atendimentos:**
- Status, Prioridade acesso
5. Use `filterRecordsByRole()` ao buscar dados do banco
