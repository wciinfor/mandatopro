# Simplificação da Tabela de Funcionários

## Visão Geral

Funcionários agora seguem o mesmo modelo de **Lideranças**: um eleitor com um rótulo.

Isso significa que:
- ✅ **Todos os dados pessoais** estão em `eleitores`
- ✅ **Todos os dados de endereço** estão em `eleitores`
- ✅ **Foto e contato** estão em `eleitores`
- ❌ **Não duplicamos** esses dados na tabela `funcionarios`

## Nova Estrutura

A tabela `funcionarios` agora terá APENAS campos específicos:

```sql
-- Coluna para vincular ao eleitor
eleitor_id UUID NOT NULL (FOREIGN KEY para eleitores)

-- Dados profissionais (específicos de funcionário)
cargo VARCHAR(100)
departamento VARCHAR(100)
data_admissao DATE
salario NUMERIC(12,2)
carga_horaria INTEGER
tipo_contrato VARCHAR(50) -- CLT, PJ, TEMPORARIO, ESTAGIARIO
matricula VARCHAR(50) UNIQUE

-- Status
status VARCHAR(20) DEFAULT 'ATIVO' -- ATIVO, INATIVO, AFASTADO

-- Auditoria
observacoes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

## Colunas a Remover

As seguintes colunas redundantes devem ser REMOVIDAS:

```
❌ nome (use eleitor.nome)
❌ cpf (use eleitor.cpf)
❌ rg, rg_orgao_emissor
❌ data_nascimento
❌ sexo
❌ estado_civil
❌ nome_pai, nome_mae
❌ naturalidade
❌ email (use eleitor.email)
❌ telefone, celular (use eleitor.telefone)
❌ cep, logradouro, numero, complemento, bairro, cidade, uf
❌ pis, ctps
❌ banco, agencia, conta, tipo_conta, pix
❌ foto, foto_url
❌ Qualquer outra coluna que duplicar dados do eleitor
```

## Script de Migração

Execute este SQL no Supabase Dashboard:

### 1️⃣ Criar tabela temporária com dados importantes

```sql
-- Backup dos dados atuais
CREATE TABLE funcionarios_backup AS
SELECT * FROM funcionarios;

-- Você pode usar isso para recuperar dados se necessário
-- Depois de validar, execute: DROP TABLE funcionarios_backup;
```

### 2️⃣ Adicionar coluna eleitor_id (se não existir)

```sql
ALTER TABLE funcionarios
ADD COLUMN eleitor_id UUID REFERENCES eleitores(id) ON DELETE CASCADE;

-- Preencher eleitor_id baseado no CPF (se data existir em eleitores)
UPDATE funcionarios f
SET eleitor_id = (
  SELECT id FROM eleitores e 
  WHERE e.cpf = f.cpf 
  LIMIT 1
)
WHERE eleitor_id IS NULL;

-- Tornar obrigatório
ALTER TABLE funcionarios
ALTER COLUMN eleitor_id SET NOT NULL;
```

### 3️⃣ Remover colunas redundantes

```sql
-- Remover colunas de dados pessoais (redundantes com eleitor)
ALTER TABLE funcionarios
DROP COLUMN IF EXISTS nome,
DROP COLUMN IF EXISTS cpf,
DROP COLUMN IF EXISTS rg,
DROP COLUMN IF EXISTS rg_orgao_emissor,
DROP COLUMN IF EXISTS data_nascimento,
DROP COLUMN IF EXISTS sexo,
DROP COLUMN IF EXISTS estado_civil,
DROP COLUMN IF EXISTS nome_pai,
DROP COLUMN IF EXISTS nome_mae,
DROP COLUMN IF EXISTS naturalidade,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS telefone,
DROP COLUMN IF EXISTS celular,
DROP COLUMN IF EXISTS cep,
DROP COLUMN IF EXISTS logradouro,
DROP COLUMN IF EXISTS numero,
DROP COLUMN IF EXISTS complemento,
DROP COLUMN IF EXISTS bairro,
DROP COLUMN IF EXISTS cidade,
DROP COLUMN IF EXISTS uf,
DROP COLUMN IF EXISTS pis,
DROP COLUMN IF EXISTS ctps,
DROP COLUMN IF EXISTS banco,
DROP COLUMN IF EXISTS agencia,
DROP COLUMN IF EXISTS conta,
DROP COLUMN IF EXISTS tipo_conta,
DROP COLUMN IF EXISTS pix,
DROP COLUMN IF EXISTS foto,
DROP COLUMN IF EXISTS foto_url,
DROP COLUMN IF EXISTS imagem,
DROP COLUMN IF EXISTS avatar;
```

### 4️⃣ Garantir índices e constraints

```sql
-- Índice em eleitor_id para melhor performance
CREATE INDEX idx_funcionarios_eleitor_id 
ON funcionarios(eleitor_id);

-- Índice em matricula para busca rápida
CREATE UNIQUE INDEX idx_funcionarios_matricula 
ON funcionarios(matricula) WHERE matricula IS NOT NULL;

-- Índice em status para filtros
CREATE INDEX idx_funcionarios_status 
ON funcionarios(status);
```

## Frontend - O que Mudou

✅ **Formulário "novo.js"**: Busca o eleitor, preenche dados automaticamente (read-only)
✅ **Formulário "[id].js"**: Mostra dados do eleitor (read-only), edita apenas dados profissionais
✅ **Listagem**: Continua mostrando informações do eleitor (via JOIN)

## Como Usar

### Cadastrar novo funcionário:
1. Acessar `/cadastros/funcionarios/novo`
2. Buscar eleitor por nome ou CPF
3. Selecionar eleitor
4. Preencher dados profissionais (cargo, departamento, etc)
5. Salvar

### Editar funcionário:
1. Ir à listagem de funcionários
2. Clicar em editar
3. Dados do eleitor são somente leitura
4. Editar apenas dados profissionais
5. Salvar

## Validação Pós-Migração

Execute esta query para validar:

```sql
-- Verificar se todos têm eleitor_id válido
SELECT COUNT(*) as funcionarios_sem_eleitor_id
FROM funcionarios
WHERE eleitor_id IS NULL;

-- Resultado esperado: 0

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'funcionarios'
ORDER BY ordinal_position;
```

## Checklist

- [ ] Backup atual feito (`funcionarios_backup`)
- [ ] `eleitor_id` adicionado e preenchido
- [ ] Colunas redundantes removidas
- [ ] Índices criados
- [ ] Teste de query funcionando
- [ ] Delete `funcionarios_backup` após confirmar
- [ ] Atualizar migração de dados em produção

## Próximos Passos

1. ✅ Frontend simplificado (FEITO)
2. ⏳ Executar SQL no Supabase Dashboard
3. ⏳ Validar dados após migração
4. ⏳ Testar fluxo completo de cadastro/edição
5. ⏳ Deletar backup se tudo OK
