# 🧪 GUIA DE TESTE - Sistema de Logs

## ✅ TESTE RÁPIDO (5 MINUTOS)

### Pré-requisitos:
- [ ] Servidor rodando (`npm run dev`)
- [ ] Browser aberto em `http://localhost:3000`
- [ ] Usuário ADMINISTRADOR pronto

### Passos:

#### 1. **Login** (Registra LOGIN event)
```
1. Ir para /login
2. Email: admin@example.com
3. Senha: senha123
4. Clicar "Entrar"
5. Resultado esperado: Redireciona para /dashboard
```

#### 2. **Dashboard** (Registra ACESSO event)
```
1. Aguardar carregar o dashboard
2. Resultado esperado: Página carrega normalmente
```

#### 3. **Cadastrar Eleitor** (Registra CADASTRO event)
```
1. Clique: Cadastros → Eleitores → Novo Eleitor
2. Preencha:
   - Nome: João Silva Teste
   - CPF: 12345678900
   - Email: joao@test.com
   - Celular: 11987654321
3. Clique: "Salvar Eleitor"
4. Resultado esperado: Mensagem de sucesso
```

#### 4. **Ver Logs** (Verifica registros)
```
1. Clique: Auditoria → Logs do Sistema
2. Resultado esperado: Página carrega com logs
3. Deve ver:
   - [x] LOGIN event (do passo 1)
   - [x] ACESSO event (do passo 2)
   - [x] CADASTRO event (do passo 3)
```

#### 5. **Filtrar Logs** (Testa filtros)
```
1. Em "Tipo de Evento", selecione: LOGIN
2. Clique: "Atualizar"
3. Resultado esperado: Mostra apenas LOGIN events
```

#### 6. **Ver Detalhes** (Testa modal)
```
1. Clique no ícone de olho de um log
2. Resultado esperado: Modal abre mostrando JSON completo
3. Verifique dados registrados:
   - usuario.nome
   - usuario.email
   - enderecoBrowser
   - enderecoIP
```

#### 7. **Exportar CSV** (Testa exportação)
```
1. Clique: "Exportar CSV"
2. Resultado esperado: Arquivo baixa
3. Verifique arquivo em Downloads
4. Deve conter: Data, Tipo, Módulo, Usuário, Status
```

#### 8. **Logout** (Registra LOGOUT event)
```
1. Clique no botão "Sair" (Sidebar inferior)
2. Resultado esperado: Redireciona para /login
3. Verá mensagem sobre logout
```

#### 9. **Verificar LOGOUT** (Confirma último evento)
```
1. Login novamente
2. Vá para Auditoria → Logs
3. Verifique primeiro log: LOGOUT event
```

---

## 🔍 TESTE AVANÇADO (20 MINUTOS)

### Teste de Filtros

#### Filtro por Data:
```
1. Em "Data Início": 20/11/2024
2. Em "Data Fim": 25/11/2024
3. Clique "Atualizar"
4. Resultado: Apenas logs deste período
```

#### Filtro por Módulo:
```
1. Em "Módulo": ELEITORES
2. Clique "Atualizar"
3. Resultado: Apenas eventos de ELEITORES
```

#### Filtro por Status:
```
1. Em "Status": ERRO
2. Clique "Atualizar"
3. Resultado: Apenas eventos com erro
4. (Se nenhum, try com SUCESSO)
```

#### Filtro por Busca:
```
1. Em "Busca": joao
2. Clique "Atualizar"
3. Resultado: Eventos contendo "joao"
```

#### Combinação de Filtros:
```
1. Tipo: CADASTRO
2. Módulo: ELEITORES
3. Status: SUCESSO
4. Data: Últimos 7 dias
5. Clique "Atualizar"
6. Resultado: Apenas cadastros de eleitores bem-sucedidos
```

### Teste de Paginação

```
1. Defina "Itens por página": 10
2. Clique "Atualizar"
3. Navegue usando botões [◀] [1] [2] [▶]
4. Resultado: Página muda mostrando 10 items
```

### Teste de Erro

```
1. Browser Console (F12)
2. Execute:
   fetch('/api/logs', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       tipoEvento: 'ERRO',
       modulo: 'TESTE',
       descricao: 'Erro de teste',
       status: 'ERRO'
     })
   })
3. Vá para /auditoria/logs
4. Resultado: Novo evento ERRO aparece
```

---

## 🐛 TROUBLESHOOTING

### Problema: Página não carrega
```
Solução:
1. F5 para recarregar
2. Limpar cache (Ctrl+Shift+Del)
3. Verificar console (F12)
4. Reiniciar servidor
```

### Problema: Logs não aparecem
```
Solução:
1. Verificar se logou como ADMINISTRADOR
2. Verificar se arquivo data/logs/logs.json existe
3. Verificar se API está rodando (GET /api/logs)
4. Ver console do navegador (F12) para erros
```

