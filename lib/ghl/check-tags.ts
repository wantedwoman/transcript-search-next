import { env } from '../config/env';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export async function checkGhlTags(email: string): Promise<{ hasAccess: boolean; tags: string[] }> {
  try {
    const apiKey = env.GHL_API_KEY;
    const locationId = env.GHL_LOCATION_ID;

    if (!apiKey || !locationId) {
      console.warn('[GHL] Missing GHL_API_KEY or GHL_LOCATION_ID — denying access');
      return { hasAccess: false, tags: [] };
    }

    // Search for contact by email using GHL contacts/search endpoint
    const searchRes = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId,
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
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text().catch(() => 'Unknown error');
      console.error('GHL search failed:', searchRes.status, errorText);
      return { hasAccess: false, tags: [] };
    }

    const data = await searchRes.json();
    const contacts = data?.contacts || [];

    if (!contacts.length) {
      return { hasAccess: false, tags: [] };
    }

    const contact = contacts[0];
    const tags: string[] = (contact.tags || []).map((t: any) =>
      typeof t === 'string' ? t : t?.name || ''
    ).filter(Boolean);

    const hasAccess = tags.includes('Suzy AI Subscriber');

    return { hasAccess, tags };
  } catch (err) {
    console.error('Error checking GHL tags:', err);
    return { hasAccess: false, tags: [] };
  }
}