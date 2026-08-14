import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAILS } from '@/lib/config/admin';

/**
 * CC-09 · Harm alerts to team + 988 referral
 *
 * Centralizes harm-language detection, severity classification, the SB 243
 * safety reply (988 + 911 referral), the harm_alerts DB write, and the
 * team-notification path.
 */

export type HarmSeverity = 'high' | 'critical';

/**
 * Patterns indicating the member is at immediate risk of self-harm / suicide.
 * Matching any of these → severity 'critical'.
 */
const CRITICAL_SELF_HARM_PATTERNS = [
  /kill myself/i,
  /want to die/i,
  /end my life/i,
  /hurt myself/i,
  /self[- ]harm/i,
  /suicid(e|al)/i,
  /overdose/i,
  /cut myself/i,
  /how do i hurt myself/i,
  /how do i kill myself/i,
];

/**
 * Patterns indicating intent to harm others / violence.
 * Matching any of these → severity 'critical'.
 */
const CRITICAL_VIOLENCE_PATTERNS = [
  /hurt (him|her|them|someone)/i,
  /kill (him|her|them|someone)/i,
  /how do i hurt (him|her|them|someone)/i,
  /make (him|her|them|someone) suffer/i,
  /violent revenge/i,
  /plan to hurt/i,
  /plan to kill/i,
];

/** Full harm trigger set (kept in sync with the chat route's original list). */
export const HARM_PATTERNS = [
  ...CRITICAL_SELF_HARM_PATTERNS,
  ...CRITICAL_VIOLENCE_PATTERNS,
];

export function isHarmRiskQuery(query: string): boolean {
  return HARM_PATTERNS.some((pattern) => pattern.test(query));
}

/** Returns the source string of the first pattern that matched, or null. */
export function findMatchedHarmPattern(query: string): string | null {
  for (const pattern of HARM_PATTERNS) {
    if (pattern.test(query)) return pattern.source;
  }
  return null;
}

/**
 * Severity logic (CC-09 spec):
 * - self-harm / suicide match → 'critical'
 * - violence toward others match → 'critical'
 * - any other harm-language match → 'high'
 */
export function classifyHarmSeverity(query: string): HarmSeverity {
  const isCritical =
    CRITICAL_SELF_HARM_PATTERNS.some((pattern) => pattern.test(query)) ||
    CRITICAL_VIOLENCE_PATTERNS.some((pattern) => pattern.test(query));
  return isCritical ? 'critical' : 'high';
}

/**
 * SB 243-compliant safety reply. Warm Coach Cass voice, never clinical.
 * Includes 988 Suicide & Crisis Lifeline referral + 911 for imminent danger.
 */
export function harmSafetyReply(): string {
  return [
    "I'm really glad you said something. I hear how heavy this is right now.",
    "I can't help with anything that could put you or someone else in danger, but I do want to make sure you're supported.",
    "If you're in crisis right now, please reach out to the 988 Suicide & Crisis Lifeline — call or text 988, or chat at 988lifeline.org. They're available 24/7 and can help right now.",
    "You can also call or text 911 if you're in immediate danger.",
    "And please reach out to someone you trust — a friend, family member, or loved one — as soon as you can. You don't have to carry this alone.",
  ].join('\n\n');
}

export type HarmAlertNotification = {
  memberEmail: string;
  alertId?: string;
  timestamp: string;
  messageSnippet: string;
  matchedPattern: string;
  severity: HarmSeverity;
};

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_FROM = 'Coach Cass Safety <safety@coachcass.app>';
const HARM_ALERT_SUBJECT = 'HARM ALERT — Coach Cass member in crisis';
const EMAIL_SEND_TIMEOUT_MS = 5_000;

/**
 * Plain-text body of the CC-09 team alert email.
 *
 * The member's message is deliberately included here — the recipients are the
 * trusted ADMIN_EMAILS list, and the exact language is required for the team to
 * assess the situation. Do NOT log this text to the server console (PII); it is
 * only for the email sent to admins.
 */