### Problema: Filtros não funcionam
```
Solução:
1. Limpar filtros (recarregar página)
2. Tentar filtro simples (apenas Tipo)
3. Verificar se há eventos desse tipo
4. Verificar console para erro de API
```

### Problema: CSV não baixa
```
Solução:
1. Verificar bloqueador de pop-ups
2. Verificar downloads do navegador
3. Tentar em navegador diferente
4. Recarregar página (F5) e tentar novamente
```

---

## 🔐 TESTE DE SEGURANÇA

### Teste 1: Acesso não-admin bloqueado
```
1. Login com usuário não-admin
2. Tente acessar /auditoria/logs diretamente
3. Resultado esperado: Redirecionado para /dashboard
```

### Teste 2: Admin pode ver logs
```
1. Login com ADMINISTRADOR
2. Acesse /auditoria/logs
3. Resultado esperado: Página carrega normalmente
```

### Teste 3: IP é registrado
```
1. Abra um log
2. Verifique campo "enderecoIP"
3. Resultado esperado: IP deve ser mostrado (ex: 192.168.x.x)
```

### Teste 4: Browser info é registrado
```
1. Abra um log
2. Verifique campo "agenteBrowser"
3. Resultado esperado: String tipo "Mozilla/5.0..."
```

---

## 📊 TESTE DE DADOS

### Verificar Estrutura do Log

```javascript
// Abra F12 → Console → execute:
fetch('/api/logs?pagina=1&limite=1', {
  headers: {'usuario': JSON.stringify({nivel: 'ADMINISTRADOR'})}
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
```

Resultado esperado - Cada log deve ter:
```json
{
  "id": "1732484920000",
  "tipoEvento": "LOGIN",
  "modulo": "AUTENTICACAO",
  "descricao": "...",
  "status": "SUCESSO",
  "usuarioId": "...",
  "usuarioNome": "...",
  "usuarioEmail": "...",
  "usuarioNivel": "ADMINISTRADOR",
  "enderecoBrowser": "...",
  "agenteBrowser": "...",
  "enderecoIP": "...",
  "dados": {...},
  "timestamp": "...",
  "dataLocal": "...",
  "dataRegistro": "..."
}
```

---

## ✨ TESTE DE INTEGRAÇÃO COM NOVO ELEITOR

### Teste Completo:

```
1. Login como Admin
   → Deve registrar LOGIN event

2. Ir para Dashboard
   → Deve registrar ACESSO event

3. Ir para Cadastros → Eleitores → Novo
   → Deve registrar ACESSO event

4. Preencher form de novo eleitor
   → Deve aparecer ACESSO da página

5. Clicar "Salvar Eleitor"
   → Deve registrar CADASTRO event

6. Ver em Auditoria → Logs
   → Deve ver os 4 eventos acima

7. Filtrar por CADASTRO
   → Deve mostrar apenas o cadastro

8. Exportar CSV
   → Deve baixar com todos os dados

9. Clicar no olho do CADASTRO
   → Deve mostrar modal com JSON
   → Incluindo dados do novo eleitor
```

---

## 🎯 TESTE DE PERFORMANCE

### Teste com Muitos Logs

```
1. Abrir Developer Tools (F12)
2. Network tab
3. Acessar /api/logs?limite=1000
4. Resultado esperado:
   - Tempo: <2 segundos
   - Status: 200
   - Size: <1MB
```

### Teste de Limpeza

```
1. Vá para Auditoria → Logs
2. Clique "Limpar Logs Antigos"
3. Confirme
4. Resultado esperado:
   - Logs >90 dias removidos
   - Página recarrega
   - Contagem atualizada
```

---

## 📝 CHECKLIST FINAL

- [ ] Login registra evento
- [ ] Dashboard registra acesso
- [ ] Novo eleitor registra cadastro
- [ ] Logout registra evento
- [ ] Página admin carrega
- [ ] Filtros funcionam
- [ ] Modal de detalhes abre
- [ ] CSV é exportado
- [ ] Admin vê logs
- [ ] Não-admin é bloqueado
- [ ] IP é registrado
- [ ] Dados são completos
- [ ] Paginação funciona
- [ ] Limpeza funciona
- [ ] Sem erros no console

---

## 🚀 PRÓXIMO PASSO

Após passar em todos estes testes:

1. **Integrar em mais páginas** (ver CHECKLIST-LOGS.md)
2. **Testar com dados reais**
3. **Monitorar performance**
4. **Implementar notificações por email**

---

**Versão:** 1.0  
**Tempo Total:** ~25 minutos  
**Dificuldade:** Básico  
**Requer Admin:** Sim
