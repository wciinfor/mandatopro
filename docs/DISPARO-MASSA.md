# 📨 Disparo em Massa - Email, SMS e WhatsApp

## Visão Geral

Sistema completo de **disparo em massa de mensagens** via múltiplos canais:
- ✅ WhatsApp Business
- ✅ Email
- ✅ SMS

Integrado ao módulo de **Comunicação** do MandatoPro.

## Localização

- **Menu**: Comunicação
- **URL**: `/comunicacao`
- **Botão**: "Enviar em Massa" (apenas para administradores)

## Arquitetura

### 1. Componente Frontend
**Arquivo**: `src/components/DisparoMassaModal.js`

Interface modal com:
- Seleção de destinatários (todos/lideranças/operadores)
- Seleção de canais (WhatsApp/Email/SMS)
- Editor de mensagem
- Assunto do email (opcional)
- Visualização de resultados

### 2. API Backend
**Arquivo**: `src/pages/api/comunicacao/enviar-massa.js`

Endpoint: `POST /api/comunicacao/enviar-massa`

**Request:**
```json
{
  "tipo": "todos|liderancas|operadores",
  "mensagem": "Seu texto aqui",
  "assunto": "Título (opcional, para email)",
  "canais": ["whatsapp", "email", "sms"]
}
```

**Response:**
```json
{
  "success": true,
  "mensagem": "10 mensagens enviadas, 0 erros",
  "resumo": {
    "total": 10,
    "sucessos": 10,
    "erros": 0,
    "destinatarios": 10,
    "canais": ["whatsapp", "email", "sms"],
    "tipo": "todos"
  },
  "resultados": [
    {
      "canal": "whatsapp",
      "destinatario": "João Silva",
      "contato": "5591988889999",
      "status": "enviado",
      "messageId": "wpp_123456"
    }
  ]
}
```

## Funcionalidades

### Seleção de Destinatários

| Opção | Descrição | Usuários |
|-------|-----------|----------|
| **Todos** | Todos os usuários | Lideranças + Operadores |
| **Lideranças** | Apenas líderes | Lideranças |
| **Operadores** | Apenas operadores | Operadores |

### Canais de Envio

#### WhatsApp Business
- Usa configuração salva em `/configuracoes/sistema`
- Integrado com WhatsApp Cloud API v21.0
- Requer: Phone Number ID + Access Token
- Formato de telefone: `5591988889999`
- Status: **Produção** (requer credenciais)

#### Email
- Simulado em desenvolvimento
- Em produção: Usar Resend, SendGrid, AWS SES, etc.
- Suporta assunto customizável
- Status: **Desenvolvimento**

#### SMS
- Simulado em desenvolvimento
- Em produção: Usar Twilio, AWS SNS, etc.
- Requer número de telefone válido
- Status: **Desenvolvimento**

## Como Usar

### Passo 1: Abrir Modal
1. Navegue para **Comunicação**
2. Clique no botão **"Enviar em Massa"**
3. Modal abre com formulário

### Passo 2: Selecionar Destinatários
- Escolha entre: Todos, Lideranças ou Operadores
- Pode selecionar apenas uma opção

### Passo 3: Selecionar Canais
- Marque os canais desejados:
  - ☑️ WhatsApp (verde)
  - ☑️ Email (azul)
  - ☑️ SMS (roxo)
- Deve selecionar pelo menos um

### Passo 4: Escrever Mensagem
- Digite a mensagem (máx. 1000 caracteres)
- Se email selecionado: adicione assunto (opcional)
- Revisar bem antes de enviar

### Passo 5: Enviar
- Clique em **"Enviar"**
- Sistema processa e exibe resultado
- Mostra sucesso/erro para cada destinatário

## Exemplos

### Exemplo 1: Comunicado via WhatsApp
```
Tipo: Todos
Canais: WhatsApp
Mensagem: "Atenção! Reunião hoje às 18h. Compareça com documentação."
```