export function buildAlertEmailBody(alert: HarmAlertNotification): string {
  return [
    'A Coach Cass member has expressed a possible harm risk and needs attention.',
    '',
    `Member email: ${alert.memberEmail}`,
    `Timestamp (UTC): ${alert.timestamp}`,
    `Severity: ${alert.severity.toUpperCase()}`,
    `Alert ID: ${alert.alertId || 'n/a'}`,
    `Matched pattern: ${alert.matchedPattern}`,
    '',
    'Exact member language:',
    alert.messageSnippet,
    '',
    'CONTACT AUTHORITIES IF IMMINENT',
  ].join('\n');
}

/**
 * Team email notification for a new critical/high harm alert.
 *
 * Sends a real email to ADMIN_EMAILS via the Resend HTTP API (free tier).
 *
 * Guarantees:
 *  - Timeout-bounded: the fetch aborts after EMAIL_SEND_TIMEOUT_MS so an email
 *    outage can delay the member's crisis reply by at most that window.
 *  - Never throws: failures are logged and swallowed — a harm alert must never
 *    break the member's chat reply.
 *  - No PII in logs: the member's message is only included in the email sent to
 *    the trusted admin recipients, never in server logs.
 *  - No hardcoded secret: the API key is read from RESEND_API_KEY (by name).
 *
 * If RESEND_API_KEY is not configured, the notification is skipped and the
 * outage is logged (without the member message) so operators can detect it.
 *
 * Subject must remain: "HARM ALERT — Coach Cass member in crisis"
 */
export async function sendHarmAlertEmail(alert: HarmAlertNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.error(
      `Harm alert email NOT sent — RESEND_API_KEY is not configured ` +
        `(alertId=${alert.alertId ?? 'n/a'}, severity=${alert.severity})`
    );
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: ADMIN_EMAILS,
        subject: HARM_ALERT_SUBJECT,
        text: buildAlertEmailBody(alert),
      }),
      signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error(
        `Harm alert email send failed ` +
          `(alertId=${alert.alertId ?? 'n/a'}, status=${res.status}): ${detail.slice(0, 200)}`
      );
    } else {
      logger.warn(
        `Harm alert email sent to ${ADMIN_EMAILS.length} admin(s) ` +
          `(alertId=${alert.alertId ?? 'n/a'}, severity=${alert.severity})`
      );
    }
  } catch (err) {
    // Timeout or network failure — never propagate. The alert is already
    // persisted in harm_alerts; this must not break the member's reply.
    logger.error(
      `Harm alert email send failed (alertId=${alert.alertId ?? 'n/a'}): ` +
        `${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Handle a detected harm-risk message end-to-end:
 *  1. Build the SB 243 safety reply (returned to the member).
 *  2. Persist a harm_alerts row via the service-role client.
 *  3. Email the team via ADMIN_EMAILS (see sendHarmAlertEmail).
 *
 * Never throws — a harm alert must not break the chat response. Failures are
 * logged so the safety reply still reaches the member.
 */
export async function handleHarmAlert(
  userId: string,
  query: string,
  matchedPattern: string,
  severity?: HarmSeverity,
  userEmail?: string
): Promise<{ reply: string; alertId?: string }> {
  const reply = harmSafetyReply();
  const resolvedSeverity: HarmSeverity = severity ?? classifyHarmSeverity(query);
  const messageSnippet = query.trim().slice(-200);
  const timestamp = new Date().toISOString();

  let alertId: string | undefined;

  if (userId) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from('harm_alerts')
        .insert({
          user_id: userId,
          message_snippet: messageSnippet,
          matched_pattern: matchedPattern,
          severity: resolvedSeverity,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to write harm_alerts row', error);
      } else {
        alertId = data?.id;
        logger.warn(`harm_alert written ${alertId} severity=${resolvedSeverity} user=${userId}`);
      }
    } catch (err) {
      logger.error('harm_alerts insert threw', err);
    }
  } else {
    logger.warn('No authenticated user — skipped harm_alerts write');
  }

  // Team notification — timeout-bounded and non-throwing; see sendHarmAlertEmail.
  try {
    await sendHarmAlertEmail({
      memberEmail: userEmail || 'unknown@member',
      alertId,
      timestamp,
      messageSnippet,
      matchedPattern,
      severity: resolvedSeverity,
    });
  } catch (err) {
    logger.error('sendHarmAlertEmail failed', err);
  }

  return { reply, alertId };
}
