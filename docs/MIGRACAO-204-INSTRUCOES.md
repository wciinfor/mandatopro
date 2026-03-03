# 🔧 INSTRUÇÕES PARA APLICAR MIGRAÇÃO 204

## Problema Identificado
A tabela `atendimentos` não possui a coluna `campanha_id`, que é necessária para vincular atendimentos a campanhas.

## Status Atual
✅ Servidor está rodando (atendimentos sem link a campanhas temporariamente)  
⏳ Falta: Adicionar coluna `campanha_id` ao banco de dados

## Passo 1: Abrir SQL Editor no Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: `fhilsuwlllrnfpebtjvx`
3. Clique em: **SQL Editor** (esquerda)
4. Clique em: **New Query**

## Passo 2: Copiar e Executar SQL

Copie o comando abaixo e cole no SQL Editor:

```sql
-- Adição de coluna campanha_id à tabela atendimentos
ALTER TABLE atendimentos
ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id) ON DELETE SET NULL;

-- Índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_atendimentos_campanha_id 
  ON atendimentos(campanha_id);
```

5. Clique em: **Run** (ou pressione `Ctrl+Enter`)

## Passo 3: Verificar Sucesso

Se aparecer ✅ sem erros, a migração foi aplicada com sucesso!

## Passo 4: Atualizar Código do API

No arquivo `src/pages/api/cadastros/atendimentos/index.js`, descomente a linha:

```javascript
// Linha ~150 - Descomente:
campanha_id: campanhaId || null
```

Mude para:
```javascript
campanha_id: campanhaId || null
```

## Passo 5: Reiniciar Servidor

```bash
npm run dev
```

## Resultado Final
✅ Atendimentos poderão ser vinculados a campanhas  
✅ Listagem mostrará serviços da campanha associada  
✅ Sistema funcionará 100%

---

**Tempo estimado:** 2-3 minutos  
**Urgência:** Média (funciona sem, mas com limitações)
