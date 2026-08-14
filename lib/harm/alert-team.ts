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

export type HarmSeverity = 'critical';

/**
 * Patterns indicating the member is at immediate risk of self-harm / suicide.
 * Matching any of these → severity 'critical'.
 *
 * Progressive verb forms (`cutting|hurting|killing myself`) are included so
 * ongoing harm ("I keep cutting myself") is caught, not just the simple form.
 */
const CRITICAL_SELF_HARM_PATTERNS = [
  /kill myself/i,
  /want to die/i,
  /end my life/i,
  /hurt myself/i,
  /cut myself/i,
  /cutting myself/i,
  /hurting myself/i,
  /killing myself/i,
  /self[- ]harm/i,
  /suicid(e|al)/i,
  /overdose/i,
  /how do i hurt myself/i,
  /how do i kill myself/i,
];

/**
 * Patterns indicating intent to harm others / violence.
 * Matching any of these → severity 'critical'.
 *
 * CC-09 cycle-3 F-5: the old set only matched generic pronouns
 * (`him|her|them|someone`), so "i want to hurt my husband" / "i want to kill my
 * boss" slipped through. Named-target patterns below pair an explicit intent
 * verb (`hurt`/`kill`/`make … suffer`) with an explicit relationship/identity
 * noun, so a named target fires while the negation guard still suppresses
 * "he would never hurt our kids". The noun list stays explicit on purpose — a
 * bare `hurt my <anything>` would FP on "i want to hurt my pride".
 */
const VIOLENCE_TARGET_NOUNS =
  '(husband|wife|spouse|partner|boyfriend|girlfriend|' +
  'son|daughter|child|children|kid|kids|baby|' +
  'mother|father|mom|dad|parent|parents|brother|sister|family|' +
  'coworker|co-?worker|boss|manager|colleague|neighbor|' +
  'ex[- ]?(boyfriend|girlfriend|husband|wife|partner))';

/** intent-verb + optional possessive + explicit target noun, word-bounded. */
function namedTargetViolencePattern(intent: 'hurt' | 'kill'): RegExp {
  return new RegExp(`${intent} (my |our )?${VIOLENCE_TARGET_NOUNS}\\b`, 'i');
}

const CRITICAL_VIOLENCE_PATTERNS = [
  /hurt (him|her|them|someone)/i,
  /kill (him|her|them|someone)/i,
  /how do i hurt (him|her|them|someone)/i,
  /make (him|her|them|someone) suffer/i,
  /violent revenge/i,
  /plan to hurt/i,
  /plan to kill/i,
  // Named-target violence (CC-09 cycle-3 F-5).
  namedTargetViolencePattern('hurt'),
  namedTargetViolencePattern('kill'),
  new RegExp(`make (my |our )?${VIOLENCE_TARGET_NOUNS} suffer`, 'i'),
  new RegExp(`how do i (hurt|kill) (my |our )?${VIOLENCE_TARGET_NOUNS}\\b`, 'i'),
];

/**
 * Full harm trigger set (self-harm + violence).
 * NOTE — every detection helper below runs matches through the negation-aware
 * `patternMatches` guard, so these raw patterns are never tested directly.
 */
export const HARM_PATTERNS = [
  ...CRITICAL_SELF_HARM_PATTERNS,
  ...CRITICAL_VIOLENCE_PATTERNS,
];

/**
 * Negation-aware guard (CC-09 precision fix).
 *
 * A bare substring match like `/want to die/` also fires inside a clear
 * negation ("I dont want to die, I just feel lost") and `/hurt (him|...)`
 * fires inside "I dont want to hurt him, I love him". We suppress a match only
 * when the nearest preceding negation clearly targets the self-harm clause:
 * every word between the negation and the match must be a benign framing word
 * ("want to", "going to", "ever", "desire to", "thinking about", ...).
 * Anything else — a second clause, "stop cutting myself", "know why I want to
 * die" — leaves the alert firing, so real risk is never silently dropped.
 *
 * Ambivalent nested desire is preserved: "sometimes I don't want to want to
 * die" still fires because the clause contains two "want to" framings, meaning
 * the negation targets the outer desire, not the suicidal thought itself.
 *
 * The framing vocabulary (CC-09 cycle-3 negation fix) is deliberately kept to
 * words that appear in a clear denial of self-harm intent — "no desire to",
 * "no intention of", "no plans to", "would never consider", "not thinking
 * about", "never had thoughts of" — plus the small function words those
 * phrasings carry ("of", "about", "a", "have"). A phrase whose negated clause
 * contains a non-benign word ("stop", "know", "why", "but", "keep", ...) is
 * not a clean denial and keeps the alert firing.
 */
