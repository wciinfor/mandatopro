# 🗺️ MAPA DO SISTEMA DE LOGS

## ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERFACE ADMIN (logs.js)                    │
│  ┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   Filtros    │ │  Tabela    │ │  Modal   │ │  Exportar    │ │
│  │ (7 campos)   │ │ (8 colunas)│ │ (Details)│ │    CSV       │ │
│  └──────────────┘ └────────────┘ └──────────┘ └──────────────┘ │
│         ↓              ↓              ↓              ↓            │
│              GET /api/logs + Headers                            │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │
           ┌────────────────┴────────────────┐
           │                                 │
    ┌──────▼──────┐               ┌─────────▼─────────┐
    │ POST /logs  │               │ DELETE /logs      │
    │ (Registra)  │               │ (Cleanup >90 dias)│
    └──────▲──────┘               └─────────▲─────────┘
           │                              │
    ┌──────┴──────────────────────────────┴──────┐
    │         API Backend (index.js)             │
    │  ┌─────────────────────────────────────┐  │
    │  │ • Admin validation                  │  │
    │  │ • Filtering & Pagination            │  │
    │  │ • IP Detection                      │  │
    │  │ • Auto-rolling (max 50k)            │  │
    │  └─────────────────────────────────────┘  │
    └──────┬──────────────────────────────────────┘
           │
    ┌──────▼────────────────────────┐
    │   FILE: data/logs/logs.json    │
    │   ┌──────────────────────────┐ │
    │   │ [                        │ │
    │   │  {id, tipoEvento, ...}   │ │
    │   │  {id, tipoEvento, ...}   │ │
    │   │  {id, tipoEvento, ...}   │ │
    │   │  ...max 50k entries...   │ │
    │   │ ]                        │ │
    │   └──────────────────────────┘ │
    └───────────────────────────────────┘
           ↑
           │
    ┌──────┴──────────────────────────────────────┐
    │     SERVICE LAYER (logService.js)           │
    │  ┌────────────────────────────────────────┐ │
    │  │ registrarLogin()        → LOGIN         │ │
    │  │ registrarLogout()       → LOGOUT        │ │
    │  │ registrarCadastro()     → CADASTRO      │ │
    │  │ registrarEdicao()       → EDICAO        │ │
    │  │ registrarDelecao()      → DELECAO       │ │
    │  │ registrarRelatorio()    → RELATORIO     │ │
    │  │ registrarExportacao()   → EXPORTACAO    │ │
    │  │ registrarAcesso()       → ACESSO        │ │
    │  │ registrarErro()         → ERRO          │ │
    │  │ registrarConfiguracao() → CONFIGURACAO  │ │
    │  └────────────────────────────────────────┘ │
    └──────┬──────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────────────┐
    │              PÁGINAS DO SISTEMA                     │
    │                                                     │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
    │  │  Login   │  │ Dashboard│  │Novo ...  │  ... (40) │
    │  │   ✅     │  │    ✅    │  │   ✅     │         │
    │  │registra- │  │registra- │  │registra- │         │
    │  │ Login()  │  │ Acesso() │  │Cadastro()│         │
    │  └──────────┘  └──────────┘  └──────────┘         │
    │                                                     │
    └────────────────────────────────────────────────────┘
```

---

## FLUXO DE DADOS

### 1️⃣ **REGISTRAR EVENTO**

```
Página React
    │
    ├─→ handleSubmit()
    │       │
    │       └─→ registrarCadastro(usuario, modulo, tipo, id, dados)
    │               │
    │               └─→ fetch POST '/api/logs'
    │                       │
    │                       └─→ Backend cria log
    │                               │
    │                               └─→ Salva em data/logs/logs.json
    │
    ├─→ showSuccess()
    │
    └─→ router.push()
