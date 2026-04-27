import { GHL_API_KEY, GHL_LOCATION_ID } from '../config/env';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export async function checkGhlTags(email: string): Promise<{ hasAccess: boolean; tags: string[] }> {
  try {
    // Search for contact by email using GHL contacts/search endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const searchRes = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        page: 1,
        pageLimit: 10,
        filters: [
          {
            field: 'email',
            operator: 'eq',
            value: email,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!searchRes.ok) {
      const errorText = await searchRes.text().catch(() => 'Unknown error');
      console.error('GHL search failed:', searchRes.status, errorText);
      // FAIL OPEN — allow access if GHL API fails
      return { hasAccess: true, tags: [] };
    }

    const data = await searchRes.json();
    const contacts = data?.contacts || [];

    if (!contacts.length) {
      // No contact found — FAIL OPEN (allow access for now, not everyone is in GHL yet)
      return { hasAccess: true, tags: [] };
    }

    const contact = contacts[0];
    const tags: string[] = (contact.tags || []).map((t: any) =>
      typeof t === 'string' ? t : t?.name || ''
    ).filter(Boolean);

    // ONLY block if they have the cancellation tag
    const hasCancellation = tags.some(t => t.toLowerCase() === 'suzy ai cancellation');
    const hasAccess = !hasCancellation;

    return { hasAccess, tags };
  } catch (err) {
    console.error('Error checking GHL tags:', err);
    // FAIL OPEN — allow access if GHL check fails
    return { hasAccess: true, tags: [] };
  }
}
