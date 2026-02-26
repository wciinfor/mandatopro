# ⚙️ Adicionar Coluna de Liderança em Eleitores

## 🎯 Objetivo
Marcar na tabela `eleitores` quais pessoas também são lideranças, para que o mapa mostre a cor correta (roxo para lideranças, azul para eleitores).

## Passo a Passo (2 minutos)

### 1️⃣ Abrir SQL Editor do Supabase
- Vá para: https://supabase.com/dashboard
- Clique em seu projeto **MandatoPro**
- Clique em **SQL Editor** (no menu lateral)
- Clique em **Nova Query**

### 2️⃣ Copiar e Colar o SQL

```sql
-- Adicionar coluna para marcar se eleitor é liderança
ALTER TABLE eleitores
  ADD COLUMN IF NOT EXISTS e_lideranca BOOLEAN DEFAULT FALSE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_eleitores_e_lideranca ON eleitores(e_lideranca);

-- Marcar eleitores que já são lideranças
UPDATE eleitores
SET e_lideranca = TRUE
WHERE lideranca_id IS NOT NULL;
```

### 3️⃣ Executar a Query
- Cole o código acima na query
- Clique em **Executar** (ou aperte `Ctrl + Enter`)
- Aguarde 2-5 segundos

### 4️⃣ Pronto! ✅

Agora a coluna `e_lideranca` está adicionada e todos os eleitores que já são lideranças foram marcados automaticamente.

---

## 📍 Como Funciona no Mapa

Quando você sincronizar o mapa:

| Status | Cor | Ícone |
|--------|-----|-------|
| Eleitor (e_lideranca = FALSE) | 🔵 Azul | Pino normal |
| Eleitor que é Liderança (e_lideranca = TRUE) | 🟣 Roxo | Pino roxa |
| Inativo | ⚫ Cinza | Pino cinza |

---

## 🧪 Testar

1. Vá para: http://localhost:3000/geolocalizacao
2. Clique em **Sincronizar**
3. Veja Jorge da Silva Souza da Cunha aparecer com a cor **roxo** 🟣

---

## 💡 Entendendo a Lógica

- Uma **liderança** não é uma pessoa diferente, é um **rótulo** dado a um eleitor
- A pessoa continua sendo um eleitor (com latitude/longitude)
- Adicionamos apenas uma coluna booleana `e_lideranca` para marcar isso
- Muito mais simples e sem duplicação de dados!

