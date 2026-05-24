# Integracao Disparo PRO no MandatoPro

## Decisao de arquitetura

O Disparo PRO ja e um sistema funcional. A integracao no MandatoPro deve reaproveitar o motor existente, nao recriar disparo, pausa, lote, horario comercial, agendamento ou n8n do zero.

O MandatoPro deve entrar como:

- autenticacao e menu principal;
- fonte de contatos institucionais;
- contexto do parlamentar/cliente;
- modulo visual unificado.
- Supabase principal para armazenar apenas as tabelas operacionais usadas pelo Disparo PRO embutido.

O Disparo PRO deve continuar responsavel por:

- preparo da campanha;
- validacao/deduplicacao final da lista;
- mensagens, midia e tags;
- pausas, retomada, horario comercial e agendamento;
- envio via n8n/Evolution;
- progresso, historico e relatorios;
- inbox multiatendente, se ativado.

## O que ja existe no frontend do Disparo PRO

Arquivos principais:

- `Painel/index.html`
- `Painel/frontend/js/modules/integrations.js`
- `Painel/frontend/js/modules/contacts.js`
- `Painel/frontend/js/modules/instances.js`
- `Painel/frontend/js/modules/campaigns.js`
- `Painel/frontend/js/modules/dashboard.js`
- `Painel/frontend/js/modules/reports.js`
- `Painel/frontend/js/modules/settings.js`
- `Painel/frontend/js/modules/inbox/*`

Funcionalidades encontradas:

- importacao Excel/CSV;
- validacao brasileira de telefone;
- remocao de duplicados;
- envio com instancia manual ou multiplas instancias ativas;
- mensagens multiplas com rotacao;
- texto com tags dinamicas `{nome}`, `{saudacao}`, `{oi}`, `{obrigado}`, `{tchau}`;
- midia por arquivo e URL: imagem, video, audio, PDF;
- preview estilo WhatsApp;
- IA para variacoes via n8n/OpenAI;
- envio opcional por e-mail;
- pausa manual;
- retomada com novas configuracoes;
- pausa por lote;
- horario comercial;
- agendamento;
- retomada de disparo interrompido por estado local;
- progresso, timer, estatisticas e grafico;
- historico e relatorio completo;
- backup e restore;
- exportacao de contatos da instancia;
- inbox multiatendente com realtime, IA, SLA e automacoes.

## O que ja existe no backend separado

Arquivos principais:

- `Painel/backend/src/api/routes/campaigns.routes.ts`
- `Painel/backend/src/api/routes/instances.routes.ts`
- `Painel/backend/src/api/routes/webhooks.routes.ts`
- `Painel/backend/src/modules/inbox/*`
- `Painel/backend/src/jobs/queue.ts`
- `Painel/backend/src/jobs/workers/*`
- `Painel/backend/src/services/evolution.service.ts`
- `Painel/backend/src/services/n8n.service.ts`

Funcionalidades encontradas:

- Fastify;
- Supabase admin client;
- autenticacao e workspace;
- permissoes por papel;
- instancias Evolution;
- campanhas, mensagens, contatos e logs;
- BullMQ/Redis para filas;
- worker de campanhas;
- workers de inbox, IA, SLA e DLQ;
- webhooks Evolution e Asaas;
- metricas Prometheus;
- health checks;
- rate limit por workspace;
- circuit breaker/retry na Evolution;
- inbox com conversas, mensagens, anexos, labels, respostas rapidas, atribuicao, transferencia, SLA e alertas.

## Workflow n8n existente

Arquivos:

- `Workflow/Contactiva PRO - Versao 3.1.json`
- `Painel/n8n/workflows/Disparo PRO.json`

Acoes aceitas no webhook principal:

- `login`
- `verificar_conexao`
- `exportar_contatos`
- `relatorio`
- `enviar_mensagem`
- `test_connection`

Recursos no fluxo:

- envio texto via `message/sendText/{instance}`;
- envio midia via `message/sendMedia/{instance}`;
- verificacao de instancia via `instance/connect/{instance}`;
- verificacao de numeros WhatsApp via `chat/whatsappNumbers/{instance}`;
- exportacao de contatos da instancia via `chat/findContacts/{instance}`;
- IA via OpenAI no n8n;
- envio de e-mail;
- conversao de anexos/base64;
- classificacao de midia por mimetype.

