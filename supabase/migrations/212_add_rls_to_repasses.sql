-- Enable RLS on repasses table
ALTER TABLE repasses ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT - Allow authenticated users to read all repasses
CREATE POLICY "authenticated_select_repasses" ON repasses
FOR SELECT
TO authenticated
USING (true);

-- Policy for INSERT - Allow authenticated users to create new repasses
CREATE POLICY "authenticated_insert_repasses" ON repasses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for UPDATE - Allow authenticated users to update repasses
CREATE POLICY "authenticated_update_repasses" ON repasses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy for DELETE - Allow authenticated users to delete repasses
CREATE POLICY "authenticated_delete_repasses" ON repasses
FOR DELETE
TO authenticated
USING (true);
