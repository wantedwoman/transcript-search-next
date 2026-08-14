/**
 * Canonical admin/team email recipients for Coach Cass.
 *
 * Single source of truth, reused by:
 *  - the admin-route allowlist (`app/api/admin/**`, `lib/supabase/middleware.ts`)
 *  - the CC-09 harm-alert team notification recipients (`lib/harm/alert-team.ts`)
 *
 * NOTE — only add here if the address is also trusted for admin access.
 */
export const ADMIN_EMAILS: string[] = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];
