import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const FROM_EMAIL = 'Coach Cass AI <reset@wantedwoman.com>';
const SUPPORT_EMAIL = 'coach@wantedwoman.com';

/**
 * Send a branded password reset email via Resend.
 * This bypasses Supabase's default email templates which show "Supabase" branding.
 */
export async function sendBrandedResetEmail(to: string, token: string): Promise<void> {
  if (!resend) {
    throw new Error('RESEND_API_KEY not configured');
  }
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://transcript-search-next.vercel.app'}/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - Coach Cass AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a0a1e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a0a1e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="500px" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #2d0a31 0%, #1a0a1e 100%); border-radius: 20px; overflow: hidden; border: 1px solid #4d1d57;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #2d0a31 0%, #1a0a1e 100%);">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FF7095 0%, #E11D69 100%); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #FF7095; letter-spacing: -0.5px;">Coach Cass AI</h1>
              <p style="margin: 0; color: #F8A4D8; font-size: 14px; font-weight: 500;">Your Digital Confidante</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 22px; font-weight: 600;">Reset Your Password</h2>
              <p style="margin: 0 0 24px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Hey there! We heard you forgot your password. No worries — let's get you back in.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF7095 0%, #E11D69 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(255, 112, 149, 0.3);">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                The link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>

              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #2d0a31; margin: 24px 0;">

              <!-- Support Info -->
              <p style="margin: 0 0 8px; color: #a0a0a0; font-size: 14px;">Need help?</p>
              <p style="margin: 0; color: #a0a0a0; font-size: 14px;">
                Reach out to us at{' '}
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #FF7095; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #666666; font-size: 13px;">
                Part of the WANTED Woman ecosystem
              </p>
              <p style="margin: 0; color: #444444; font-size: 12px; line-height: 1.5;">
                Coach Cass AI provides perspectives for personal growth and entertainment.<br>
                This is not a replacement for professional therapy or counseling.
              </p>
            </td>
          </tr>
        </table>

        <!-- Branding -->
        <p style="margin-top: 24px; color: #444444; font-size: 12px; text-align: center;">
          Sent by Coach Cass AI • wantedwoman.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject: 'Reset Your Coach Cass AI Password',
    html,
  });
}

/**
 * Send a welcome email on signup
 */
export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  if (!resend) {
    throw new Error('RESEND_API_KEY not configured');
  }
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Coach Cass AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a0a1e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a0a1e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="500px" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #2d0a31 0%, #1a0a1e 100%); border-radius: 20px; overflow: hidden; border: 1px solid #4d1d57;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #2d0a31 0%, #1a0a1e 100%);">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FF7095 0%, #E11D69 100%); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #FF7095; letter-spacing: -0.5px;">Welcome, ${firstName || 'Sis'}!</h1>
              <p style="margin: 0; color: #F8A4D8; font-size: 14px; font-weight: 500;">Your Digital Confidante is here for you.</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 22px; font-weight: 600;">You're In!</h2>
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Coach Cass AI is now at your fingertips. Get ready for honest, grounded relationship coaching that actually feels like talking to your best friend.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://transcript-search-next.vercel.app'}/chat" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF7095 0%, #E11D69 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 8px 24px rgba(255, 112, 149, 0.3);">
                      Start Chatting
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <div style="margin: 24px 0; padding: 20px; background: rgba(255, 112, 149, 0.05); border-radius: 12px; border: 1px solid rgba(255, 112, 149, 0.1);">
                <p style="margin: 0 0 12px; color: #ffffff; font-weight: 600; font-size: 14px;">What you can do:</p>
                <p style="margin: 0 0 8px; color: #a0a0a0; font-size: 14px;">💬 Get relationship advice anytime</p>
                <p style="margin: 0 0 8px; color: #a0a0a0; font-size: 14px;">✨ Receive coaching insights from Coach Cass</p>
                <p style="margin: 0; color: #a0a0a0; font-size: 14px;">🔒 Your conversations are private and safe</p>
              </div>

              <p style="margin: 24px 0 0; color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Need help? Reach out to us at{' '}
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #FF7095; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0 0 8px; color: #666666; font-size: 13px;">
                Part of the WANTED Woman ecosystem
              </p>
              <p style="margin: 0; color: #444444; font-size: 12px; line-height: 1.5;">
                Coach Cass AI provides perspectives for personal growth and entertainment.<br>
                This is not a replacement for professional therapy or counseling.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin-top: 24px; color: #444444; font-size: 12px; text-align: center;">
          Sent by Coach Cass AI • wantedwoman.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject: `Welcome to Coach Cass AI, ${firstName || 'Sis'}!`,
    html,
  });
}
