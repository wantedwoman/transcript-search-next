import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

export interface VaultEntry {
  id: string;
  user_id: string;
  content: string;
  user_tag: string;
  heartbeat_link: string | null;
  created_at: string;
}

export interface VaultEntryInput {
  content: string;
  user_tag?: string;
  heartbeat_link?: string;
}

const MAX_ENTRIES_PER_USER = 100;

/**
 * Save a new vault entry for a user.
 * Enforces the 100-entry limit per user.
 */
export async function saveVaultEntry(
  userId: string,
  input: VaultEntryInput
): Promise<VaultEntry> {
  const supabase = createServiceRoleClient();

  // Check entry count
  const { count, error: countError } = await supabase
    .from('vault_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    logger.error('Failed to count vault entries', countError);
    throw new Error('Failed to check vault entry limit');
  }

  if ((count ?? 0) >= MAX_ENTRIES_PER_USER) {
    throw new Error('Vault limit reached. Delete some entries to save new ones.');
  }

  const { data, error } = await supabase
    .from('vault_entries')
    .insert({
      user_id: userId,
      content: input.content,
      user_tag: input.user_tag || '',
      heartbeat_link: input.heartbeat_link || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to save vault entry', error);
    throw new Error('Failed to save vault entry');
  }

  return data as VaultEntry;
}

/**
 * List vault entries for a user, newest first.
 */
export async function listVaultEntries(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<VaultEntry[]> {
  const supabase = createServiceRoleClient();

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from('vault_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to list vault entries', error);
    throw new Error('Failed to list vault entries');
  }

  return (data || []) as VaultEntry[];
}

/**
 * Delete a vault entry. Only the owner can delete their own entries.
 */
export async function deleteVaultEntry(
  userId: string,
  entryId: string
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('vault_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to delete vault entry', error);
    throw new Error('Failed to delete vault entry');
  }

  return true;
}

/**
 * Search vault entries by tag or content substring.
 */
export async function searchVaultEntries(
  userId: string,
  query: string
): Promise<VaultEntry[]> {
  const supabase = createServiceRoleClient();

  // Search by user_tag or content containing the query
  const { data, error } = await supabase
    .from('vault_entries')
    .select('*')
    .eq('user_id', userId)
    .or(`user_tag.ilike.%${query}%,content.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to search vault entries', error);
    throw new Error('Failed to search vault entries');
  }

  return (data || []) as VaultEntry[];
}

/**
 * Get the count of vault entries for a user.
 */
export async function getVaultEntryCount(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();

  const { count, error } = await supabase
    .from('vault_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to count vault entries', error);
    return 0;
  }

  return count ?? 0;
}