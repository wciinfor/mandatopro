# Security Baseline - Status de Producao

Atualizado em: 2026-05-22

## Validacoes locais aprovadas

- `npm.cmd run check:security`
- `npm run lint`
- `npm run build`

Observacao: lint/build ainda exibem avisos de dados desatualizados em `baseline-browser-mapping` / `Browserslist`, sem falhar a compilacao.

## Checagem de ambiente

Foi adicionado:

```bash
npm run check:env
```

Esse comando compara:

- `NEXT_PUBLIC_SUPABASE_URL` em `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL` em `.env.production.local`
- projeto linkado pelo Supabase CLI em `supabase/.temp/project-ref`

Resultado atual no ambiente local apos alinhamento:

- `.env.local` aponta para o projeto Supabase linkado no CLI: `zgfctb...kpsu`
- `.env.production.local` foi alinhado localmente para o mesmo projeto

Como os arquivos `.env*` nao sao versionados, a mesma consistencia precisa ser conferida nas variaveis do ambiente de deploy sem commitar segredos.

## Supabase remoto

Projeto linkado pelo CLI:

- Nome: `mandatopro`
- Ref: `zgfctbixiqnyxzkukpsu`

Comandos executados:

```bash
supabase migration list --linked
supabase db advisors --linked
```

Resultado observado antes da aplicacao da `226`:

- todas as migrations aparecem na coluna `Local`
- a coluna `Remote` aparece vazia
- advisors confirmou achados reais de seguranca no banco remoto:
  - view `public.financeiro_movimentacoes` com `SECURITY DEFINER`
  - varias tabelas publicas sem RLS habilitado
  - funcoes com `search_path` mutavel
  - algumas politicas RLS permissivas/performance em tabelas que ja possuem RLS

A migration `226` foi aplicada manualmente via `supabase db query --linked --file` para evitar `supabase db push`, pois o historico legado remoto ainda nao esta alinhado com o repositorio.

Depois da aplicacao:

- `app_private.security_policy_backup_226` contem 46 politicas antigas salvas
- tabelas alvo existentes estao com RLS habilitado
- politicas diretas dessas tabelas foram removidas
- `public.financeiro_movimentacoes` esta com `security_invoker=true`
- `supabase migration repair --linked --status applied 226` registrou a `226` como aplicada no historico remoto

O historico das migrations antigas ainda precisa de reconciliacao separada antes de voltar a usar `supabase db push`.

## Migration RLS pendente

Arquivo criado:

```text
supabase/migrations/226_lock_direct_client_table_access.sql
```

Status:

- aplicada no Supabase remoto em 2026-05-22
- cobre os principais achados de seguranca do advisors: habilita RLS nas tabelas de negocio listadas e altera `financeiro_movimentacoes` para `security_invoker`
- cria backup das politicas antigas em `app_private.security_policy_backup_226`

## Advisors restantes

Apos a `226`, os erros principais de RLS e `SECURITY DEFINER` da view financeira sairam do advisors.

Tambem foi aplicada a migration:

```text
supabase/migrations/227_harden_remaining_security_advisors.sql
```

Status da `227`:

- aplicada no Supabase remoto em 2026-05-22
- revoga `EXECUTE` publico/anon/authenticated de funcoes `SECURITY DEFINER` expostas
- mantem `EXECUTE` para `service_role`, preservando chamadas server-side pelas API Routes
- ajusta `search_path` de `fn_documentos_updated_at` e `fn_incrementar_download`
- remove policies amplas de `storage.objects` para o bucket `documentos`
- registra a versao `227` como aplicada no historico remoto via `supabase migration repair`

O advisors apos a `227` removeu os avisos de funcoes `SECURITY DEFINER` executaveis e de bucket publico listavel. Restavam avisos:

- protecao de senha vazada do Supabase Auth desativada
- extensao `pg_trgm` instalada no schema `public`

Tambem foi aplicada a migration:

```text
supabase/migrations/228_drop_duplicate_indexes.sql
```

Status da `228`:

- aplicada no Supabase remoto em 2026-05-22
- removeu os indices duplicados apontados pelo advisors:
  - `public.idx_eleitores_lideranca_id`
  - `public.idx_funcionarios_eleitor_id`
- manteve os indices equivalentes:
  - `public.idx_eleitores_lideranca`
  - `public.idx_funcionarios_eleitor`
- registrou a versao `228` como aplicada no historico remoto via `supabase migration repair`

O advisors apos a `228` removeu os avisos de indices duplicados. Restavam avisos:

- protecao de senha vazada do Supabase Auth desativada
- extensao `pg_trgm` instalada no schema `public`

Tambem foi aplicada a migration:

```text
supabase/migrations/229_move_pg_trgm_to_extensions_schema.sql
```

Status da `229`:

- aplicada no Supabase remoto em 2026-05-22
- criou o schema `extensions`, caso ainda nao existisse
- moveu a extensao `pg_trgm` do schema `public` para `extensions`
- registrou a versao `229` como aplicada no historico remoto via `supabase migration repair`

O advisors apos a `229` removeu o aviso da extensao no schema `public`.

Aviso restante conhecido:

- protecao de senha vazada do Supabase Auth desativada

## Bloqueios antes de novas features

1. Confirmar no ambiente de deploy que as variaveis Supabase apontam para `zgfctb...kpsu`.
2. Reconciliar historico legado de migrations local/remoto.
3. Habilitar protecao contra senhas vazadas no Supabase Auth pelo painel do Supabase.
4. Testar login e fluxos principais usando as variaveis reais de producao/homologacao.
