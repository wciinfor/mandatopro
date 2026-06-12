# Plano de Migração — Disparo Pro → Schema SaaS v2.0

> **Data de geração:** 2026-05-08  
> **Versão origem:** schema single-tenant (tabelas `_legacy`)  
> **Versão destino:** `supabase-schema.sql` v2.0 (multi-tenant com RLS)  
> **Arquivo SQL:** `migration-v2.sql`

---

## Resumo executivo

A migração converte o banco de dados single-tenant (onde cada usuário gerencia seus próprios dados via `user_id`) para o modelo multi-tenant (onde todos os dados pertencem a um **workspace** e o acesso é controlado por membros com papéis). Nenhum dado é apagado. As tabelas legadas permanecem intactas até validação completa.

---

## 1. Pré-requisitos

| Item | Ação necessária |
|---|---|
| Schema v2.0 aplicado | Executar `supabase-schema.sql` sem erros |
| Tabelas legadas renomeadas | Verificar que `instances_legacy`, `contacts_legacy`, `campaigns_legacy`, `campaign_results_legacy`, `payments_legacy` existem |
| Tabela `profiles` presente | Deve existir com dados dos usuários antes do schema v2 |
| Acesso `service_role` | Executar o script no SQL Editor do Supabase como service_role |
| Backup realizado | **Obrigatório antes de qualquer execução** (ver seção 2) |

### Verificação rápida (executar antes de migrar)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','instances_legacy','contacts_legacy',
    'campaigns_legacy','campaign_results_legacy','payments_legacy',
    'users_profiles','workspaces','workspace_members','instances',
    'contacts','campaigns','payments'
  )
ORDER BY table_name;
```

Todas as 12 tabelas devem aparecer antes de executar o script de migração.

---

## 2. Backup recomendado antes da execução

### Opção A — Backup via Supabase Dashboard (recomendado)

1. Acesse **Project Settings → Backups** no Supabase Dashboard
2. Clique em **"Trigger Backup"** ou aguarde o backup automático diário
3. Anote o timestamp do backup gerado
4. Apenas continue com a migração após confirmar que o backup existe

### Opção B — Snapshot manual das tabelas legadas (SQL Editor)

Execute antes da migração para ter uma cópia extra no mesmo banco:

```sql
-- Copiar snapshots como tabelas de auditoria (opcional, segurança extra)
CREATE TABLE IF NOT EXISTS public._bkp_profiles         AS SELECT * FROM public.profiles;
CREATE TABLE IF NOT EXISTS public._bkp_instances_legacy AS SELECT * FROM public.instances_legacy;
CREATE TABLE IF NOT EXISTS public._bkp_contacts_legacy  AS SELECT * FROM public.contacts_legacy;
CREATE TABLE IF NOT EXISTS public._bkp_campaigns_legacy AS SELECT * FROM public.campaigns_legacy;
CREATE TABLE IF NOT EXISTS public._bkp_results_legacy   AS SELECT * FROM public.campaign_results_legacy;
CREATE TABLE IF NOT EXISTS public._bkp_payments_legacy  AS SELECT * FROM public.payments_legacy;

