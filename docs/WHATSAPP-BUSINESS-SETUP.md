# WhatsApp Business Cloud API - Guia Completo de Configuração

## 🎯 **Por que API Oficial?**

### ✅ **Vantagens:**
- **Estável e Confiável** - Sem logout inesperado
- **Sem QR Code** - Autenticação via token permanente
- **1.000 Conversas Grátis/Mês** - Tier gratuito generoso
- **Webhooks** - Receba mensagens em tempo real
- **Suporte Oficial** - Documentação completa do Meta
- **Produção Ready** - Usado por empresas de todo mundo
- **Não viola ToS** - API autorizada pelo WhatsApp

### ❌ **API Não Oficial (whatsapp-web.js):**
- ❌ Logout constante
- ❌ Pode bloquear sua conta
- ❌ Instável em produção
- ❌ Contra os Termos de Serviço
- ❌ Precisa QR Code toda hora

---

## 📋 **Passo a Passo Completo**

### **1. Criar Conta no Meta for Developers**

1. Acesse: https://developers.facebook.com
2. Faça login com sua conta Facebook/Meta
3. Clique em **"Get Started"** (se for primeira vez)
4. Complete o cadastro como desenvolvedor

### **2. Criar um App**

1. No painel, clique em **"Create App"**
2. Escolha o tipo: **"Business"**
3. Preencha:
   - **App Name**: MandatoPro WhatsApp
   - **App Contact Email**: seu@email.com
   - **Business Account**: Crie ou selecione uma
4. Clique em **"Create App"**

### **3. Adicionar Produto WhatsApp**

1. No painel do App, procure por **"WhatsApp"**
2. Clique em **"Set Up"** ou **"Add Product"**
3. Aguarde alguns segundos enquanto configura

### **4. Obter Phone Number ID**

1. No menu lateral, vá em **WhatsApp → API Setup**
2. Você verá uma seção **"Send and receive messages"**
3. Copie o **Phone Number ID** (número longo, ex: `123456789012345`)
4. Esse é o número de teste fornecido pelo Meta (gratuito!)

### **5. Gerar Access Token**

#### **Opção A: Token Temporário (24h)**
1. Na mesma página **API Setup**
2. Copie o **Temporary Access Token**
3. ⚠️ Expira em 24 horas - bom para testes

#### **Opção B: Token Permanente (Recomendado)**
1. No menu lateral, vá em **Settings → Basic**
2. Role até **"App ID"** e **"App Secret"**
3. Vá para **Tools → Graph API Explorer**
4. Selecione seu App no dropdown
5. Em **Permissions**, adicione:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Clique em **"Generate Access Token"**
7. Copie e guarde em local seguro!

### **6. Configurar no MandatoPro**

1. No sistema, vá em **Configurações → WhatsApp Business**
2. Cole o **Phone Number ID**
3. Cole o **Access Token**
4. Clique em **"Salvar Configuração"**
5. ✅ Se aparecer "Configurado", está pronto!

### **7. Testar Envio**

1. Na seção **"Testar Envio"**
2. Digite seu número: `5591988889999` (com código do país)
3. Clique em **"Enviar Teste"**
4. ✅ Se recebeu no WhatsApp, sucesso! 🎉

---

## 🔔 **Configurar Webhooks (Receber Mensagens)**

### **1. Obter URL Pública**

Você precisa de uma URL pública HTTPS. Opções:

**Opção A: Deploy em Produção**
- Vercel: `https://seu-app.vercel.app/api/whatsapp-business/webhook`
- Heroku: `https://seu-app.herokuapp.com/api/whatsapp-business/webhook`

**Opção B: Túnel Local (Desenvolvimento)**
```bash
# Instalar ngrok
npm install -g ngrok

# Criar túnel
ngrok http 3000

# URL será algo como: https://abc123.ngrok.io
```

### **2. Configurar no Meta**

1. No painel do App, vá em **WhatsApp → Configuration**
2. Clique em **"Edit"** na seção **Webhook**
3. Preencha:
   - **Callback URL**: `https://seu-dominio.com/api/whatsapp-business/webhook`
   - **Verify Token**: `mandato-pro-webhook-token`
4. Clique em **"Verify and Save"**
5. ✅ Se verificar, marque os eventos:
   - `messages` (receber mensagens)
   - `messaging_postbacks`

### **3. Variável de Ambiente**

