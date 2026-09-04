import { config } from './config.js';
import { query } from './db.js';

export interface WelcomeClaimEmailInput {
  to: string;
  displayName: string;
  x: number;
  y: number;
  avatarId?: string;
  citizenId: string;
}

export interface BillboardSponsoredEmailInput {
  to: string;
  billboardName: string;
  tier: string;
  headline: string;
  subtext?: string | null;
  targetUrl?: string | null;
  priceFormatted: string;
  saleId: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind?: string;
  referenceId?: string;
}

/**
 * Check whether an email for this kind and reference ID has already been recorded
 */
export async function hasEmailBeenSent(kind: string, referenceId: string): Promise<boolean> {
  try {
    const res = await query('SELECT 1 FROM email_logs WHERE kind = $1 AND reference_id = $2 LIMIT 1', [kind, referenceId]);
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Record sent email into database for idempotency & deliverability auditing
 */
export async function logEmailSent(
  kind: string,
  referenceId: string,
  recipientEmail: string,
  resendId: string | null,
  status: 'sent' | 'failed' = 'sent'
): Promise<void> {
  try {
    await query(
      `INSERT INTO email_logs (kind, reference_id, recipient_email, resend_id, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (kind, reference_id) DO NOTHING`,
      [kind, referenceId, recipientEmail, resendId, status]
    );
  } catch (err) {
    console.error('[Mailer] Error logging email:', err);
  }
}

/**
 * Dispatch transactional email via Resend REST API with duplicate prevention
 */
async function sendEmail({ to, subject, html, text, kind, referenceId }: SendEmailParams): Promise<boolean> {
  // Idempotency check: prevent duplicate sends for payment webhooks and duplicate claims
  if (kind && referenceId) {
    const alreadySent = await hasEmailBeenSent(kind, referenceId);
    if (alreadySent) {
      console.log(`[Mailer Idempotency] Email (${kind}:${referenceId}) already sent to ${to}; skipping duplicate.`);
      return true;
    }
  }

  const apiKey = config.resendApiKey;
  if (!apiKey) {
    console.warn('[Mailer] RESEND_API_KEY is not configured; skipping email dispatch.');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        reply_to: 'welcome@claimyourspot.lol',
        subject,
        html,
        text,
        headers: {
          'X-Entity-Ref-ID': referenceId || 'spot-system',
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[Mailer] Resend API error (${res.status}):`, errBody);
      if (kind && referenceId) {
        await logEmailSent(kind, referenceId, to, null, 'failed');
      }
      return false;
    }

    const data = await res.json().catch(() => ({}));
    console.log(`[Mailer] Successfully sent email to ${to} (ID: ${data.id})`);
    if (kind && referenceId) {
      await logEmailSent(kind, referenceId, to, data?.id || null, 'sent');
    }
    return true;
  } catch (err) {
    console.error('[Mailer] Network error sending email:', err);
    if (kind && referenceId) {
      await logEmailSent(kind, referenceId, to, null, 'failed');
    }
    return false;
  }
}

/**
 * Email 1: Welcome & Official Plot Deed Confirmation
 */
export async function sendWelcomeClaimEmail(input: WelcomeClaimEmailInput): Promise<boolean> {
  const { to, displayName, x, y, citizenId } = input;
  const spotUrl = `https://claimyourspot.lol/?spot=${x},${y}`;
  const worldUrl = `https://claimyourspot.lol/world`;

  const subject = `🎉 Welcome to SPOT — Your Plot (${x}, ${y}) is Claimed!`;

  const text = `Welcome to SPOT, Citizen ${displayName}!

Your official plot (${x}, ${y}) has been successfully claimed on the permanent grid.

• Plot Coordinates: Sector (${x}, ${y})
• Citizen ID: ${citizenId}
• View Your Plot: ${spotUrl}
• Explore 2D World: ${worldUrl}

You can customize your avatar, bio, social links, and billboard message at any time.

SPOT — The Permanent 10,000 Spot Grid
https://claimyourspot.lol`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060911; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #0c1222; border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 12px; padding: 32px 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); }
    .header { text-align: center; margin-bottom: 28px; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: 0.15em; color: #00f0ff; text-transform: uppercase; margin: 0 0 6px 0; }
    .tagline { font-size: 13px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; margin: 0; }
    .deed-box { background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.4); border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .deed-title { font-size: 12px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .coords-badge { font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: 0.05em; font-family: monospace; }
    .meta-row { display: flex; justify-content: space-around; margin-top: 14px; font-size: 13px; color: #cbd5e1; }
    .btn-primary { display: block; background: #00f0ff; color: #060911 !important; font-weight: 800; font-size: 15px; text-align: center; padding: 14px 20px; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px 0; }
    .btn-secondary { display: block; background: rgba(255, 255, 255, 0.08); color: #e2e8f0 !important; font-weight: 600; font-size: 14px; text-align: center; padding: 12px 20px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.15); margin-bottom: 24px; }
    .tips { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; font-size: 13px; line-height: 1.6; color: #94a3b8; }
    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; }
    .footer a { color: #00f0ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1 class="brand">⚡ SPOT</h1>
        <p class="tagline">The Permanent 10,000 Citizen Registry</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #f8fafc; margin-top: 0;">
        Welcome to the grid, <strong>${displayName}</strong>! 👋
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8;">
        Your claim has been authenticated and stamped into the database. You are now the recognized owner of this grid plot.
      </p>

      <div class="deed-box">
        <div class="deed-title">Official Deed of Ownership</div>
        <div class="coords-badge">(${x}, ${y})</div>
        <div style="margin-top: 8px; font-size: 12px; color: #38bdf8; font-family: monospace;">
          CITIZEN ID: ${citizenId}
        </div>
      </div>

      <a href="${spotUrl}" class="btn-primary">View Your Plot on SPOT →</a>
      <a href="${worldUrl}" class="btn-secondary">Explore the 2D Virtual World</a>

      <div class="tips">
        <strong style="color: #f1f5f9;">What's next?</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Customize your 8-bit avatar, tagline, and profile links anytime.</li>
          <li>Leave messages on other citizens' guestbook walls.</li>
          <li>Walk through the interactive 2D cyber world and explore neighborhood districts.</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p>© 2026 SPOT • <a href="https://claimyourspot.lol">claimyourspot.lol</a></p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    kind: 'welcome_claim',
    referenceId: citizenId,
  });
}

/**
 * Email 2: Ad Banner / Billboard Sponsorship Confirmation
 */
export async function sendBillboardSponsoredEmail(input: BillboardSponsoredEmailInput): Promise<boolean> {
  const { to, billboardName, tier, headline, subtext, targetUrl, priceFormatted, saleId } = input;
  const worldUrl = `https://claimyourspot.lol/world`;

  const subject = `📡 Your Cyber Billboard is Live on SPOT: ${billboardName}`;

  const text = `Your Cyber Billboard is Live on SPOT!

Sponsorship Confirmation:
• Billboard: ${billboardName} (${tier})
• Headline: ${headline}
${subtext ? `• Subtext: ${subtext}\n` : ''}${targetUrl ? `• Target URL: ${targetUrl}\n` : ''}• Amount Paid: ${priceFormatted}
• Order / Sale ID: ${saleId}

Your ad banner is currently active in the 2D cyberpunk world. Visitors walking past your billboard will see your headline, glowing holographic display, and direct link.

View your billboard live: ${worldUrl}

Thank you for sponsoring SPOT!
https://claimyourspot.lol`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060911; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #0c1222; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 32px 24px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); }
    .header { text-align: center; margin-bottom: 28px; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: 0.15em; color: #f59e0b; text-transform: uppercase; margin: 0 0 6px 0; }
    .tagline { font-size: 13px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; margin: 0; }
    .banner-preview { background: #080c14; border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; box-shadow: 0 0 20px rgba(245, 158, 11, 0.15); }
    .pill { display: inline-block; font-size: 11px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.12); padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .headline { font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 6px; }
    .subtext { font-size: 14px; color: #94a3b8; margin: 0; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .details-table td { padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
    .details-label { color: #94a3b8; }
    .details-val { text-align: right; color: #f1f5f9; font-weight: 600; font-family: monospace; }
    .btn-primary { display: block; background: #f59e0b; color: #060911 !important; font-weight: 800; font-size: 15px; text-align: center; padding: 14px 20px; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px 0; }
    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; }
    .footer a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1 class="brand">📡 CYBER BILLBOARD</h1>
        <p class="tagline">Sponsorship Confirmed • SPOT World Network</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #f8fafc; margin-top: 0;">
        Your billboard sponsorship is <strong>officially live</strong>! 🚀
      </p>

      <div class="banner-preview">
        <span class="pill">● ACTIVE AD DISPLAY • ${tier}</span>
        <div class="headline">${headline}</div>
        ${subtext ? `<div class="subtext">${subtext}</div>` : ''}
      </div>

      <table class="details-table">
        <tr>
          <td class="details-label">Billboard Location</td>
          <td class="details-val">${billboardName}</td>
        </tr>
        <tr>
          <td class="details-label">Amount Paid</td>
          <td class="details-val">${priceFormatted}</td>
        </tr>
        <tr>
          <td class="details-label">Sale / Order ID</td>
          <td class="details-val">${saleId}</td>
        </tr>
        ${targetUrl ? `<tr>
          <td class="details-label">Target Link</td>
          <td class="details-val"><a href="${targetUrl}" style="color: #38bdf8;">${targetUrl.replace(/^https?:\/\//, '').slice(0, 30)}</a></td>
        </tr>` : ''}
      </table>

      <a href="${worldUrl}" class="btn-primary">View Billboard Live in 2D World →</a>
    </div>

    <div class="footer">
      <p>© 2026 SPOT • <a href="https://claimyourspot.lol">claimyourspot.lol</a></p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    kind: 'billboard_sponsor',
    referenceId: saleId,
  });
}
