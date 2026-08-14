import { logger } from '@/lib/utils/logger';

export async function sendEngagementEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Coach Cass AI <coach@wantedwoman.com>', to, subject, text: body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error(`sendEngagementEmail: Resend returned ${res.status}`, detail);
      return false;
    }
    logger.info(`sendEngagementEmail: sent to ${to} (${subject})`);
    return true;
  } catch (err) {
    logger.error('sendEngagementEmail: fetch failed', err);
    return false;
  }
}