const NEGATION_RE =
  /\b(?:not|n't|never|no longer|no|won't|wont|wouldn't|wouldnt|shouldn't|shouldnt|can't|cant|cannot|don't|dont|doesn't|doesnt|didn't|didnt|haven't|havent|hasn't|hasnt|isn't|isnt|wasn't|wasnt|weren't|werent|ain't|aint)\b/i;

const BENIGN_FRAMING_WORDS = new Set([
  'to',
  'want',
  'wanted',
  'wanting',
  'go',
  'going',
  'will',
  'would',
  'ever',
  'really',
  'just',
  'even',
  'simply',
  'actually',
  'truly',
  'possibly',
  'probably',
  'maybe',
  'at',
  'all',
  'anymore',
  'again',
  'longer',
  'right',
  'now',
  'today',
  'tonight',
  // Clear-denial vocabulary (CC-09 cycle-3 negation fix): common self-harm
  // denials frame the negated clause with intent/desire nouns, the gerund
  // "thinking about", or the past "had/have", so those words must be treated
  // as benign framing for the guard to suppress them.
  'a',
  'about',
  'an',
  'any',
  'consider',
  'considered',
  'desire',
  'desires',
  'had',
  'have',
  'intend',
  'intention',
  'intentions',
  'of',
  'plan',
  'plans',
  'thinking',
  'thought',
  'thoughts',
]);

const NEGATION_WINDOW_CHARS = 120;

/**
 * True when the match at `matchIndex` sits inside a clearly-negated clause.
 *
 * Two windows are inspected:
 *  - words strictly between the negation and the match START must all be benign
 *    framing words ("want to", "going to", ...), else the negation does not
 *    clearly target this clause and the alert keeps firing;
 *  - desire framings are counted through the match END, so nested
 *    "I don't want to want to die" (whose `/want to die/` match begins at the
 *    SECOND "want") is detected as ambivalent genuine risk and kept firing.
 */
