# Configurações do Sistema - MandatoPro

## Visão Geral

A área de **Configurações do Sistema** permite que o parlamentar personalize completamente o MandatoPro com dados da instituição, contatos e integração com WhatsApp Business.

## Localização
- **Menu**: Configurações (novo menu principal)
- **URL**: `/configuracoes/sistema`

## Seções

### 1. Dados do Sistema

#### Logo
- **Upload de imagem** para usar em relatórios e documentos
- Formatos: PNG, JPG
- Recomendação: 200x200px

#### Dados da Instituição
- **Nome do Órgão** (obrigatório) - Ex: Câmara Municipal
- **Sigla** - Ex: CM
- **CNPJ** (obrigatório) - Usado em relatórios oficiais
- **Website** - URL da instituição

#### Endereço e Contatos
- **Endereço Completo** - Rua, número, complemento
- **Telefone** - Formato: (XX) XXXXX-XXXX
- **Email** - Para contato institucional

#### Dados do Parlamentar
- **Nome do Parlamentar** (obrigatório) - Nome completo
- **Cargo** - Ex: Vereador, Deputado

#### Cores Personalizadas
- **Cor Principal** - Cor padrão do sistema (padrão: Teal #14b8a6)
- **Cor Secundária** - Cor secundária (padrão: Dark Teal #0d9488)
- Seletor de cores visual incluído

### 2. WhatsApp Business

#### Status de Configuração
- **Status da Configuração**: Configurado/Não configurado
- **Status da Conexão**: Conectado/Desconectado
- **Última Atualização**: Timestamp do último acesso

#### Credenciais
- **Phone Number ID** (obrigatório)
  - Encontre em: App → WhatsApp → API Setup
  - Identificador único do número de telefone

- **Access Token** (obrigatório)
  - Token permanente (24h) ou temporário
  - Copie com cuidado de: App → WhatsApp → Generate Token

#### Ações
- **Salvar Configuração**: Persiste Phone Number ID e Access Token
- **Enviar Mensagem de Teste**: Valida a configuração
  - Requer número com DDD (ex: 5591988889999)
  - Envia mensagem de teste para validar acesso
- **Verificar Status**: Atualiza status de conexão

## Armazenamento

### Arquivo de Configuração
- **Localização**: `public/sistema-config.json`
- **Formato**: JSON
- **Persistência**: Automática via API

### Estrutura do JSON
```json
{
  "nomeOrgao": "Câmara Municipal",
  "sigla": "CM",
  "logo": null,
  "cnpj": "00.000.000/0000-00",
  "endereco": "Rua principal, 123",
  "telefone": "(85) 3000-0000",
  "email": "contato@camara.com.br",
  "website": "https://camara.com.br",
  "cargo": "Vereador",
  "nomeParlamentar": "João Silva",
  "corPrincipal": "#14b8a6",
  "corSecundaria": "#0d9488",
  "whatsapp": {
    "phoneNumberId": "seu_phone_id",
    "accessToken": "seu_access_token",
    "updatedAt": "2025-11-24T10:30:00.000Z"
  },
  "updatedAt": "2025-11-24T10:30:00.000Z"
}
```

## API Endpoints

### GET `/api/configuracoes`
Recupera todas as configurações salvass

**Response:**
```json
{
  "success": true,
  "data": {
    "nomeOrgao": "...",
    "whatsapp": {...}
  }
}
```

### POST `/api/configuracoes`
Salva configurações

**Request:**
```json
{
  "tipo": "sistema" | "whatsapp",
  "dados": {...}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuração salva com sucesso",
  "data": {...}
}
```

## Como Usar

### Configurar Dados da Instituição
1. Acesse **Configurações** no menu
2. Aba **Dados do Sistema**
3. Preencha os campos obrigatórios
4. Clique em **Salvar Configurações**

### Integrar WhatsApp Business
1. Acesse **Configurações** no menu
2. Aba **WhatsApp Business**
3. Visite [Meta for Developers](https://developers.facebook.com)
4. Copie Phone Number ID e Access Token
5. Cole nos campos da configuração
6. Clique em **Salvar Configuração**
7. (Opcional) Envie mensagem de teste

## Validações

- **Nome do Órgão**: Obrigatório
- **CNPJ**: Obrigatório (sem validação de formato)
- **Nome do Parlamentar**: Obrigatório
- **Phone Number ID**: Obrigatório para WhatsApp
- **Access Token**: Obrigatório para WhatsApp

## Mudanças Realizadas

### Consolidação de Interfaces
- ❌ Removida: `/configuracoes/whatsapp-business.js` (página separada)
- ✅ Adicionada: Nova aba no `/configuracoes/sistema.js`
- ✅ Migrada: Configuração de WhatsApp para área central

### Menu
- ❌ Removido: "Config. WhatsApp" do menu de Usuários
- ✅ Adicionado: Menu "Configurações" no menu principal
- ✅ Submenu: "Dados do Sistema" + "WhatsApp Business"

### Armazenamento
- ✅ Criado: Endpoint API `/api/configuracoes`
- ✅ Implementado: Persistência em arquivo JSON
- ✅ Migrado: Dados de localStorage para API

## Próximos Passos

1. **Integração com Relatórios**
   - Usar logo e dados da instituição em PDF
   - Usar cores personalizadas em cabeçalhos

2. **Configuração de Branding**
   - Assinatura automática em emails
   - Temas personalizados baseado em cores

3. **Webhooks**
   - URL de produção para WhatsApp
   - Validação de webhook do Meta

4. **Backup e Exportação**
   - Exportar configurações
   - Importar configurações

## Troubleshooting

### "Erro ao processar configuração"
- Verifique se o servidor está rodando
- Limpe o cache do navegador
- Verifique permissões de escrita em `public/`

### WhatsApp não envia mensagem de teste
- Valide Phone Number ID e Access Token
- Numero deve ter formato: 5591988889999
- Verifique se credenciais estão corretas no Meta

### Configurações não salvam
- Verifique se há espaço em disco
- Valide permissões da pasta `public/`
- Consulte logs do servidor

