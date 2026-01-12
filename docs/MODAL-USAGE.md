# Sistema de Modais Estilizados - MandatoPro

## 📋 Componentes Criados

### 1. **Modal.js** (`src/components/Modal.js`)
Componente visual do modal com design personalizado e logo do sistema.

### 2. **useModal Hook** (`src/hooks/useModal.js`)
Hook personalizado para gerenciar estado e ações dos modais.

---

## 🚀 Como Usar

### Passo 1: Importar nos seus componentes

```javascript
import Modal from '@/components/Modal';
import useModal from '@/hooks/useModal';
```

### Passo 2: Inicializar o hook no componente

```javascript
export default function MeuComponente() {
  const { modalState, closeModal, showSuccess, showError, showWarning, showInfo, showConfirm } = useModal();
  
  // ... resto do código
}
```

### Passo 3: Adicionar o componente Modal no JSX

```javascript
return (
  <div>
    {/* Modal - Adicione no início do return */}
    <Modal
      isOpen={modalState.isOpen}
      onClose={closeModal}
      onConfirm={modalState.onConfirm}
      title={modalState.title}
      message={modalState.message}
      type={modalState.type}
      confirmText={modalState.confirmText}
      cancelText={modalState.cancelText}
      showCancel={modalState.showCancel}
    />
    
    {/* Resto do seu conteúdo */}
  </div>
);
```

---

## 📝 Métodos Disponíveis

### 1. **showSuccess** - Modal de Sucesso
```javascript
showSuccess('Registro cadastrado com sucesso!');

// Com callback
showSuccess('Registro cadastrado com sucesso!', () => {
  router.push('/listagem');
});
```

### 2. **showError** - Modal de Erro
```javascript
showError('Erro ao salvar os dados. Tente novamente.');

// Com callback
showError('Erro ao conectar com o servidor.', () => {
  console.log('Usuário fechou o modal de erro');
});
```

### 3. **showWarning** - Modal de Aviso
```javascript
showWarning('Por favor, preencha todos os campos obrigatórios.');
```

### 4. **showInfo** - Modal Informativo
```javascript
showInfo('O sistema será atualizado em breve.');
```

### 5. **showConfirm** - Modal de Confirmação
```javascript
showConfirm('Tem certeza que deseja excluir este registro?', () => {
  // Ação ao confirmar (clique em "Sim")
  excluirRegistro();
});
```

### 6. **showModal** - Personalizado
```javascript
showModal({
  title: 'Título Personalizado',
  message: 'Mensagem personalizada aqui',
  type: 'info', // 'success', 'error', 'warning', 'info', 'confirm'
  confirmText: 'Entendi',
  cancelText: 'Fechar',
  showCancel: false,
  onConfirm: () => {
    console.log('Modal confirmado');
  }
});
```

---

## 🎨 Tipos de Modal

| Tipo | Cor | Ícone | Uso |
|------|-----|-------|-----|
| **success** | Verde | ✓ | Operações bem-sucedidas |
| **error** | Vermelho | ✗ | Erros e falhas |
| **warning** | Amarelo | ⚠ | Avisos e alertas |
| **info** | Azul | ℹ | Informações gerais |
| **confirm** | Teal | ? | Confirmar ações importantes |

---

## 🔄 Substituindo `alert()` por Modais

### ❌ **ANTES** (alert nativo)
```javascript
const handleSubmit = () => {
  alert('Cadastro realizado com sucesso!');
};

const handleDelete = () => {
  if (confirm('Deseja realmente excluir?')) {
    excluir();
  }
};
```

### ✅ **DEPOIS** (Modal estilizado)
```javascript
const handleSubmit = () => {
  showSuccess('Cadastro realizado com sucesso!', () => {
    router.push('/listagem');
  });
};

const handleDelete = () => {
  showConfirm('Tem certeza que deseja excluir este registro?', () => {
    excluir();
  });
};
```

---

## 💡 Exemplos Práticos

### Validação de Formulário
```javascript
const handleSubmit = (e) => {
  e.preventDefault();
  
  if (!formData.nome || !formData.email) {
    showWarning('Por favor, preencha todos os campos obrigatórios.');
    return;
  }
  
  try {
    // salvar dados
    showSuccess('Dados salvos com sucesso!', () => {
      router.push('/lista');
    });
  } catch (error) {
    showError('Erro ao salvar os dados. Tente novamente.');
  }
};
```

### Exclusão com Confirmação
```javascript
const handleExcluir = (id) => {
  showConfirm('Tem certeza que deseja excluir este eleitor?', () => {
    // Código de exclusão aqui
    console.log('Excluindo eleitor:', id);
    showSuccess('Eleitor excluído com sucesso!');
  });
};
```

### Busca de CEP
```javascript
const buscarCep = async () => {
  if (formData.cep.length !== 8) {
    showWarning('CEP deve conter 8 dígitos');
    return;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${formData.cep}/json/`);
    const data = await response.json();
    
    if (data.erro) {
      showError('CEP não encontrado!');
      return;
    }
    
    // preencher campos
    showSuccess('CEP encontrado com sucesso!');
  } catch (error) {
    showError('Erro ao buscar CEP. Tente novamente.');
  }
};
```

---

## 🎯 Arquivos Já Atualizados

✅ `/src/pages/cadastros/liderancas/novo.js`
- Imports adicionados
- useModal inicializado
- Modal renderizado
- alert() de sucesso substituído

✅ `/src/pages/cadastros/funcionarios/novo.js`
- Imports adicionados

✅ `/src/pages/cadastros/eleitores/novo.js`
- Imports adicionados

---

## 📦 Estrutura de Arquivos

```
src/
├── components/
│   ├── Modal.js           ← Componente visual do modal
│   └── BuscaEleitor.js
├── hooks/
│   └── useModal.js        ← Hook para gerenciar modais
├── styles/
│   └── globals.css        ← Animações do modal adicionadas
└── pages/
    └── cadastros/
        ├── liderancas/
        │   └── novo.js    ← Já integrado
        ├── funcionarios/
        │   └── novo.js    ← Imports adicionados
        └── eleitores/
            └── novo.js    ← Imports adicionados
```

---

## ✨ Características

- ✅ Design moderno e estilizado
- ✅ Logo do MandatoPro integrada
- ✅ Animações suaves
- ✅ Backdrop com blur
- ✅ Responsivo (mobile-friendly)
- ✅ Suporte a callbacks
- ✅ 5 tipos de modais
- ✅ Fácil de usar
- ✅ Substituição completa do alert/confirm

---

## 🎨 Customização

Para customizar cores ou estilos, edite:
- **Modal.js** - Para alterar aparência visual
- **globals.css** - Para ajustar animações
- **useModal.js** - Para adicionar novos métodos

---

## 📝 TODO - Próximos Arquivos a Atualizar

Substituir `alert()` e `confirm()` nos seguintes arquivos:

- [ ] `/src/pages/cadastros/funcionarios/novo.js`
- [ ] `/src/pages/cadastros/eleitores/novo.js`
- [ ] `/src/pages/cadastros/atendimentos/novo.js`
- [ ] `/src/pages/cadastros/liderancas/index.js`
- [ ] `/src/pages/cadastros/funcionarios/index.js`
- [ ] `/src/pages/cadastros/eleitores/index.js`
- [ ] `/src/pages/cadastros/atendimentos/index.js`
- [ ] `/src/pages/login.js`
- [ ] `/src/pages/dashboard.js`