```

### 2️⃣ **VISUALIZAR LOGS**

```
Admin clica: Auditoria → Logs
    │
    └─→ /auditoria/logs carrega
            │
            ├─→ Verifica admin? (redirect se não)
            │
            ├─→ carregarLogs() com filtros
            │       │
            │       └─→ fetch GET '/api/logs?filtros'
            │               │
            │               └─→ Backend:
            │                   ├─ Valida admin
            │                   ├─ Aplica filtros
            │                   ├─ Pagina resultados
            │                   └─ Retorna JSON
            │
            ├─→ setState(logs)
            │
            ├─→ Renderiza tabela
            │
            ├─→ User clica em olho
            │       │
            │       └─→ setState(logDetalhado)
            │           └─→ Modal abre com JSON dump
            │
            └─→ User clica "Exportar CSV"
                    │
                    └─→ Gera CSV
                        └─→ Download
```

---

## ESTRUTURA DO LOG

```json
{
  "id": "1732484920000",
  "tipoEvento": "CADASTRO",
  "modulo": "ELEITORES",
  "descricao": "Eleitor 'João Silva' cadastrado",
  "status": "SUCESSO",
  
  "usuarioId": "admin123",
  "usuarioNome": "Administrador",
  "usuarioEmail": "admin@email.com",
  "usuarioNivel": "ADMINISTRADOR",
  
  "enderecoBrowser": "http://localhost:3000/cadastros/eleitores/novo",
  "agenteBrowser": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "enderecoIP": "192.168.1.100",
  
  "dados": {
    "nome": "João Silva",
    "cpf": "12345678900",
    "email": "joao@email.com",
    "celular": "11987654321"
  },
  
  "timestamp": "2024-11-25T14:30:45.123Z",
  "dataLocal": "25/11/2024 14:30:45",
  "dataRegistro": "2024-11-25T14:30:45.250Z"
}
```

---

## INTEGRAÇÃO EM PÁGINA

```javascript
// 1. IMPORTS (topo do arquivo)
import { useRegistrarAcesso } from '@/hooks/useRegistrarAcesso';
import { registrarCadastro, registrarErro } from '@/services/logService';

// 2. SETUP (no componente)
const [usuario, setUsuario] = useState(null);

useEffect(() => {
  const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
  setUsuario(usuarioData);
}, []);

// 3. REGISTRAR ACESSO (na montagem)
useRegistrarAcesso(usuario, 'MODULO', 'Nome da Página');

// 4. REGISTRAR AÇÃO (em handlers)
const handleSubmit = async (formData) => {
  try {
    const resultado = await salvarNoServidor(formData);
    await registrarCadastro(
      usuario,
      'MODULO',
      'Entidade',
      resultado.id,
      formData
    );
    showSuccess('Sucesso!');
  } catch (error) {
    await registrarErro(usuario, 'MODULO', 'Erro ao salvar', error);
    showError(error.message);
  }
};
```

---

## PERMISSÕES

```
┌─────────────────────────────────────────┐
│           TODOS OS USUÁRIOS             │
│  POST /api/logs - Registrar evento ✅   │
│  GET /api/logs  - Bloqueado ❌          │
│  DELETE /api/logs - Bloqueado ❌        │
│  Acesso a /auditoria/logs - Bloqueado ❌│
└─────────────────────────────────────────┘
           │
           │ Se usuario.nivel === 'ADMINISTRADOR'
           ▼
┌─────────────────────────────────────────┐
│         APENAS ADMINISTRADOR            │
│  POST /api/logs - Registrar evento ✅   │
│  GET /api/logs  - Ler logs com filtro ✅│
│  DELETE /api/logs - Limpar logs antigos✅│
│  Acesso a /auditoria/logs - Completo ✅ │
└─────────────────────────────────────────┘
```

---

## FILTROS DISPONÍVEIS

```
┌──────────────────────────────────────────────┐
│            FILTROS DE BUSCA                  │
│                                              │
│ 1. busca          - Texto livre (nome, desc) │
│ 2. tipoEvento     - LOGIN, CADASTRO, etc     │
│ 3. modulo         - ELEITORES, LIDERANCAS... │
│ 4. status         - SUCESSO, ERRO            │
│ 5. dataInicio     - Data mínima              │
│ 6. dataFim        - Data máxima              │
│ 7. usuarioId      - ID específico do usuário │
│ 8. pagina         - Número da página         │
│ 9. limite         - Items por página         │
└──────────────────────────────────────────────┘