-- Verificar snapshots
SELECT 'profiles'  AS tabela, COUNT(*) FROM public._bkp_profiles
UNION ALL
SELECT 'instances_legacy', COUNT(*) FROM public._bkp_instances_legacy
UNION ALL
SELECT 'contacts_legacy',  COUNT(*) FROM public._bkp_contacts_legacy
UNION ALL
SELECT 'campaigns_legacy', COUNT(*) FROM public._bkp_campaigns_legacy
UNION ALL
SELECT 'results_legacy',   COUNT(*) FROM public._bkp_results_legacy
UNION ALL
SELECT 'payments_legacy',  COUNT(*) FROM public._bkp_payments_legacy;
```

> Remova os snapshots `_bkp_*` após 30 dias de operação estável com `DROP TABLE`.

---

## 3. Passo a passo da migração

A migração é executada integralmente pelo arquivo `migration-v2.sql`.  
Cada passo é idempotente: pode ser re-executado sem duplicar dados.

> **Transação atômica:** Os passos 2 a 9 são envolvidos em `BEGIN/COMMIT`. Se qualquer erro ocorrer em qualquer passo, o PostgreSQL reverte **toda** a migração automaticamente — nenhum estado parcial fica persistido. O Passo 0 (verificação de pré-condições + contagens) e o Passo 1 (criação das tabelas temporárias de mapeamento) ficam intencionalmente fora da transação por serem operações preparatórias e não destrutivas.

### Passo 0 — Contagens pré-migração (snapshot)

Registra os totais de cada tabela legada antes de qualquer operação.  
Saída via `RAISE NOTICE` no log do SQL Editor.

### Passo 1 — Tabelas de mapeamento temporárias

Cria 3 tabelas `TEMP` na sessão:

| Tabela temp | Propósito |
|---|---|
| `_migration_user_workspace` | Mapeia `user_id` → `workspace_id` novo |
| `_migration_instance_id_map` | Mapeia `instances_legacy.id` → `instances.id` novo |
| `_migration_campaign_id_map` | Mapeia `campaigns_legacy.id` → `campaigns.id` novo |

> As tabelas temporárias são destruídas automaticamente ao fechar a sessão.

### Passo 2 — Criar workspace por usuário legado

Para cada `user_id` distinto encontrado nas tabelas legadas:

- Verifica se já existe um workspace com `owner_user_id = user_id` (idempotência)
- Se não existir: cria o workspace com nome baseado no `full_name` ou `email`
- Insere o usuário como `owner` em `workspace_members`
- Popula a tabela de mapeamento `_migration_user_workspace`

**Nome do workspace:** `full_name` do perfil, ou parte do email antes do `@`, ou `Workspace <8chars-do-uuid>`.  
**Slug:** versão lowercase + hífens do nome, com os 8 primeiros chars do `user_id` como sufixo para garantir unicidade.

### Passo 3 — Migrar `profiles` → `users_profiles`

Campos migrados:

| `profiles` | `users_profiles` |
|---|---|
| `id` | `id` |
| `full_name` | `full_name` |
| `is_active` | `is_active` |
| `created_at` | `created_at` |
| *(auth.users.email)* | `email` |
| *(workspace do mapeamento)* | `default_workspace_id` |

Usa `ON CONFLICT (id) DO UPDATE` — não sobrescreve se o usuário já tinha perfil no schema v2.

### Passo 4 — Migrar `instances_legacy` → `instances`

Campos migrados:

| `instances_legacy` | `instances` |
|---|---|
| `id` | *(novo UUID gerado)* |
| `user_id` | `workspace_id` *(via mapeamento)* |
| `name` | `name` |
| `apikey` | `apikey` |
| `status` | `status` *(cast para enum; inválidos → `unknown`)* |
| `total_sent` | `total_sent` |
| `success_count` | `success_count` |
| `error_count` | `error_count` |
| `last_check` | `last_check` |
| *(fixo)* | `provider = 'evolution'` |

Registra o mapeamento `old_id → new_id` em `_migration_instance_id_map`.  
Conflito por `(workspace_id, name)` é ignorado (`ON CONFLICT DO NOTHING`).

### Passo 5 — Migrar `contacts_legacy` → `contacts` + `contact_tags`

**5a — Contatos:**

| `contacts_legacy` | `contacts` |
|---|---|
| `user_id` | `workspace_id` *(via mapeamento)* |
| `name` | `name` |
| `phone` | `phone` |
| `email` | `email` |
| `user_id` | `created_by` *(usuário original)* |
| *(fixo)* | `source = 'import'` |

Conflito por `(workspace_id, phone)` é ignorado.

**5b — Tags:**

Para cada contato com `tags IS NOT NULL AND array_length(tags, 1) > 0`:
- Faz `UNNEST(tags)` e insere cada tag individualmente em `contact_tags`
- Conflito por `(workspace_id, contact_id, tag)` é ignorado

### Passo 6 — Migrar `campaigns_legacy` → `campaigns`

| `campaigns_legacy` | `campaigns` |
|---|---|
| `user_id` | `workspace_id` *(via mapeamento)* |
| `name` | `name` |
| `status` | `status` *(cast para enum; inválidos → `completed`)* |
| `total_contacts` | `total_contacts` |
| `sent_count` | `sent_count` |
| `success_count` | `success_count` |
| `error_count` | `error_count` |
| `started_at` | `started_at` |
| `finished_at` | `finished_at` |
| `user_id` | `created_by` |
| `message_preview`, `has_media` | `settings` JSONB |
| *(fixo)* | `channel = 'whatsapp'` |

Registra mapeamento `old_id → new_id` em `_migration_campaign_id_map`.

### Passo 7 — Migrar `campaign_results_legacy` → `campaign_dispatch_logs` + `campaign_contacts`

**7a — `campaign_dispatch_logs`:**

| `campaign_results_legacy` | `campaign_dispatch_logs` |
|---|---|
| `campaign_id` | `campaign_id` *(via mapeamento)* |
| *(do workspace da campanha)* | `workspace_id` |
| `phone` → lookup `contacts` | `contact_id` *(pode ser NULL se não migrado)* |
| `campaign.instance_id` → map | `instance_id` *(pode ser NULL)* |
| `status` | `status` *(com mapeamento: `failed`→`error`)* |
| `error_msg` | `error_msg` |
| `sent_at` | `sent_at` |
| `contact_name`, `phone` | `message_snapshot` JSONB |

**7b — `campaign_contacts`:**

Cria um registro por combinação única `(campaign_id, contact_id)` com status derivado:
- Se todos os logs do contato na campanha são `success` → `success`
- Se algum é `error` → `error`
- Caso contrário → `pending`

### Passo 8 — Migrar `payments_legacy` → `payments`

| `payments_legacy` | `payments` |
|---|---|
| `user_id` | `workspace_id` *(via mapeamento)* |
| `status` | `status` *(cast para enum)* |
| `amount` | `amount` |
| `currency` | `currency` |
| `due_date` | `due_date` |
| `paid_at` | `paid_at` |
| `notes` | `notes` |
| `asaas_payment_id` | `provider_payment_id` |
| `payment_link` | `payment_link` |
| `boleto_url` | `boleto_url` |
| `asaas_payment_id IS NOT NULL` | `provider = 'asaas'` |
| `asaas_customer_id`, `plan`, `instance_count` | `metadata` JSONB |

### Passo 9 — Validação pós-migração

Exibe via `RAISE NOTICE`:
- Contagem de cada tabela legacy vs nova
- Taxa de aproveitamento por entidade
- Registros órfãos (sem workspace mapeado)
- Contatos sem `workspace_id` em `campaign_dispatch_logs`

### Passo 10 — (Opcional) Bloquear acesso às tabelas legadas

**Executar somente após 30 dias de operação estável e validação completa.**

```sql
-- Bloquear leitura de tabelas legadas (apenas service_role pode acessar)
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances_legacy  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_legacy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns_legacy  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_results_legacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_legacy   ENABLE ROW LEVEL SECURITY;
-- Sem políticas = nenhum usuário autenticado acessa
```

---

## 4. Queries de validação antes/depois

Execute após o `migration-v2.sql` para confirmar integridade:

```sql
-- ── Contagens comparativas ──
SELECT
    'profiles → users_profiles' AS migracao,
    (SELECT COUNT(*) FROM public.profiles)       AS origem,
    (SELECT COUNT(*) FROM public.users_profiles) AS destino
