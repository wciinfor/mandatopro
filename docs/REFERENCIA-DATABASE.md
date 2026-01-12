# 📖 Referência de Funções - Database Service

Arquivo: `src/services/database.js`

---

## 🔐 AUTENTICAÇÃO

### loginUser(email, senha)
Faz login do usuário no Supabase Auth e retorna dados do banco.
```javascript
const usuario = await loginUser('admin@mandatopro.com', 'Teste123!');
// Retorna: { id, nome, email, nivel, status, ... }
```

### criarUsuario(dados)
Cria novo usuário (apenas admin)
```javascript
const novoUsuario = await criarUsuario({
  email: 'novo@example.com',
  nome: 'Novo Usuário',
  nivel: 'OPERADOR',
  senha: 'SenhaSegura123!'
});
```

### redefinirSenha(email)
Envia email para redefinir senha
```javascript
await redefinirSenha('admin@mandatopro.com');
// Retorna: { sucesso: true, mensagem: 'Email enviado' }
```

---

## 👥 USUÁRIOS

### obterUsuarios(filtros)
Lista usuários com filtros opcionais
```javascript
// Sem filtro
const todos = await obterUsuarios();

// Com filtros
const admins = await obterUsuarios({ nivel: 'ADMINISTRADOR' });
const ativos = await obterUsuarios({ status: 'ATIVO' });
const busca = await obterUsuarios({ busca: 'João' });
```

### obterUsuarioPorId(id)
Obtém um usuário específico
```javascript
const usuario = await obterUsuarioPorId(1);
```

### atualizarUsuario(id, dados)
Atualiza dados de um usuário
```javascript
await atualizarUsuario(1, {
  nome: 'Novo Nome',
  status: 'INATIVO'
});
```

### deletarUsuario(id)
Deleta um usuário
```javascript
await deletarUsuario(5);
```

---

## 🗳️ ELEITORES

### criarEleitor(dados)
Cria novo eleitor
```javascript
const eleitor = await criarEleitor({
  nome: 'João da Silva',
  cpf: '12345678901',
  email: 'joao@example.com',
  telefone: '(91) 99999-1234',
  endereco: 'Rua das Flores, 123',
  bairro: 'Guamá',
  cidade: 'Belém',
  estado: 'PA'
});
```

### obterEleitores(filtros)
Lista eleitores com filtros
```javascript
// Todos
const todos = await obterEleitores();

// Filtrados
const busca = await obterEleitores({ busca: 'João' });
const cpf = await obterEleitores({ cpf: '12345678901' });
const lideranca = await obterEleitores({ lideranca_id: 5 });
const cidade = await obterEleitores({ cidade: 'Belém' });
```

### obterEleitoresPorBairro(cidade, bairro)
Obtém eleitores de um bairro específico
```javascript
const eleitores = await obterEleitoresPorBairro('Belém', 'Guamá');
```

### atualizarEleitor(id, dados)
Atualiza dados de um eleitor
```javascript
await atualizarEleitor(1, {
  telefone: '(91) 98888-7777',
  status: 'TRANSFERIDO'
});
```

---

## 📝 SOLICITAÇÕES

### criarSolicitacao(dados)
Cria nova solicitação com protocolo automático
```javascript
const solicitacao = await criarSolicitacao({
  titulo: 'Reparo de rua',
  descricao: 'Buraco na Rua das Flores',
  solicitante: 'João Silva',
  tipo_solicitante: 'MORADOR',
  categoria: 'Infraestrutura',
  prioridade: 'ALTA',
  municipio: 'Belém',
  bairro: 'Guamá'
});
// Gera automaticamente: protocolo SOL-2026-xxxxx
```

### obterSolicitacoes(filtros)
Lista solicitações com filtros
```javascript
// Todas
const todas = await obterSolicitacoes();

// Filtradas
const ativas = await obterSolicitacoes({ status: 'NOVO' });
const urgentes = await obterSolicitacoes({ prioridade: 'URGENTE' });
const busca = await obterSolicitacoes({ busca: 'rua' });
```

### obterSolicitacaoPorProtocolo(protocolo)
Obtém solicitação pelo número de protocolo
```javascript
const solicitacao = await obterSolicitacaoPorProtocolo('SOL-2026-001');
```

### atualizarSolicitacao(id, dados)
Atualiza solicitação
```javascript
await atualizarSolicitacao(1, {
  status: 'ATENDIDA',
  observacoes: 'Rua reparada com sucesso',
  data_conclusao: '2026-01-11'
});
```

---

## 📅 AGENDA

### criarEvento(dados)
Cria novo evento na agenda
```javascript
const evento = await criarEvento({
  titulo: 'Reunião com Líderes',
  descricao: 'Discussão sobre projetos',
  data: '2026-01-25',
  hora_inicio: '14:00',
  hora_fim: '16:00',
  local: 'Salão Paroquial',
  tipo: 'PARLAMENTAR',
  categoria: 'Reunião'
});
```

### obterEventos(filtros)
Lista eventos
```javascript
// Todos
const todos = await obterEventos();

// Por data
const data = await obterEventos({ data: '2026-01-25' });

// Por período (mês/ano)
const mes = await obterEventos({ mes: 1, ano: 2026 });

// Por tipo
const parlamentares = await obterEventos({ tipo: 'PARLAMENTAR' });
```

