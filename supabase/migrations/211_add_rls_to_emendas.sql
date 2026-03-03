-- Enable RLS on emendas table
ALTER TABLE emendas ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT - Allow authenticated users to read all emendas
CREATE POLICY "authenticated_select_emendas" ON emendas
FOR SELECT
TO authenticated
USING (true);

-- Policy for INSERT - Allow authenticated users to create new emendas
CREATE POLICY "authenticated_insert_emendas" ON emendas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for UPDATE - Allow authenticated users to update emendas
CREATE POLICY "authenticated_update_emendas" ON emendas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy for DELETE - Allow authenticated users to delete emendas
CREATE POLICY "authenticated_delete_emendas" ON emendas
FOR DELETE
TO authenticated
USING (true);