UNION ALL
SELECT
    'instances_legacy → instances',
    (SELECT COUNT(*) FROM public.instances_legacy),
    (SELECT COUNT(*) FROM public.instances)
UNION ALL
SELECT
    'contacts_legacy → contacts',
    (SELECT COUNT(*) FROM public.contacts_legacy),
    (SELECT COUNT(*) FROM public.contacts)
UNION ALL
SELECT
    'campaigns_legacy → campaigns',
    (SELECT COUNT(*) FROM public.campaigns_legacy),
    (SELECT COUNT(*) FROM public.campaigns)
UNION ALL
SELECT
    'campaign_results_legacy → dispatch_logs',
    (SELECT COUNT(*) FROM public.campaign_results_legacy),
    (SELECT COUNT(*) FROM public.campaign_dispatch_logs)
UNION ALL
SELECT
    'payments_legacy → payments',
    (SELECT COUNT(*) FROM public.payments_legacy),
    (SELECT COUNT(*) FROM public.payments)
UNION ALL
SELECT
    'users → workspaces',
    (SELECT COUNT(DISTINCT user_id) FROM public.instances_legacy),
    (SELECT COUNT(*) FROM public.workspaces);
```

```sql
-- ── Registros sem workspace (devem retornar 0) ──
SELECT 'instances sem workspace'      AS check_item, COUNT(*) FROM public.instances     WHERE workspace_id IS NULL
UNION ALL
SELECT 'contacts sem workspace',       COUNT(*) FROM public.contacts     WHERE workspace_id IS NULL
UNION ALL
SELECT 'campaigns sem workspace',      COUNT(*) FROM public.campaigns    WHERE workspace_id IS NULL
UNION ALL
SELECT 'payments sem workspace',       COUNT(*) FROM public.payments     WHERE workspace_id IS NULL;
```

```sql
-- ── Workspaces sem owner ──
SELECT COUNT(*) FROM public.workspaces WHERE owner_user_id IS NULL;
-- Deve retornar 0 para workspaces criados na migração
```

```sql
-- ── Workspace members sem role owner ──
SELECT w.name, COUNT(m.id) as membros_owner
FROM public.workspaces w
LEFT JOIN public.workspace_members m
  ON m.workspace_id = w.id AND m.role = 'owner'
