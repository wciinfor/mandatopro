# Correção: Sequence Dessincronizada — Tabela `eleitores`

## Problema

Ao cadastrar um novo eleitor, o sistema retorna:

```
duplicate key value violates unique constraint "eleitores_pkey"
Key (id)=(6) already exists.
```

## Causa

A tabela `eleitores` usa `BIGSERIAL` (sequência automática para geração de IDs).
Quando linhas são inseridas **com IDs explícitos** (importação em massa, SQL manual, etc.),
a sequence interna do PostgreSQL **não avança automaticamente** — ela continua do último valor
que ela própria gerou.

Como resultado, ao tentar inserir a próxima linha via formulário, o banco tenta usar o ID `6`
(ou outro valor baixo), mas esse ID já existe na tabela.

## Solução (Execute no Supabase SQL Editor)

Acesse: **Supabase Dashboard → SQL Editor → New Query** e execute:

```sql
-- 1. Ressincroniza a sequence com o maior ID atual da tabela
SELECT setval('eleitores_id_seq', (SELECT MAX(id) FROM eleitores));
```

### Verificação após correção

```sql
-- 2. Confirmar que a sequence agora aponta para o valor correto
SELECT last_value FROM eleitores_id_seq;

-- 3. Deve ser igual ao MAX(id):
SELECT MAX(id) FROM eleitores;
```

Se `last_value = MAX(id)`, as próximas inserções via formulário vão funcionar normalmente.

## Por que não é um bug de código

O endpoint `POST /api/cadastros/eleitores` está correto — ele **não** envia um `id` explícito
no payload, deixando o PostgreSQL gerar o próximo valor da sequence. O problema é exclusivamente
na **diferença entre o estado da sequence e os dados existentes no banco**.

## Aplicar em outras tabelas (se necessário)

Se outras tabelas com `BIGSERIAL` apresentarem o mesmo erro, use o mesmo padrão:

```sql
SELECT setval('<nome_tabela>_id_seq', (SELECT MAX(id) FROM <nome_tabela>));
```

Exemplos comuns:
```sql
SELECT setval('funcionarios_id_seq',  (SELECT MAX(id) FROM funcionarios));
SELECT setval('solicitacoes_id_seq',  (SELECT MAX(id) FROM solicitacoes));
SELECT setval('documentos_id_seq',    (SELECT MAX(id) FROM documentos));
```