Exemplo de query:
GET /api/logs?tipoEvento=CADASTRO&modulo=ELEITORES&pagina=1&limite=50
```

---

## CICLO DE VIDA DE UM LOG

```
1️⃣ CRIAÇÃO
   Usuário clica em "Salvar"
   └─→ handleSubmit() chamado

2️⃣ REGISTRO
   registrarCadastro() é chamado
   └─→ Cria objeto de evento

3️⃣ ENVIO
   fetch POST '/api/logs' com JSON
   └─→ Vai para backend

4️⃣ PERSISTÊNCIA
   Backend salva em data/logs/logs.json
   └─→ Auto-rolling se >50k

5️⃣ LEITURA
   Admin acessa /auditoria/logs
   └─→ Carrega com filtros

6️⃣ VISUALIZAÇÃO
   Log aparece na tabela
   └─→ Pode exportar ou ver detalhes

7️⃣ LIMPEZA
   Após 90 dias
   └─→ Pode ser deletado manualmente
```

---

## TIPOS DE EVENTOS E MÓDULOS

```
EVENTOS                          MÓDULOS
├─ LOGIN                         ├─ AUTENTICACAO
├─ LOGOUT                        ├─ DASHBOARD
├─ CADASTRO                      ├─ ELEITORES
├─ EDICAO                        ├─ LIDERANCAS
├─ DELECAO                       ├─ FUNCIONARIOS
├─ RELATORIO                     ├─ ATENDIMENTOS
├─ EXPORTACAO                    ├─ EMENDAS
├─ ACESSO                        ├─ FINANCEIRO
├─ ERRO                          ├─ AGENDA
└─ CONFIGURACAO                  ├─ SOLICITACOES
                                 ├─ USUARIOS
                                 ├─ COMUNICACAO
                                 ├─ CONFIGURACOES
                                 ├─ SISTEMA
                                 └─ AUDITORIA
```

---

## PAINEL ADMIN

```
┌─ AUDITORIA: Logs do Sistema ──────────────────────────┐
│                                                        │
│ FILTROS                                                │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Busca: [    login    ]                           │  │
│ │ Tipo: [ERRO        ▼] Módulo: [AUTENTICACAO  ▼] │  │
│ │ Status: [SUCESSO   ▼] Data: [01/11] até [25/11] │  │
│ └──────────────────────────────────────────────────┘  │
│ [Atualizar] [Exportar CSV] [Limpar >90 dias]         │
│                                                        │
│ RESULTADOS                                             │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Data    │Tipo  │Módulo│Usuário│Descrição │Status│  │
│ │─────────────────────────────────────────────────│  │
│ │14:30:45 │LOGIN │AUTO  │Admin  │Login ok  │✅   │  │
│ │14:31:02 │ACESSO│DASH  │Admin  │Acessou   │✅   │  │
│ │14:32:15 │CADAS │ELEI  │Admin  │Novo...   │✅   │  │
│ │14:45:30 │ERRO  │ELEI  │Admin  │Falhou... │❌   │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
│ Página 1 de 25  [◀] [1] [2] [3] [▶]                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## CHECKLIST DE INTEGRAÇÃO

Para cada página, fazer:

```
[ ] Importar useRegistrarAcesso
[ ] Importar registrar* functions
[ ] Chamar useRegistrarAcesso no componente
[ ] Envolver handleSubmit com try/catch
[ ] Chamar registrarCadastro() em sucesso
[ ] Chamar registrarErro() em erro
[ ] Testar navegando à página
[ ] Verificar em /auditoria/logs
[ ] Confirmar dados aparecem
```

---

**Mapa Visual Completo**  
**Versão 1.0 - Novembro 2024**
