# Guia de Integração - Sistema de Logs

## Resumo da Implementação

O sistema de logs foi integrado nos seguintes pontos:

✅ **Login** - Registra login e tentativas falhadas  
✅ **Logout** - Registra saída do sistema  
✅ **Dashboard** - Registra acesso ao dashboard  
✅ **Novo Eleitor** - Registra cadastro e erros  

## Como Integrar em Outras Páginas

### 1. Registrar Acesso a Página

Para registrar quando um usuário acessa uma página/módulo:

```javascript
// Importar o hook
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';

export default function MinhaPage() {
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);
  }, []);

  // Registra acesso automaticamente quando entra na página
  useRegistrarAcesso(usuario, 'NOME_DO_MODULO', 'Nome Amigável da Página');

  return <Layout>...</Layout>;
}
```

**Exemplos de uso:**
```javascript
// Na página de Eleitores
useRegistrarAcesso(usuario, 'ELEITORES', 'Lista de Eleitores');

// Na página de Lideranças
useRegistrarAcesso(usuario, 'LIDERANCAS', 'Gerenciamento de Lideranças');

// Na página de Emendas
useRegistrarAcesso(usuario, 'EMENDAS', 'Registro de Emendas');

// Na página de Financeiro
useRegistrarAcesso(usuario, 'FINANCEIRO', 'Controle Financeiro');

// Na página de Agenda
useRegistrarAcesso(usuario, 'AGENDA', 'Agenda de Eventos');

// Na página de Solicitações
useRegistrarAcesso(usuario, 'SOLICITACOES', 'Solicitações da População');
```

---

### 2. Registrar Cadastro (Create)

Para registrar quando um usuário cria um novo registro:

```javascript
import { registrarCadastro, registrarErro } from '@/services/logService';

const handleSubmit = async (formData) => {
  try {
    // Sua lógica de salvamento
    const response = await salvarNoServidor(formData);

    // Após sucesso, registra o cadastro
    await registrarCadastro(
      usuario,
      'MODULO_NOME',        // Ex: 'ELEITORES', 'LIDERANCAS'
      'Tipo Entidade',      // Ex: 'Eleitor', 'Liderança'
      response.id,          // ID do novo registro
      {
        campo1: formData.campo1,
        campo2: formData.campo2,
        // Inclua os dados importantes
      }
    );

    showSuccess('Registro cadastrado com sucesso!');
  } catch (error) {
    await registrarErro(usuario, 'MODULO_NOME', 'Erro ao cadastrar', error);
    showError('Erro: ' + error.message);
  }
};
```

**Exemplo Completo - Cadastro de Eleitor:**
```javascript
const handleSalvarEleitor = async (formData) => {
  try {
    const response = await fetch('/api/eleitores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) throw new Error('Erro ao salvar');

    const eleitor = await response.json();

    // Registra o cadastro
    await registrarCadastro(
      usuario,
      'ELEITORES',
      'Eleitor',
      eleitor.id,
      {
        nome: formData.nome,
        cpf: formData.cpf,
        email: formData.email,
        celular: formData.celular,
        cidade: formData.cidade
      }
    );

    showSuccess('Eleitor cadastrado com sucesso!');
    router.push('/cadastros/eleitores');
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Falha ao cadastrar eleitor', error);
    showError('Erro ao cadastrar: ' + error.message);
  }
};
```

---

### 3. Registrar Edição (Update)

Para registrar quando um usuário edita um registro existente:

```javascript
import { registrarEdicao, registrarErro } from '@/services/logService';

const handleEditar = async (id, dadosAntigos, dadosNovos) => {
  try {
    // Sua lógica de atualização
    await fetch(`/api/eleitores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosNovos)
    });

    // Registra a edição
    await registrarEdicao(
      usuario,
      'ELEITORES',
      'Eleitor',
      id,
      dadosAntigos,    // Dados antes da edição
      dadosNovos       // Dados depois da edição
    );

    showSuccess('Eleitor atualizado com sucesso!');
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Erro ao editar eleitor', error);
    showError('Erro ao atualizar: ' + error.message);
  }
};
```

**Exemplo com rastreamento de mudanças:**
```javascript
const handleSalvarAlteracoes = async () => {
  try {
    // Dados originais (vindo de um API ou estado anterior)
    const dadosAntigos = {
      nome: eleitor.nome,
      email: eleitor.email,
      celular: eleitor.celular,
      statusCadastro: eleitor.statusCadastro
    };

    // Novos dados do formulário
    const dadosNovos = {
      nome: formData.nome,
      email: formData.email,
      celular: formData.celular,
      statusCadastro: formData.statusCadastro
    };

    // Salva no servidor
    await fetch(`/api/eleitores/${eleitor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosNovos)
    });

    // Registra a edição
    await registrarEdicao(
      usuario,
      'ELEITORES',
      'Eleitor',
      eleitor.id,
      dadosAntigos,
      dadosNovos
    );

    showSuccess('Alterações salvas com sucesso!');
    router.push('/cadastros/eleitores');
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Erro ao salvar alterações', error);
    showError('Erro: ' + error.message);
  }
};
```

---

### 4. Registrar Exclusão (Delete)

Para registrar quando um usuário deleta um registro:

```javascript
import { registrarDelecao, registrarErro } from '@/services/logService';

const handleExcluir = async (id, dadosExcluidos) => {
  if (!confirm('Tem certeza que deseja deletar este registro?')) {
    return;
  }

  try {
    // Sua lógica de exclusão
    await fetch(`/api/eleitores/${id}`, { method: 'DELETE' });

    // Registra a exclusão
    await registrarDelecao(
      usuario,
      'ELEITORES',
      'Eleitor',
      id,
      dadosExcluidos   // Dados que foram deletados
    );

    showSuccess('Eleitor removido com sucesso!');
    router.push('/cadastros/eleitores');
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Erro ao deletar eleitor', error);
    showError('Erro ao remover: ' + error.message);
  }
};
```

**Exemplo com confirmação:**
```javascript
const confirmarExclusao = async (eleitor) => {
  showWarning(
    'Tem certeza que deseja excluir este eleitor?',
    async () => {
      try {
        // Salva dados antes de deletar
        const dadosExcluidos = {
          nome: eleitor.nome,
          cpf: eleitor.cpf,
          email: eleitor.email,
          celular: eleitor.celular
        };

        // Faz a exclusão
        await fetch(`/api/eleitores/${eleitor.id}`, { method: 'DELETE' });

        // Registra a exclusão
        await registrarDelecao(
          usuario,
          'ELEITORES',
          'Eleitor',
          eleitor.id,
          dadosExcluidos
        );

        showSuccess('Eleitor removido permanentemente!');
        carregarEleitores(); // Recarrega lista
      } catch (error) {
        await registrarErro(usuario, 'ELEITORES', 'Falha ao deletar', error);
        showError('Erro ao deletar: ' + error.message);
      }
    },
    'Deletar',
    'Cancelar'
  );
};
```

---

### 5. Registrar Relatório (Export/Report)

Para registrar quando um usuário gera um relatório ou exporta dados:

```javascript
import { registrarRelatorio, registrarErro } from '@/services/logService';

const handleGerarRelatorio = async (filtros) => {
  try {
    // Gera o relatório
    const dados = await buscarDados(filtros);

    // Registra a geração do relatório
    await registrarRelatorio(
      usuario,
      'ELEITORES',
      'Relatório de Eleitores Cadastrados',
      {
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        status: filtros.status,
        totalRegistros: dados.length
      }
    );

    // Baixa o PDF/Excel
    downloadRelatorio(dados);
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Erro ao gerar relatório', error);
    showError('Erro ao gerar relatório: ' + error.message);
  }
};
```

**Exemplo de Exportação:**
```javascript
const exportarParaCSV = async () => {
  try {
    // Busca dados
    const response = await fetch('/api/eleitores');
    const eleitores = await response.json();

    // Gera CSV
    const csv = [
      ['ID', 'Nome', 'CPF', 'Email', 'Celular'],
      ...eleitores.map(e => [e.id, e.nome, e.cpf, e.email, e.celular])
    ]
      .map(row => row.join(','))
      .join('\n');

    // Baixa arquivo
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eleitores-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    // Registra a exportação
    await registrarExportacao(
      usuario,
      'ELEITORES',
      'Exportação de Eleitores para CSV',
      {
        formato: 'CSV',
        totalRegistros: eleitores.length,
        dataExportacao: new Date().toISOString()
      }
    );

    showSuccess('Arquivo exportado com sucesso!');
  } catch (error) {
    await registrarErro(usuario, 'ELEITORES', 'Erro ao exportar', error);
    showError('Erro ao exportar: ' + error.message);
  }
};
```

---

### 6. Registrar Erro (Exception Handling)

Para registrar erros e exceções do sistema:

```javascript
import { registrarErro } from '@/services/logService';

// Capturar erro durante operação
try {
  // código que pode falhar
  await operacao();
} catch (error) {
  await registrarErro(
    usuario,
    'NOME_MODULO',
    'Descrição do erro que ocorreu',
    error
  );
}
```

---

### 7. Registrar Alteração de Configuração

Para registrar quando um usuário altera configurações do sistema:

```javascript
import { registrarConfiguracao, registrarErro } from '@/services/logService';

const handleSalvarConfiguracoes = async (novasConfigs) => {
  try {
    // Salva as configurações
    await salvarConfiguracoesNoServidor(novasConfigs);

    // Registra a alteração
    await registrarConfiguracao(
      usuario,
      'SISTEMA',
      'Alteração de Configurações',
      {
        whatsappBusiness: novasConfigs.whatsappBusiness,
        notificacoes: novasConfigs.notificacoes,
        dataAlteracao: new Date().toISOString()
      }
    );

    showSuccess('Configurações atualizadas com sucesso!');
  } catch (error) {
    await registrarErro(usuario, 'CONFIGURACOES', 'Erro ao salvar configs', error);
    showError('Erro ao atualizar: ' + error.message);
  }
};
```

---

## Padrão de Integração Completo

Aqui está um padrão que você pode seguir para qualquer página:

```javascript
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { 
  registrarCadastro, 
  registrarEdicao, 
  registrarDelecao, 
  registrarErro 
} from '@/services/logService';

export default function MinhaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [registros, setRegistros] = useState([]);

  // 1. Carrega usuário do localStorage
  useEffect(() => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioData);
  }, []);

  // 2. Registra acesso à página
  useRegistrarAcesso(usuario, 'MODULO_NOME', 'Nome da Página');

  // 3. Função para criar novo registro
  const handleCriar = async (dados) => {
    try {
      const response = await fetch('/api/registros', {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      const novoRegistro = await response.json();

      // Registra o cadastro
      await registrarCadastro(usuario, 'MODULO', 'Tipo', novoRegistro.id, dados);
      showSuccess('Criado com sucesso!');
    } catch (error) {
      await registrarErro(usuario, 'MODULO', 'Erro ao criar', error);
      showError('Erro: ' + error.message);
    }
  };

  // 4. Função para editar registro
  const handleEditar = async (id, dadosAntigos, dadosNovos) => {
    try {
      await fetch(`/api/registros/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dadosNovos)
      });

      // Registra a edição
      await registrarEdicao(usuario, 'MODULO', 'Tipo', id, dadosAntigos, dadosNovos);
      showSuccess('Atualizado com sucesso!');
    } catch (error) {
      await registrarErro(usuario, 'MODULO', 'Erro ao editar', error);
      showError('Erro: ' + error.message);
    }
  };

  // 5. Função para deletar registro
  const handleDeletar = async (id, dados) => {
    if (!confirm('Tem certeza?')) return;

    try {
      await fetch(`/api/registros/${id}`, { method: 'DELETE' });

      // Registra a exclusão
      await registrarDelecao(usuario, 'MODULO', 'Tipo', id, dados);
      showSuccess('Removido com sucesso!');
    } catch (error) {
      await registrarErro(usuario, 'MODULO', 'Erro ao deletar', error);
      showError('Erro: ' + error.message);
    }
  };

  return <Layout>...</Layout>;
}
```

---

## Módulos e Nomes Padrão

Ao integrar logs, use estes nomes de módulos para consistência:

```javascript
'DASHBOARD'       // Dashboard principal
'ELEITORES'       // Cadastro de eleitores
'LIDERANCAS'      // Cadastro de lideranças
'FUNCIONARIOS'    // Cadastro de funcionários
'ATENDIMENTOS'    // Cadastro de atendimentos
'EMENDAS'         // Emendas parlamentares
'FINANCEIRO'      // Gestão financeira
'AGENDA'          // Agenda de eventos
'SOLICITACOES'    // Solicitações da população
'COMUNICACAO'     // Comunicação/WhatsApp
'USUARIOS'        // Gestão de usuários
'CONFIGURACOES'   // Configurações do sistema
'AUTENTICACAO'    // Login/Logout
'SISTEMA'         // Eventos do sistema geral
```

---

## Checklist de Integração

Para cada página de CRUD, siga este checklist:

- [ ] Importar `useRegistrarAcesso` do hook
- [ ] Importar funções de log do `logService`
- [ ] Chamar `useRegistrarAcesso()` no componente
- [ ] Envolver `handleCreate` com `registrarCadastro()`
- [ ] Envolver `handleUpdate` com `registrarEdicao()`
- [ ] Envolver `handleDelete` com `registrarDelecao()`
- [ ] Envolver todos try/catch com `registrarErro()`
- [ ] Testar com admin em `/auditoria/logs`
- [ ] Verificar se os logs aparecem corretamente

---

## Testando a Integração

1. **Faça login** com usuário admin
2. **Navegue para uma página** integrada
3. **Faça uma ação** (cadastro, edição, etc)
4. **Vá em** Auditoria → Logs do Sistema
5. **Procure pelo evento** usando os filtros
6. **Clique no olho** para ver detalhes
7. **Verifique os dados** registrados

---

## Troubleshooting

**Q: Os logs não estão aparecendo?**  
A: Verifique se:
1. O usuário logado é ADMINISTRADOR
2. A função de registro foi chamada corretamente
3. Não há erros no console do navegador
4. A API /api/logs está respondendo (cheque com Ctrl+Shift+N)

**Q: Os dados não estão sendo salvos completos?**  
A: Certifique-se de:
1. Incluir todos os dados importantes na chamada de registro
2. Usar `JSON.stringify()` se for um objeto
3. Não incluir dados sensíveis (senhas, tokens)

**Q: Como ver os logs brutos?**  
A: Execute no terminal:
```bash
cat data/logs/logs.json | jq '.[0]' # Ver o primeiro log
```

---

**Última atualização**: Novembro 2024

