-- Enable RLS on financeiro_parceiros
ALTER TABLE financeiro_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_financeiro_parceiros" ON financeiro_parceiros
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_financeiro_parceiros" ON financeiro_parceiros
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_financeiro_parceiros" ON financeiro_parceiros
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_financeiro_parceiros" ON financeiro_parceiros
FOR DELETE
TO authenticated
USING (true);

-- Enable RLS on financeiro_lancamentos
ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_financeiro_lancamentos" ON financeiro_lancamentos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_financeiro_lancamentos" ON financeiro_lancamentos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_financeiro_lancamentos" ON financeiro_lancamentos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_financeiro_lancamentos" ON financeiro_lancamentos
FOR DELETE
TO authenticated
USING (true);

-- Enable RLS on financeiro_despesas
ALTER TABLE financeiro_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_financeiro_despesas" ON financeiro_despesas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_financeiro_despesas" ON financeiro_despesas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_financeiro_despesas" ON financeiro_despesas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_financeiro_despesas" ON financeiro_despesas
FOR DELETE
TO authenticated
USING (true);