### atualizarEvento(id, dados)
Atualiza evento
```javascript
await atualizarEvento(1, {
  titulo: 'Reunião Extraordinária',
  participantes: 20,
  confirmados: 15
});
```

---

## 🎤 LIDERANÇAS

### criarLideranca(dados)
Cria nova liderança
```javascript
const lideranca = await criarLideranca({
  nome: 'João Silva Santos',
  cpf: '12345678901',
  email: 'joao@example.com',
  telefone: '(91) 99999-1234',
  influencia: 'ALTA',
  area_atuacao: 'Guamá'
});
```

### obterLiderancas(filtros)
Lista lideranças
```javascript
// Todas
const todas = await obterLiderancas();

// Filtradas
const ativas = await obterLiderancas({ status: 'ATIVO' });
const altas = await obterLiderancas({ influencia: 'ALTA' });
const busca = await obterLiderancas({ busca: 'João' });
```

---

## 💬 COMUNICAÇÃO - MENSAGENS

### criarMensagem(dados)
Cria nova mensagem
```javascript
const msg = await criarMensagem({
  remetente_id: 1,
  destinatario_id: 2,
  texto: 'Olá! Como vai?',
  tipo: 'TEXTO'
});
```

### obterMensagensConversa(usuarioId1, usuarioId2)
Obtém histórico de conversa entre dois usuários
```javascript
const historico = await obterMensagensConversa(1, 2);
// Retorna mensagens em ordem cronológica
```

### marcarMensagenComoLida(remetenteId, destinatarioId)
Marca mensagens como lidas
```javascript
await marcarMensagenComoLida(2, 1);
```

---

## 📊 LOGS E AUDITORIA

### registrarLogAuditoria(dados)
Registra ação de auditoria
```javascript
await registrarLogAuditoria({
  usuario_id: 1,
  acao: 'CRIAR',
  modulo: 'SOLICITACOES',
  descricao: 'Criou nova solicitação',
  status: 'SUCESSO'
});
```

### obterLogsAuditoria(filtros)
Lista logs de auditoria
```javascript
// Todos (últimos 100)
const todos = await obterLogsAuditoria();

// Por usuário
const logs = await obterLogsAuditoria({ usuario_id: 1 });

// Por módulo
const solLogs = await obterLogsAuditoria({ modulo: 'SOLICITACOES' });
```

---

## 📈 DASHBOARD

### obterEstatisticasDashboard()
Obtém contagem geral de registros
```javascript
const stats = await obterEstatisticasDashboard();
// Retorna:
// {
//   totalUsuarios: 5,
//   totalEleitores: 150,
//   totalSolicitacoes: 23,
//   totalEventos: 8
// }
```

---

## 🎯 PADRÕES DE USO

### Padrão 1: Try-Catch
```javascript
try {
  const eleitores = await obterEleitores({ busca: 'João' });
  console.log(eleitores);
} catch (error) {
  console.error('Erro:', error.message);
}
```

### Padrão 2: Com Async/Await
```javascript
async function listarSolicitacoes() {
  const solicitacoes = await obterSolicitacoes({ 
    status: 'NOVO' 
  });
  return solicitacoes;
}
```

### Padrão 3: Em Componente React
```javascript
import { useEffect, useState } from 'react';
import { obterEleitores } from '@/services/database';

export default function ListaEleitores() {
  const [eleitores, setEleitores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const dados = await obterEleitores();
        setEleitores(dados);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  if (loading) return <p>Carregando...</p>;
  
  return (
    <ul>
      {eleitores.map(e => (
        <li key={e.id}>{e.nome}</li>
      ))}
    </ul>
  );
}
```

---

## 📋 TIPOS DE DADOS

### Status
- `ATIVO`, `INATIVO`, `BLOQUEADO` (usuários)
- `ATIVO`, `INATIVO`, `TRANSFERIDO` (eleitores)
- `NOVO`, `EM_ANDAMENTO`, `ATENDIDA`, `RECUSADA` (solicitações)

### Níveis
- `ADMINISTRADOR` - Acesso total
- `LIDERANCA` - Acesso a módulos de liderança
- `OPERADOR` - Acesso básico

### Prioridades
- `URGENTE` (vermelho)
- `ALTA` (laranja)
- `MÉDIA` (amarelo)
- `BAIXA` (verde)

### Influência
- `BAIXA`, `MÉDIA`, `ALTA`, `MUITO_ALTA`

---

## 🔗 RELACIONAMENTOS

- `usuarios` ← → `liderancas` (opcionalmente vinculado)
- `eleitores` → `liderancas` (pode estar vinculado a uma)
- `solicitacoes` → `usuarios` (atendente responsável)
- `agenda_eventos` → `usuarios` (criado por)
- `comunicacao_mensagens` → `usuarios` (remetente e destinatário)
- `emendas` → `orgaos` (responsável pelo repasse)

---

## ⚡ DICAS DE PERFORMANCE

1. **Use filtros sempre que possível** - Reduz dados transferidos
2. **Pagine resultados longos** - Adicione `.limit()` e `.offset()`
3. **Cache dados em estado** - Evite chamadas repetidas
4. **Use índices no SQL** - Já foram criados

---

**Última Atualização**: 11 de janeiro de 2026  
**Versão**: 1.0  
**Status**: ✅ Completo e testado
