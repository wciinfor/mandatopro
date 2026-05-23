with target_tables(table_name) as (
  values
    ('agenda_eventos'),
    ('aniversariantes'),
    ('atendimentos'),
    ('atendimentos_historico'),
    ('atendimentos_servicos'),
    ('campanhas'),
    ('campanhas_liderancas'),
    ('campanhas_servicos'),
    ('categorias_servicos'),
    ('comunicacao_contatos'),
    ('comunicacao_conversas'),
    ('comunicacao_disparos'),
    ('comunicacao_mensagens'),
    ('configuracoes_sistema'),
    ('documentos'),
    ('eleitores'),
    ('emendas'),
    ('financeiro_caixa'),
    ('financeiro_despesas'),
    ('financeiro_doadores'),
    ('financeiro_faturas'),
    ('financeiro_lancamentos'),
    ('financeiro_parceiros'),
    ('funcionarios'),
    ('geolocalizacao'),
    ('liderancas'),
    ('logs_acessos'),
    ('logs_auditoria'),
    ('notificacoes'),
    ('orgaos'),
    ('repasses'),
    ('responsaveis_emendas'),
    ('solicitacoes'),
    ('usuarios')
),
table_status as (
  select
    t.table_name,
    c.oid is not null as exists_in_remote,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    coalesce(count(p.policyname), 0) as policy_count
  from target_tables t
  left join pg_class c
    on c.relname = t.table_name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = t.table_name
  group by t.table_name, c.oid, c.relrowsecurity
),
view_status as (
  select
    c.relname as view_name,
    c.oid is not null as exists_in_remote,
    coalesce(array_to_string(c.reloptions, ','), '') as reloptions
  from (values ('financeiro_movimentacoes')) v(view_name)
  left join pg_class c
    on c.relname = v.view_name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'v'
)
select
  'table' as object_type,
  table_name as object_name,
  exists_in_remote,
  rls_enabled,
  policy_count::text as details
from table_status
union all
select
  'view' as object_type,
  view_name as object_name,
  exists_in_remote,
  reloptions ilike '%security_invoker=true%' as rls_enabled,
  reloptions as details
from view_status
order by object_type, object_name;
