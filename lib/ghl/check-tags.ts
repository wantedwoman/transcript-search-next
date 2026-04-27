/**
 * GHL Tag Checker — validates Suzy AI access by checking GHL contact tags.
 *
 * Instead of relying on webhooks to update Supabase on tag changes,
 * we check GHL directly at access time so the source of truth is always GHL.
 *
 * Access rules:
 *  - "Suzy AI Cancellation" tag → blocked (redirect to /payment-required)
 *  - "Suzy AI Subscriber" tag → allowed
 *  - Contact not found in GHL → allowed (not all users are in GHL yet)
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export interface GHLTagCheckResult {
  /** Whether the user should be granted access to /chat */
  hasAccess: boolean;
  /** Tags found on the GHL contact (empty if not found) */
  tags: string[];
  /** Why access was denied, if applicable */
  reason?: 'cancellation_tag' | 'no_subscriber_tag';
}

/**
 * Look up a contact in GHL by email and return their tags + access status.
 */
export async function checkGHLTags(email: string): Promise<GHLTagCheckResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    // Missing config — fail open so we don't lock everyone out
    console.warn('[GHL] Missing GHL_API_KEY or GHL_LOCATION_ID — allowing access');
    return { hasAccess: true, tags: [], reason: undefined };
  }

  try {
    const url = `${GHL_API_BASE}/v1/contacts/search?query=${encodeURIComponent(email)}&location_id=${locationId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: '2021-07-28',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`[GHL] API error ${res.status}: ${res.statusText}`);
      // Fail open on API errors — don't block users because GHL is down
      return { hasAccess: true, tags: [], reason: undefined };
    }

    const body = await res.json();

    // GHL search returns { contacts: [...] }
    const contacts = body.contacts ?? [];

    // Find exact email match (GHL search is fuzzy)
    const contact = contacts.find(
      (c: Record<string, unknown>) =>
        String(c.email ?? '').toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!contact) {
      // Not in GHL → allow (not all users are in GHL yet)
      return { hasAccess: true, tags: [], reason: undefined };
    }

    const tags: string[] = Array.isArray(contact.tags) ? contact.tags : [];

    // Cancellation tag = blocked
    if (tags.includes('Suzy AI Cancellation')) {
      return { hasAccess: false, tags, reason: 'cancellation_tag' };
    }

    // Subscriber tag = allowed
    if (tags.includes('Suzy AI Subscriber')) {
      return { hasAccess: true, tags, reason: undefined };
    }

    // Has a GHL contact but neither tag — allow for now
    // (Future: could restrict to only tagged subscribers)
    return { hasAccess: true, tags, reason: undefined };
  } catch (err) {
    console.error('[GHL] Error checking tags:', err);
    // Fail open on exceptions
    return { hasAccess: true, tags: [], reason: undefined };
  }
}