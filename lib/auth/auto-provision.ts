import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY in server-side code that needs to write or read
 * across all tenants (webhooks, admin APIs, cron jobs).
 */
export function createServiceRoleClient() {
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Provisions a new user in Supabase Auth + user_profiles.
 * - Creates Auth user (if not exists) with a random password
 * - Inserts/updates user_profiles row with status='active'
 * - Returns the user id
 */
export async function provisionUser(email: string): Promise<{ userId: string; created: boolean }> {
  const supabase = createServiceRoleClient();

  // Check if user already exists in user_profiles
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('user_id, status')
    .eq('email', email)
    .single();

  if (existingProfile) {
    // User exists — if revoked, reactivate; if active, no-op
    if (existingProfile.status !== 'active') {
      await supabase
        .from('user_profiles')
        .update({ status: 'active', last_active: new Date().toISOString() })
        .eq('email', email);

      logger.info(`Reactivated existing user: ${email}`);
    } else {
      logger.info(`User already active, skipping: ${email}`);
    }
    return { userId: existingProfile.user_id, created: false };
  }

  // Check if Auth user exists but no profile (e.g., trigger didn't fire)
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    logger.error('Failed to list auth users', listError);
    throw new Error(`Failed to check auth users: ${listError.message}`);
  }

  const existingAuthUser = authUsers.users.find((u) => u.email === email);

  if (existingAuthUser) {
    // Auth user exists but no profile — create profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: existingAuthUser.id,
        email: email,
        status: 'active',
      });

    if (profileError) {
      logger.error('Failed to create user profile for existing auth user', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    logger.info(`Created profile for existing auth user: ${email}`);
    return { userId: existingAuthUser.id, created: true };
  }

  // Create new Auth user with random password
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: generateTempPassword(),
    email_confirm: true, // Auto-confirm email so user can log in immediately
  });

  if (createError) {
    logger.error('Failed to create auth user', createError);
    throw new Error(`Failed to create auth user: ${createError.message}`);
  }

  // The handle_new_user trigger should auto-create the profile,
  // but let's ensure it exists
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: newUser.user.id,
      email: email,
      status: 'active',
    }, { onConflict: 'user_id' });

  if (profileError) {
    logger.error('Failed to upsert user profile', profileError);
    // Don't throw — the trigger may have already created it
  }

  logger.info(`Provisioned new user: ${email} (${newUser.user.id})`);
  return { userId: newUser.user.id, created: true };
}

/**
 * Revokes a user's access by setting status='revoked' in user_profiles.
 */
export async function revokeUser(email: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ status: 'revoked' })
    .eq('email', email);

  if (error) {
    logger.error(`Failed to revoke user ${email}`, error);
    throw new Error(`Failed to revoke user: ${error.message}`);
  }

  logger.info(`Revoked user: ${email}`);
}

/**
 * Restores a user's access by setting status='active' in user_profiles.
 */
export async function restoreUser(email: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ status: 'active', last_active: new Date().toISOString() })
    .eq('email', email);

  if (error) {
    logger.error(`Failed to restore user ${email}`, error);
    throw new Error(`Failed to restore user: ${error.message}`);
  }

  logger.info(`Restored user: ${email}`);
}

/**
 * Triggers a GHL welcome email via the GHL API.
 */
export async function sendGHLWelcomeEmail(email: string, firstName?: string): Promise<void> {
  const GHL_BASE = 'https://services.leadconnectorhq.com';

  try {
    // Search for contact by email
    const searchResp = await fetch(
      `${GHL_BASE}/contacts/search?email=${encodeURIComponent(email)}&location_id=${env.GHL_LOCATION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${env.GHL_API_KEY}`,
          Version: '2021-07-28',
        },
      }
    );

    if (!searchResp.ok) {
      logger.error(`GHL contact search failed for ${email}: ${searchResp.status}`);
      return; // Non-fatal — don't block provisioning
    }

    const searchData = await searchResp.json();
    const contacts = searchData.contacts || [];
    if (contacts.length === 0) {
      logger.info(`No GHL contact found for ${email} — skipping welcome email`);
      return;
    }

    const contactId = contacts[0].id;

    // Trigger a workflow/pipeline that sends the welcome email
    // Using GHL's workflow trigger API — the actual workflow ID would
    // need to be configured for the welcome email sequence
    const triggerResp = await fetch(`${GHL_BASE}/contacts/${contactId}/workflow-trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GHL_API_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'payment_success',
        payload: {
          email,
          first_name: firstName || '',
        },
      }),
    });

    if (!triggerResp.ok) {
      logger.error(`GHL workflow trigger failed for ${email}: ${triggerResp.status}`);
      return;
    }

    logger.info(`Triggered GHL welcome email for ${email}`);
  } catch (error) {
    logger.error(`GHL welcome email error for ${email}`, error);
    // Non-fatal — don't block provisioning
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}