import { createServiceRoleClient } from '@/lib/auth/auto-provision';
import { logger } from '@/lib/utils/logger';

/**
 * CC-09 · Harm alerts to team + 988 referral
 *
 * Centralizes harm-language detection, severity classification, the SB 243
 * safety reply (988 + 911 referral), the harm_alerts DB write, and the
 * team-notification path.
 */

export type HarmSeverity = 'critical';

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
 * Every pattern in HARM_PATTERNS is imminent-risk (self-harm / suicide /
 * violence toward others), so every harm alert classifies as 'critical'.
 * There is no non-imminent 'high' tier in the current detection set.
 */
export function classifyHarmSeverity(_query: string): HarmSeverity {
  return 'critical';
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

/**
 * Team email notification for a new critical/high harm alert.
 *
 * NOTE — email integration is a TODO:
 * There is no verified free-tier email provider configured yet, so for now we
 * log the FULL alert data to the server console (Vercel logs) and do not make
 * an external call. Swap in a real provider (e.g. Resend) by replacing the
 * console.log below with a fetch() POST, e.g.:
 *
 *   const res = await fetch('https://api.resend.com/emails', {
 *     method: 'POST',
 *     headers: {
 *       Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
 *       'Content-Type': 'application/json',
 *     },
 *     body: JSON.stringify({
 *       from: 'safety@coachcass.app',
 *       to: TEAM_EMAILS,
 *       subject: 'HARM ALERT — Coach Cass member in crisis',
 *       text: buildAlertEmailBody(alert),
 *     }),
 *   });
 *
 * Subject must remain: "HARM ALERT — Coach Cass member in crisis"
 */
export async function sendHarmAlertEmail(alert: HarmAlertNotification): Promise<void> {
  const payload = {
    subject: 'HARM ALERT — Coach Cass member in crisis',
    memberEmail: alert.memberEmail,
    timestamp: alert.timestamp,
    severity: alert.severity,
    exactSnippet: alert.messageSnippet,
    matchedPattern: alert.matchedPattern,
    alertId: alert.alertId || null,
    instructions: 'CONTACT AUTHORITIES IF IMMINENT',
  };

  // TODO(email): replace this log with a real email send (see doc comment above).
  console.log('[HARM-ALERT-TEAM]', JSON.stringify(payload, null, 2));
}

/**
 * Handle a detected harm-risk message end-to-end:
 *  1. Build the SB 243 safety reply (returned to the member).
 *  2. Persist a harm_alerts row via the service-role client.
 *  3. Trigger the team notification (log-based until email is wired).
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

  // Team notification — log for now; email swap point lives in sendHarmAlertEmail.
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
