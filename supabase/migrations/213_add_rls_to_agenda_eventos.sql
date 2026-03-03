-- Enable RLS on agenda_eventos table
ALTER TABLE agenda_eventos ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT - Allow authenticated users to read all agenda_eventos
CREATE POLICY "authenticated_select_agenda_eventos" ON agenda_eventos
FOR SELECT
TO authenticated
USING (true);

-- Policy for INSERT - Allow authenticated users to create agenda_eventos
CREATE POLICY "authenticated_insert_agenda_eventos" ON agenda_eventos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for UPDATE - Allow authenticated users to update agenda_eventos
CREATE POLICY "authenticated_update_agenda_eventos" ON agenda_eventos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy for DELETE - Allow authenticated users to delete agenda_eventos
CREATE POLICY "authenticated_delete_agenda_eventos" ON agenda_eventos
FOR DELETE
TO authenticated
USING (true);
