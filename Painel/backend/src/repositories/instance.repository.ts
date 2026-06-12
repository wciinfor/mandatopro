import { BaseRepository } from './base.repository';
import { supabaseAdmin } from '../config/supabase';

// ──────────────────────────────────────────────────────────────
// REPOSITORY DE INSTÂNCIAS
// Exemplo de repository concreto com métodos de domínio.
// ──────────────────────────────────────────────────────────────

export interface Instance {
  id:            string;
  workspace_id:  string;
  name:          string;
  apikey:        string;
  provider:      string;
  status:        string;
  last_check?:   string;
  last_error?:   string;
  total_sent:    number;
  success_count: number;
  error_count:   number;
  metadata:      Record<string, unknown>;
  created_at:    string;
  updated_at:    string;
}

export class InstanceRepository extends BaseRepository<Instance> {
  protected readonly tableName = 'instances';

  async findByName(name: string, workspaceId: string): Promise<Instance | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('name', name)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data as Instance | null;
  }

  async updateStatus(
    id:          string,
    workspaceId: string,
    status:      string,
    lastError?:  string,
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from(this.tableName)
      .update({
        status,
        last_check: new Date().toISOString(),
        ...(lastError !== undefined && { last_error: lastError }),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }

  async findConnected(workspaceId: string): Promise<Instance[]> {
    const { data, error } = await this.query()
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');
    if (error) throw error;
    return (data ?? []) as Instance[];
  }
}

export const instanceRepository = new InstanceRepository();