### Exemplo 2: Email com Aviso
```
Tipo: Lideranças
Canais: Email
Assunto: "Atualização de Procedimentos"
Mensagem: "Novo procedimento de validação de cadastros..."
```

### Exemplo 3: Multicanal
```
Tipo: Operadores
Canais: WhatsApp, Email, SMS
Mensagem: "Fim de expediente! Próximo turno às 8h."
```

## Dados Armazenados

### Usuários Mock (BD)
```javascript
{
  id: 1,
  nome: 'João Silva',
  email: 'joao@example.com',
  telefone: '5591988889999',
  tipo: 'lideranca'
}
```

### Log de Disparos
**Arquivo**: `logs/disparos.log`

Registra cada operação:
```json
{
  "timestamp": "2025-11-24T10:30:00.000Z",
  "tipo": "todos",
  "destinatarios": 4,
  "canal": "whatsapp, email, sms",
  "status": "sucesso",
  "resultado": [...]
}
```

## Validações

- ✅ Mensagem não pode estar vazia
- ✅ Deve selecionar pelo menos um canal
- ✅ Validação de tipo de destinatário
- ✅ Verificação de contato disponível por canal
- ✅ Tratamento de erros individual por mensagem

## Resposta de Erro

```json
{
  "success": false,
  "message": "WhatsApp não configurado",
  "resumo": {...},
  "resultados": [
    {
      "canal": "whatsapp",
      "destinatario": "João",
      "status": "erro",
      "erro": "WhatsApp não configurado"
    }
  ]
}
```

## Integrações Futuras

### Email
```bash
npm install resend
# ou
npm install nodemailer
```

### SMS
```bash
npm install twilio
# ou
npm install axios  # para AWS SNS
```

### Rastreamento
- Armazenar status de cada mensagem
- Dashboard de estatísticas
- Relatórios de entrega

## Logs e Monitoramento

### Ver histórico
```bash
cat logs/disparos.log | tail -20
```

### Analisar falhas
```javascript
// Filtrar por status
const falhas = resultado.resultados.filter(r => r.status === 'erro');
```

## Limitações Atuais

⚠️ **Desenvolvimento**:
- Email: Simulado (implementar serviço real)
- SMS: Simulado (implementar serviço real)
- Não há fila de mensagens
- Sem agendamento de envios

⚠️ **WhatsApp**:
- Requer credenciais configuradas
- Limite de 1000 mensagens/dia (plano gratuito)
- Deve respeitar rate limiting

## Troubleshooting

### "WhatsApp não configurado"
✅ Solução: Vá para `/configuracoes/sistema` e configure credenciais

### "Nenhum destinatário encontrado"
✅ Solução: Verifique se existem usuários do tipo selecionado

### "Erro ao enviar WhatsApp"
✅ Solução: Valide Phone Number ID e Access Token

### Envios ficaram em "erro"
✅ Solução: Verifique se contatos (email/telefone) estão preenchidos

## Próximas Melhorias

1. **Fila de Mensagens** - Usar Bull/RabbitMQ
2. **Agendamento** - Cron jobs para envios futuros
3. **Templates** - Modelos pré-configurados
4. **Personalização** - Variáveis (nome, CPF, etc.)
5. **Analytics** - Dashboard de entrega
6. **Retentativas** - Reintentar falhas
7. **Webhooks** - Callbacks de status
8. **Suporte a Mídias** - Imagens/documentos

## Arquivos Relacionados

- `src/components/DisparoMassaModal.js` - Interface
- `src/pages/api/comunicacao/enviar-massa.js` - API
- `src/pages/comunicacao/index.js` - Integração
- `src/services/whatsapp-business.js` - WhatsApp Service
- `public/sistema-config.json` - Configuração

---

**Versão**: 1.0  
**Status**: Em Desenvolvimento  
**Último Update**: 24 de Novembro de 2025