## O que nao deve ser recriado agora

- motor de envio proprio no Next;
- pausa/retomada/cancelamento paralelo;
- controle de horario comercial paralelo;
- agendamento paralelo;
- relatorio paralelo;
- inbox paralelo;
- criacao manual de instancia fora do fluxo ja existente.

## Contrato de integracao recomendado

### Entrada no MandatoPro

Adicionar `/disparos` no menu lateral, autenticado pelo MandatoPro.

### Origem dos contatos

Criar um endpoint MandatoPro que entregue contatos no formato que o Disparo PRO ja entende:

```json
[
  {
    "name": "Maria Silva",
    "phone": "5585999999999",
    "email": "maria@email.com",
    "source": "eleitor",
    "sourceId": 123,
    "city": "Fortaleza",
    "neighborhood": "Centro"
  }
]
```

Fontes iniciais:

- eleitores;
- liderancas;
- funcionarios.

Endpoints criados no MandatoPro:

- `GET /api/disparos/contatos/preview`: retorna contatos normalizados para pre-visualizacao.
- `GET /api/disparos/contatos/export`: retorna contatos validos no contrato do Disparo PRO.
- `GET /api/disparos/contatos/export?format=csv`: retorna CSV com `nome;telefone;email;origem;origem_id;cidade;bairro`.

Filtros aceitos:

- `origem=eleitores|liderancas|funcionarios`
- `cidade`
- `bairro`
- `status`
- `search`
- `limit`

Fontes futuras:

- campanhas;
- atendimentos;
- solicitacoes;
- aniversariantes.

### Adaptacao visual

Remover/ocultar do Disparo PRO:

- login proprio;
- admin financeiro;
- billing/Asaas;
- cadastro de usuarios/workspaces antigo, se nao for usado no MandatoPro.

Manter:

- dashboard;
- contatos;
- instancias;
- configuracoes;
- editor de campanha;
- progresso;
- resultados;
- historico;
- atendimento, se o cliente for usar inbox;
- backup/restore, se ficar restrito a admin.

Implementacao inicial:

- `scripts/build-disparo-pro-embed.mjs` gera a versao embutivel em `public/disparo-pro`.
- `public/disparo-pro/index.html` e derivado de `Painel/index.html`, sem a tela de login.
- O embed remove os arquivos de admin financeiro do pacote publicado.
- `public/disparo-pro/mandatopro-embed.js` injeta autenticacao via MandatoPro e adiciona importacao de contatos da base MandatoPro.
- `src/pages/disparos/index.js` abre a experiencia em iframe usando `/disparo-pro/index.html`.
- `supabase/migrations/234_create_disparo_pro_legacy_runtime_tables.sql` cria `instances`, `contacts`, `campaigns` e `campaign_results`, que sao as tabelas que o frontend legado usa para instancias, contatos e historico.

Para atualizar o embed apos mudancas no `Painel`, executar:

```bash
node scripts/build-disparo-pro-embed.mjs
```

## Fases sugeridas

1. Embutir a tela operacional do Disparo PRO no MandatoPro sem login/admin/billing.
2. Substituir a origem de contatos por endpoint MandatoPro, mantendo CSV/Excel.
3. Ajustar configuracoes para usar variaveis/envs do MandatoPro.
4. Validar fluxo completo com n8n/Evolution atual.
5. Depois decidir se o backend Fastify/BullMQ entra como servico separado ou se partes viram API Next.

## Observacao sobre o trabalho atual

As APIs/tabelas `disparo_*` criadas no MandatoPro servem como rascunho de ponte e auditoria, mas nao devem virar o motor principal enquanto o Disparo PRO existente nao for completamente acoplado e testado.

Para o fluxo operacional atual, o embed usa o modo legado do Disparo PRO:

- Supabase publico do MandatoPro para sessao e tabelas runtime;
- proxy server-side `/api/disparos/n8n`, configurado com `N8N_WEBHOOK_DISPARO_PRO`, para verificar conexao, enviar mensagens, exportar contatos e gerar relatorios sem expor a URL real do webhook no HTML;
- endpoint MandatoPro `/api/disparos/contatos/export` para importar eleitores, liderancas e funcionarios.