Crie arquivo `.env.local`:

```env
WHATSAPP_VERIFY_TOKEN=mandato-pro-webhook-token
```

---

## 💰 **Preços e Limites**

### **Tier Gratuito:**
- ✅ **1.000 conversas/mês grátis**
- ✅ Número de teste incluído
- ✅ Todos os recursos disponíveis

### **O que conta como "conversa":**
- Uma conversa = janela de 24 horas
- Você pode enviar mensagens ilimitadas dentro de 24h
- Após 24h de inatividade, nova conversa é contabilizada

### **Após 1.000 conversas:**
- Custo varia por país
- Brasil: ~R$ 0,30 por conversa
- Só paga conversas iniciadas por você
- Respostas de usuários são gratuitas

---

## 🔐 **Segurança**

### **Boas Práticas:**

1. **NUNCA commite tokens no Git**
```bash
# Adicione no .gitignore
.env.local
.env.production
```

2. **Use variáveis de ambiente**
```javascript
// ❌ ERRADO
const token = 'EAAxxxxxxxxxxxx...';

// ✅ CORRETO
const token = process.env.WHATSAPP_ACCESS_TOKEN;
```

3. **Tokens Permanentes**
   - Guarde em gerenciador de senhas
   - Rotacione periodicamente
   - Monitore uso no painel do Meta

4. **Webhook**
   - Use HTTPS obrigatório
   - Valide tokens de verificação
   - Implemente rate limiting

---

## 📱 **Número de Produção**

O Meta fornece um número de teste, mas para produção:

### **Opção 1: Usar Número de Teste**
- Pode enviar para qualquer número
- Limite de 250 números únicos
- Bom para testes e pequena escala

### **Opção 2: Número Verificado (Recomendado)**
1. Precisa de um número real de WhatsApp Business
2. No painel, vá em **WhatsApp → Phone Numbers**
3. Clique em **"Add Phone Number"**
4. Siga processo de verificação (SMS ou chamada)
5. Aguarde aprovação (pode demorar algumas horas)

### **Benefícios do Número Verificado:**
- ✅ Sem limite de destinatários
- ✅ Nome da empresa aparece
- ✅ Selo verde verificado
- ✅ Estatísticas completas

---

## 📊 **Monitoramento**

### **Painel do Meta:**
1. Vá em **WhatsApp → Analytics**
2. Visualize:
   - Mensagens enviadas
   - Taxa de entrega
   - Conversas ativas
   - Custos

### **Logs no Sistema:**
```javascript
// Os logs aparecem no terminal do servidor
console.log('📤 Enviando mensagem...');
console.log('✅ Mensagem enviada');
console.log('❌ Erro ao enviar');
```

---

## 🆘 **Troubleshooting**

### **Erro: "Token inválido"**
- ✅ Verifique se copiou o token completo
- ✅ Token temporário expira em 24h
- ✅ Gere um token permanente

### **Erro: "Phone Number ID não encontrado"**
- ✅ Copie o ID correto da página API Setup
- ✅ Verifique se App tem WhatsApp habilitado

### **Mensagem não chega**
- ✅ Número está no formato correto? `5591988889999`
- ✅ Número está cadastrado no WhatsApp?
- ✅ Verifique logs no painel do Meta

### **Webhook não funciona**
- ✅ URL é HTTPS?
- ✅ Verify Token está correto?
- ✅ Servidor está online e acessível?

---

## 🔗 **Links Úteis**

- **Meta for Developers**: https://developers.facebook.com
- **Documentação Oficial**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer
- **Status do WhatsApp**: https://status.fb.com
- **Suporte**: https://developers.facebook.com/support

---

## 📞 **Próximos Passos**

Depois de configurar:

1. ✅ Teste com seu próprio número
2. ✅ Configure webhooks para receber mensagens
3. ✅ Integre com outros módulos:
   - Aniversariantes (envio automático)
   - Solicitações (notificações)
   - Agenda (lembretes)
4. ✅ Crie templates aprovados no Meta
5. ✅ Monitore custos e uso

---

## 🎉 **Pronto!**

Agora você tem uma integração **profissional, estável e confiável** com WhatsApp!

**Qualquer dúvida:**
- Consulte a documentação oficial
- Verifique os logs no terminal
- Teste primeiro com o número de teste gratuito

**Boa sorte! 🚀**