function isNegatedMatch(query: string, matchIndex: number, matchText: string): boolean {
  const matchEnd = matchIndex + matchText.length;
  const windowStart = Math.max(0, matchIndex - NEGATION_WINDOW_CHARS);

  const tokenize = (text: string) => text.toLowerCase().split(/[^a-z']+/).filter(Boolean);

  const beforeMatch = tokenize(query.slice(windowStart, matchIndex));

  let negIdx = -1;
  for (let i = 0; i < beforeMatch.length; i++) {
    if (NEGATION_RE.test(beforeMatch[i])) negIdx = i;
  }
  if (negIdx === -1) return false;

  // "not just X" hedge — "I'm not just thinking about killing myself, I
  // actually plan to do it" is an escalation, not a denial. When the token
  // right after the negation is a hedge intensifier the negation is targeting
  // the intensity ("not ONLY X"), so the self-harm clause is not clearly
  // negated and the alert keeps firing.
  if (beforeMatch[negIdx + 1] === 'just' || beforeMatch[negIdx + 1] === 'simply') {
    return false;
  }

  // Framing check — every word between the negation and the match must be
  // benign framing (e.g. "don't want to die", "not going to hurt myself").
  const between = beforeMatch.slice(negIdx + 1);
  if (between.some((word) => !BENIGN_FRAMING_WORDS.has(word))) return false;

  // Nesting check — count "want"-framings through the end of the matched
  // phrase. 0 or 1 → direct negation; 2+ ("want to want to die") → ambivalent.
  const throughMatch = tokenize(query.slice(windowStart, matchEnd)).slice(negIdx + 1);
  const wants = throughMatch.filter(
    (w) => w === 'want' || w === 'wanted' || w === 'wanting'
  ).length;

  return wants < 2;
}

/**
 * True when `pattern` matches `query` at least once OUTSIDE a negated clause.
 * All pattern matching goes through this helper so the negation guard applies
 * uniformly to self-harm and violence patterns.
 */
function patternMatches(query: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const re = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    if (!isNegatedMatch(query, match.index, match[0])) return true;
    // Defensive zero-width guard (none of the patterns are zero-width today).
    if (re.lastIndex === match.index) re.lastIndex += 1;
  }
  return false;
}

export function isHarmRiskQuery(query: string): boolean {
  return HARM_PATTERNS.some((pattern) => patternMatches(query, pattern));
}

/** Returns the source string of the first (non-negated) pattern that matched, or null. */
export function findMatchedHarmPattern(query: string): string | null {
  for (const pattern of HARM_PATTERNS) {
    if (patternMatches(query, pattern)) return pattern.source;
  }
  return null;
}

/** Cap for the stored snippet — bounded so the row never stores the full message / extra PII. */
const SNIPPET_MAX_LENGTH = 200;

/** Chars of leading context to keep before the matched harm phrase so the snippet reads naturally. */
const SNIPPET_CONTEXT_BEFORE = 80;

/**
 * Build a capped message snippet that is guaranteed to contain the matched harm
 * language.
 *
 * The original implementation (`query.trim().slice(-200)`) kept only the LAST
 * 200 chars, so a message whose harm phrase sat near the START lost the exact
 * harm language from the alert row and the team email (CC-09 data-integrity
 * finding). We now anchor the window at the first harm-pattern match and keep a
 * little leading context, so the exact phrase is preserved while the snippet is
 * still capped at 200 chars.
 */
export function buildMessageSnippet(query: string): string {
  const text = query.trim();
  const matchIndex = findFirstHarmMatchIndex(text);
  if (matchIndex === -1) {
    // No harm pattern present (defensive) — keep the first 200 chars.
    return text.slice(0, SNIPPET_MAX_LENGTH);
  }
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_BEFORE);
  return text.slice(start, start + SNIPPET_MAX_LENGTH);
}

/** Index of the first harm-pattern match in `text`, or -1 when none match. */
function findFirstHarmMatchIndex(text: string): number {
  let firstIndex = -1;
  for (const pattern of HARM_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match.index >= 0 && (firstIndex === -1 || match.index < firstIndex)) {
      firstIndex = match.index;
    }
  }
  return firstIndex;
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
 * The member's crisis reply NEVER waits on the team email: the send is
 * fire-and-forget (not awaited) so a slow/hanging email provider cannot delay
 * the SB 243 reply. sendHarmAlertEmail is itself timeout-bounded
 * (AbortSignal.timeout(5000)) and never throws; the .catch below is a
 * defensive guard only. Never throws — a harm alert must not break the chat
 * response. Failures are logged so the safety reply still reaches the member.
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
  // Keep the matched harm phrase in the snippet (CC-09 data-integrity), capped at 200 chars.
  const messageSnippet = buildMessageSnippet(query);
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

  // Team notification — FIRE-AND-FORGET (CC-09 cycle-3 F-4): the email must not
  // block the member's crisis reply. Not awaited. sendHarmAlertEmail keeps its
  // AbortSignal.timeout(5000) + try/catch + never-throw guarantees internally;
  // the .catch here is only a defensive guard against an unexpected rejection.
  sendHarmAlertEmail({
    memberEmail: userEmail || 'unknown@member',
    alertId,
    timestamp,
    messageSnippet,
    matchedPattern,
    severity: resolvedSeverity,
  }).catch((err) => {
    logger.error('sendHarmAlertEmail failed', err);
  });

  return { reply, alertId };
}
