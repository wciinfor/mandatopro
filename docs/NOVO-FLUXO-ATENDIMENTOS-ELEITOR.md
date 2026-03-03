# 📋 NOVO FLUXO: Atendimentos com Registro Rápido de Eleitor

## O que mudou?

A página `/cadastros/atendimentos/novo` agora oferece **dois modos de operação**:

### 1️⃣ **Buscar Eleitor Existente** (Modo padrão)
- Busca um eleitor já cadastrado na base
- Usa o fluxo anterior (BuscaEleitor)
- Após selecionar eleitor → buscar campanha → preencher dados atendimento

### 2️⃣ **Registrar Novo Eleitor** (NOVO)
- Preenche dados do eleitor da ficha manual
- Cria registro na tabela `eleitores` com dados **parciais**
- Vincular à campanha
- Preencher dados do atendimento
- Ao salvar: cria ELEITOR + ATENDIMENTO em sequência
- Operador pode completar cadastro do eleitor depois

## Campos obrigatórios para Novo Eleitor

**Obrigatórios** (marcado com *):
- ✅ Nome Completo
- ✅ CPF

**Opcionais** (preenchidos depois):
- RG
- Celular
- Email
- (todos os outros campos endereço, documentos, etc)

## Como funciona a lógica?

### Fluxo 1: Buscar Eleitor
```
1. Clica "Buscar Eleitor Existente"
2. Busca por nome/CPF
3. Seleciona eleitor da lista
4. Seleciona campanha (opcional)
5. Preenche dados do atendimento
6. Salva atendimento
```

### Fluxo 2: Registrar Novo Eleitor
```
1. Clica "Registrar Novo Eleitor"
2. Preenche: Nome, CPF, RG (opt), Celular (opt), Email (opt)
3. Seleciona campanha (opcional)
4. Preenche dados do atendimento
5. Ao salvar:
   a) API cria novo eleitor em `eleitores`
   b) API cria atendimento vinculado
   c) Volta para listagem de atendimentos
6. Eleitor pode editar cadastro depois via /cadastros/eleitores
```

## Tecnicamente

### Mudanças no Frontend (novo.js)
- ✅ Novo estado: `modoEleitor` ('buscar' | 'registrar')
- ✅ Novo campo no form: `eleitorRg`
- ✅ Toggle UI: dois botões para escolher modo
- ✅ Formulário inline para novo eleitor (aparece quando modo='registrar')
- ✅ handleSubmit refatorado para criar eleitor antes do atendimento

### Mudanças no Backend
- ✅ POST `/api/cadastros/eleitores` já existe e funciona
  - Aceita: nome, cpf, rg, email, telefone, celular, status
  - Retorna: eleitor criado com ID

### Migrações Necessárias (ainda pendentes)
Se eleitor.rg ainda não existe:
```sql
ALTER TABLE eleitores
ADD COLUMN IF NOT EXISTS rg VARCHAR(11);

CREATE INDEX IF NOT EXISTS idx_eleitores_rg ON eleitores(rg);
```

Se liderancas.rg ainda não existe:
```sql
ALTER TABLE liderancas
ADD COLUMN IF NOT EXISTS rg VARCHAR(11);

CREATE INDEX IF NOT EXISTS idx_liderancas_rg ON liderancas(rg);
```

## Próximos Passos

1. ✅ **Código está pronto**
2. ⏳ **Execute as migrações SQL no Supabase** se não fez ainda
3. ✅ **Teste**:
   - Modo "Buscar": deve funcionar como antes
   - Modo "Registrar": preenche dados → salva eleitor + atendimento

## Benefícios

🎯 **Para operadores em campo**:
- Podem registrar atendimentos mesmo com eleitor novo
- Dados da ficha manual são capturados imediatamente
- Não precisa voltar ao escritório para "completar depois"

📊 **Para gestão**:
- Base de eleitores cresce gradualmente
- Mesmo com dados incompletos, o eleitor fica "rastreável"
- Permite dedup/consolidação depois

## Status

- ✅ Front-end: PRONTO
- ✅ Back-end: PRONTO
- ⏳ SQL Migrations: PENDENTE (execute no Supabase)
- 🧪 Testes: FAZER
