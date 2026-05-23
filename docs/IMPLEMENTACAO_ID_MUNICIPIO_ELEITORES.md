# 📋 Implementação: ID IBGE para Eleitores

## Resumo das Mudanças

Adicionado suporte ao código IBGE (ID do município) na tabela de eleitores. O campo `id_municipio` é preenchido **automaticamente** quando o usuário preenche o nome do município no formulário.

---

## 🔧 Mudanças Implementadas

### 1. **Migration SQL** (Banco de Dados)
📁 **Arquivo**: `supabase/migrations/222_add_id_municipio_to_eleitores.sql`

```sql
ALTER TABLE eleitores
ADD COLUMN IF NOT EXISTS id_municipio BIGINT;

CREATE INDEX IF NOT EXISTS idx_eleitores_id_municipio ON eleitores(id_municipio);
```

**O que faz**:
- Adiciona coluna `id_municipio` tipo BIGINT (para armazenar códigos IBGE)
- Cria índice para melhor performance nas buscas

---

### 2. **Utilitário de Municípios**
📁 **Arquivo**: `src/utils/municipiosIBGE.js` (CRIADO)

**Funções disponíveis**:
- `getMunicipioIBGEByName(nome, uf)` - Busca código IBGE pelo nome do município
- `getMunicipioNameByIBGE(codigoIBGE)` - Busca nome do município pelo código
- `getMunicipiosByUF(uf)` - Lista municípios de um estado
- `searchMunicipios(filtro)` - Busca aproximada de municípios

**Nota**: Contém lista de municípios principais, principalmente de Amazonas. Você pode expandir com mais municípios ou integrar com API de municípios brasileiros.

---

### 3. **Formulário de Cadastro de Eleitor**
📁 **Arquivo**: `src/pages/cadastros/eleitores/novo.js` (MODIFICADO)

**Alterações**:
- ✅ Adicionado import: `import { getMunicipioIBGEByName } from '@/utils/municipiosIBGE'`
- ✅ Campo `id_municipio` adicionado ao estado (formData)
- ✅ Lógica automática: quando `municipio` é preenchido, busca e preenche `id_municipio`
- ✅ Campo `id_municipio` renderizado como **DISABLED** (cinza)
- ✅ Campo incluído no payload de envio à API

**Novo campo** exibido no formulário:
```
┌─────────────────────┐
│ MUNICÍPIO           │ ← Input normal (editável)
│ Ex: Manaus          │
└─────────────────────┘
┌─────────────────────┐
│ ID MUNICÍPIO (IBGE) │ ← Input desativado (cinza)
│ 1302603             │ ← Preenchido automaticamente
│ Preenchido autom... │ ← Dica ao usuário
└─────────────────────┘
```

---

### 4. **Endpoint da API**
📁 **Arquivo**: `src/pages/api/cadastros/eleitores/index.js` (MODIFICADO)

**Alteração**:
- Adicionado `id_municipio` ao payload de criação:
```javascript
id_municipio: body.id_municipio ? parseInt(body.id_municipio) : null,
```

---

## 🚀 Passos para Aplicar

### 1️⃣ Executar Migration no Supabase

Abra: https://supabase.com/dashboard/project/zgfctbixiqnyxzkukpsu/sql/new

Cole e execute:
```sql
ALTER TABLE eleitores
ADD COLUMN IF NOT EXISTS id_municipio BIGINT;

CREATE INDEX IF NOT EXISTS idx_eleitores_id_municipio ON eleitores(id_municipio);
```

**Resultado esperado**: ✅ "Column added successfully" e "Index created successfully"

---

### 2️⃣ Atualizar Municipios (Opcional)

Se precisar de **mais municípios**, edite `src/utils/municipiosIBGE.js`:

```javascript
// Adicione no array MUNICIPIOS_IBGE
{ nome: 'Seu Município', uf: 'MG', ibge: '123456' },
```

---

### 3️⃣ Testar Localmente

```bash
npm run dev
```

Vá para: `http://localhost:3000/cadastros/eleitores/novo`

1. Preencha o campo **MUNICÍPIO** com "Manaus"
2. Veja o campo **ID MUNICÍPIO (IBGE)** ser preenchido automaticamente com `1302603`
3. Complete o formulário e clique em **Salvar**
4. Verifique se o eleitor foi criado com o `id_municipio` preenchido

---

### 4️⃣ Deploy em Produção

```bash
git add .
git commit -m "feat: adicionar id_municipio aos eleitores com preenchimento automático"
git push origin main
```

Vercel detectará as mudanças automatically. Aguarde o build completar.

---

## 📊 Exemplo de Uso

**Antes (sem id_municipio)**:
```javascript
{
  nome: "João da Silva",
  municipio: "Manaus",
  // id_municipio: null ❌
}
```

**Depois (com id_municipio)**:
```javascript
{
  nome: "João da Silva",
  municipio: "Manaus",
  id_municipio: 1302603 ✅
}
```

---

## 🔍 Como Funciona?

1. **Usuário digita** no campo "MUNICÍPIO"
   ```
   handleInputChange() é disparado
   ```

2. **Código verifica** se é o campo de município
   ```javascript
   if (name === 'municipio' && value.trim()) {
     const idMunicipio = getMunicipioIBGEByName(value, prev.uf);
     // ...
   }
   ```

3. **Busca o ID IBGE** na base de dados local
   ```javascript
   getMunicipioIBGEByName('Manaus', 'AM')
   // Retorna: '1302603'
   ```

4. **Preenche automaticamente** o campo disabled
   ```
   id_municipio = '1302603'
   ```

5. **Envia na requisição POST** com todos os dados
   ```javascript
   POST /api/cadastros/eleitores
   { municipio: "Manaus", id_municipio: 1302603, ... }
   ```

---

## 🛠️ Integração com API Externa (Opcional)

Se quiser usar uma **API de municípios brasileiros**, você pode integrar assim:

```javascript
// Em municipiosIBGE.js
export async function getMunicipioIBGEByNameAPI(nome, uf) {
  const response = await fetch(`https://api-de-municipios.com/search`, {
    params: { nome, uf }
  });
  const data = await response.json();
  return data.ibge;
}
```

Depois use em `novo.js`:
```javascript
const idMunicipio = await getMunicipioIBGEByNameAPI(value, prev.uf);
```

---

## ✅ Checklist Final

- [ ] Migration executada no Supabase
- [ ] Campo `id_municipio` visível e disabled no formulário
- [ ] Preenchimento automático funcionando localmente
- [ ] Eleitor salvo com `id_municipio` no banco
- [ ] Deploy em produção realizado
- [ ] Testado em produção (https://mandato-pro.vercel.app)

---

## 📞 Próximos Passos

1. **Expandir base de municípios**: Adicionar mais municípios em `municipiosIBGE.js`
2. **Filtro com autocomplete**: Criar dropdown com sugestões (opcional)
3. **Migrar dados históricos**: Script para preencher `id_municipio` em eleitores existentes (SQL):
   ```sql
   UPDATE eleitores SET id_municipio = 1302603 WHERE municipio = 'Manaus';
   ```

---

**Data**: 18/03/2026
**Sistema**: MandatoPro
**Status**: ✅ Implementado e pronto para deploy
