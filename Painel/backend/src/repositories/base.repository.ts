import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase';

// ──────────────────────────────────────────────────────────────
// REPOSITÓRIO BASE — PADRÃO DE ACESSO A DADOS
//
// Todos os repositórios de domínio estendem esta classe.
// Garante:
//   • workspace_id obrigatório em todas as queries (isolamento multi-tenant)
//   • paginação padronizada
//   • soft delete e hard delete
//
// Uso:
//   class InstanceRepository extends BaseRepository<Instance> {
//     protected readonly tableName = 'instances';
//   }
// ──────────────────────────────────────────────────────────────

export interface FindAllOptions {
  limit?:      number;
  offset?:     number;
  orderBy?:    string;
  ascending?:  boolean;
  filters?:    Record<string, unknown>;
}

export abstract class BaseRepository<T extends { id?: string }> {
  protected readonly db: SupabaseClient;
  protected abstract readonly tableName: string;

  constructor(db: SupabaseClient = supabaseAdmin) {
    this.db = db;
  }

  protected query() {
    return this.db.from(this.tableName);
  }

  async findById(id: string, workspaceId: string): Promise<T | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) throw error;
    return data as T | null;
  }

  async findAll(
    workspaceId: string,
    options: FindAllOptions = {},
  ): Promise<{ data: T[]; count: number }> {
    const limit  = Math.min(options.limit ?? 20, 100);
    const offset = options.offset ?? 0;

    let q = this.query()
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(options.orderBy ?? 'created_at', { ascending: options.ascending ?? false })
      .range(offset, offset + limit - 1);

    // Filtros adicionais tipados
    if (options.filters) {
      for (const [col, val] of Object.entries(options.filters)) {
        if (val !== undefined && val !== null) {
          q = q.eq(col, val as string);
        }
      }
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return { data: (data ?? []) as T[], count: count ?? 0 };
  }

  async insert(payload: Omit<Partial<T>, 'id'>): Promise<T> {
    const { data, error } = await this.query()
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async update(id: string, workspaceId: string, payload: Partial<T>): Promise<T> {
    const { data, error } = await this.query()
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    const { error } = await this.query()
      .update({ is_active: false })
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }

  async hardDelete(id: string, workspaceId: string): Promise<void> {
    const { error } = await this.query()
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }
}
