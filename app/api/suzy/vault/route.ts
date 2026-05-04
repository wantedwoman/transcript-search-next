import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  saveVaultEntry,
  listVaultEntries,
  deleteVaultEntry,
  searchVaultEntries,
  getVaultEntryCount,
} from '@/lib/vault/vault-engine';

/**
 * POST /api/suzy/vault
 * Save a new vault entry.
 * Body: { content: string, user_tag?: string, heartbeat_link?: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, user_tag, heartbeat_link } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Validate heartbeat_link domain — must be Heartbeat, never Vimeo
    if (heartbeat_link && typeof heartbeat_link === 'string') {
      const link = heartbeat_link.toLowerCase();
      if (link.includes('vimeo.com') || link.includes('vimeo')) {
        return NextResponse.json(
          { error: 'Only Heartbeat links (community.reallovenetwork.com) are allowed in vault entries.' },
          { status: 400 }
        );
      }
    }

    const entry = await saveVaultEntry(user.id, {
      content: content.trim(),
      user_tag: user_tag?.trim() || '',
      heartbeat_link: heartbeat_link?.trim() || undefined,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Vault limit reached')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error('POST /api/suzy/vault error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/suzy/vault
 * List vault entries. Supports ?search=query for searching.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('search')?.trim();
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let entries;
    if (searchQuery) {
      entries = await searchVaultEntries(user.id, searchQuery);
    } else {
      entries = await listVaultEntries(user.id, { limit, offset });
    }

    const count = await getVaultEntryCount(user.id);

    return NextResponse.json({ entries, count });
  } catch (error) {
    logger.error('GET /api/suzy/vault error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/suzy/vault
 * Delete a vault entry.
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Entry id is required' }, { status: 400 });
    }

    await deleteVaultEntry(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/suzy/vault error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}