GROUP BY w.id, w.name
HAVING COUNT(m.id) = 0;
-- Deve retornar 0 linhas
```

---

## 5. Checklist de rollback

Se a migração falhar ou causar inconsistências, siga os passos abaixo **na ordem**:

### 5.1 Rollback parcial (erros em passos específicos)

O script usa `ON CONFLICT DO NOTHING` / `DO UPDATE`, tornando-o **não destrutivo**.  
Para desfazer um passo específico:

```sql
-- Desfazer Passo 3 (users_profiles migrados): apagar somente os inseridos pela migração
-- (os que têm default_workspace_id preenchido E existem em profiles)
DELETE FROM public.users_profiles
WHERE id IN (SELECT id FROM public.profiles)
  AND default_workspace_id IS NOT NULL;

-- Desfazer Passo 4 (instances migradas): apagar todas as instances com source legado
-- (use a tabela de mapeamento se ainda tiver a sessão aberta)
-- Caso contrário: identificar pelo metadata
DELETE FROM public.instances
WHERE metadata->>'migrated_from' = 'instances_legacy';

-- Desfazer Passo 5 (contacts migrados)
DELETE FROM public.contacts
WHERE source = 'import' AND created_at >= '<timestamp da migração>';

-- Desfazer Passos 6 e 7 (campanhas e logs)
DELETE FROM public.campaign_dispatch_logs
WHERE created_at >= '<timestamp da migração>';
DELETE FROM public.campaign_contacts
WHERE created_at >= '<timestamp da migração>';
DELETE FROM public.campaigns
WHERE created_at >= '<timestamp da migração>';

-- Desfazer Passo 8 (payments)
DELETE FROM public.payments
WHERE metadata->>'migrated_from' = 'payments_legacy';

-- Desfazer Passo 2 (workspaces e members)
-- CUIDADO: só desfazer se o sistema ainda não estiver em uso!
DELETE FROM public.workspace_members
WHERE joined_at >= '<timestamp da migração>';
DELETE FROM public.workspaces
WHERE created_at >= '<timestamp da migração>';
```

### 5.2 Rollback total (restaurar backup)

1. No Supabase Dashboard: **Settings → Backups → Restore** (selecionar backup gerado antes da migração)
2. **Confirmar** que o timestamp do backup é anterior à migração
3. Após restauração, verificar que as tabelas legadas estão íntegras
4. O sistema anterior (single-tenant) voltará a funcionar normalmente

### 5.3 Checklist de verificação pós-rollback

- [ ] `SELECT COUNT(*) FROM public.profiles` retorna o mesmo valor de antes
- [ ] `SELECT COUNT(*) FROM public.instances_legacy` retorna o mesmo valor de antes
- [ ] `SELECT COUNT(*) FROM public.contacts_legacy` retorna o mesmo valor de antes
- [ ] Login e dashboard funcionando normalmente no frontend
- [ ] Nenhuma tabela nova `_bkp_*` interferindo no sistema

---

## 6. Pós-migração: ativar Realtime

Após execução bem-sucedida, ativar a publication do Realtime separadamente:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_status;
```

## 7. Plano de remoção das tabelas legadas (T+30 dias)

Após 30 dias de operação estável, validações aprovadas e nenhum incidente:

```sql
-- Executar somente após aprovação explícita
DROP TABLE IF EXISTS public._bkp_profiles          CASCADE;
DROP TABLE IF EXISTS public._bkp_instances_legacy  CASCADE;
DROP TABLE IF EXISTS public._bkp_contacts_legacy   CASCADE;
DROP TABLE IF EXISTS public._bkp_campaigns_legacy  CASCADE;
DROP TABLE IF EXISTS public._bkp_results_legacy    CASCADE;
DROP TABLE IF EXISTS public._bkp_payments_legacy   CASCADE;

DROP TABLE IF EXISTS public.campaign_results_legacy CASCADE;
DROP TABLE IF EXISTS public.campaigns_legacy        CASCADE;
DROP TABLE IF EXISTS public.payments_legacy         CASCADE;
DROP TABLE IF EXISTS public.contacts_legacy         CASCADE;
DROP TABLE IF EXISTS public.instances_legacy        CASCADE;
DROP TABLE IF EXISTS public.profiles                CASCADE;
```

> **Atenção:** Verificar que nenhum fluxo do n8n ou código do frontend ainda referencia estas tabelas antes de executar o DROP.

---

*Gerado para: Disparo Pro — Schema SaaS v2.0 | 2026-05-08*
