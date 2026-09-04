import { config } from './config.js';

export interface DiscordClaimNotification {
  spotId: string;
  x: number;
  y: number;
  displayName: string;
  tagline?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  claimedAt: string;
}

export async function sendSpotClaimNotification(input: DiscordClaimNotification): Promise<void> {
  const webhookUrl = config.discordWebhookUrl;
  if (!webhookUrl) return;

  const spotUrl = `https://www.claimyourspot.lol/?spot=${input.x},${input.y}`;
  const authorName = input.displayName || 'Anonymous Citizen';

  const payload = {
    embeds: [
      {
        title: `Spot (${input.x}, ${input.y}) claimed!`,
        description: `**${authorName}** just claimed spot **(${input.x}, ${input.y})**.`,
        url: spotUrl,
        color: 0x34d399,
        fields: [
          ...(input.tagline ? [{ name: 'Tagline', value: input.tagline.slice(0, 1024), inline: false }] : []),
          ...(input.githubUrl ? [{ name: 'GitHub', value: input.githubUrl, inline: true }] : []),
          ...(input.websiteUrl ? [{ name: 'Website', value: input.websiteUrl, inline: true }] : []),
          { name: 'Claimed at', value: new Date(input.claimedAt).toUTCString(), inline: false },
        ],
        footer: { text: 'claimyourspot.lol' },
        timestamp: new Date(input.claimedAt).toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Discord webhook failed with status ${res.status}:`, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Discord webhook error:', err);
  }
}

export interface DiscordBillboardNotification {
  billboardId: string;
  billboardName: string;
  tier: string;
  buyerEmail: string;
  buyerName?: string | null;
  headline: string;
  subtext?: string | null;
  targetUrl?: string | null;
  priceFormatted: string;
  saleId: string;
}

export async function sendBillboardPurchaseNotification(input: DiscordBillboardNotification): Promise<void> {
  const webhookUrl = config.discordWebhookUrl;
  if (!webhookUrl) return;

  const payload = {
    embeds: [
      {
        title: `📡 Cyber Billboard Sponsored: ${input.billboardName}`,
        description: `**${input.buyerName || 'Sponsor'}** (${input.buyerEmail}) just sponsored **${input.billboardName}**!`,
        url: input.targetUrl || 'https://claimyourspot.lol/world',
        color: 0x00f0ff, // Cyber Cyan
        fields: [
          { name: 'Billboard ID', value: `\`${input.billboardId}\``, inline: true },
          { name: 'Tier / Location', value: input.tier || 'Standard', inline: true },
          { name: 'Amount Paid', value: input.priceFormatted, inline: true },
          { name: 'Headline', value: `**${input.headline}**`, inline: false },
          ...(input.subtext ? [{ name: 'Subtext', value: input.subtext, inline: false }] : []),
          ...(input.targetUrl ? [{ name: 'Destination Link', value: input.targetUrl, inline: false }] : []),
          { name: 'Gumroad Sale ID', value: `\`${input.saleId}\``, inline: true },
        ],
        footer: { text: 'Spot World Cyber Billboard Network • claimyourspot.lol' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Discord billboard webhook failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Discord billboard webhook error:', err);
  }
}

export interface DiscordVisitorNotification {
  ip: string;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  os: string;
  browser: string;
  device: string;
  referrer?: string | null;
  path?: string | null;
  userAgent: string;
  totalVisitors: number;
}

export function parseUserAgent(ua: string): { os: string; browser: string; device: string } {
  let os = 'Unknown OS';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone/i.test(ua)) os = 'iPhone iOS';
  else if (/ipad/i.test(ua)) os = 'iPad iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  let device = '💻 Desktop';
  if (/mobile|iphone|android.*mobile/i.test(ua)) device = '📱 Mobile';
  else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) device = '📟 Tablet';

  return { os, browser, device };
}

function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export async function sendVisitorNotification(input: DiscordVisitorNotification): Promise<void> {
  const webhookUrl = config.visitorDiscordWebhookUrl;
  if (!webhookUrl) return;

  const flag = getCountryFlag(input.country);
  const locationStr = [input.city, input.region, input.country].filter(Boolean).join(', ') || 'Unknown Location';

  const payload = {
    embeds: [
      {
        title: `🌐 New Visitor Landed • #${input.totalVisitors}`,
        description: `**${flag} ${locationStr}**`,
        color: 0x3b82f6, // Vibrant Blue
        fields: [
          { name: '📍 Location', value: `${flag} ${locationStr}`, inline: true },
          { name: '💻 Device / OS', value: `${input.device} • ${input.os}`, inline: true },
          { name: '🌐 Browser', value: input.browser, inline: true },
          { name: '🛡️ IP Address', value: `\`${input.ip}\``, inline: true },
          { name: '🔗 Referrer', value: input.referrer ? `\`${input.referrer}\`` : 'Direct / Organic', inline: true },
          { name: '🧭 Page Path', value: `\`${input.path || '/'}\``, inline: true },
          { name: '🔍 Full User-Agent', value: `\`\`\`${input.userAgent.slice(0, 250)}\`\`\``, inline: false },
        ],
        footer: { text: 'SPOT Realtime Analytics • claimyourspot.lol' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Discord visitor webhook failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Discord visitor webhook error:', err);
  }
}

export interface DiscordLibrarySuggestionNotification {
  title: string;
  url: string;
  category: string;
  description: string;
  submitterName?: string | null;
  submitterCitizenId?: string | null;
}

export async function sendLibrarySuggestionNotification(input: DiscordLibrarySuggestionNotification): Promise<void> {
  const webhookUrl = config.discordWebhookUrl;
  if (!webhookUrl) return;

  const payload = {
    embeds: [
      {
        title: `📚 New Resource Suggested for The Grand Codex!`,
        description: `**[${input.title}](${input.url})**\n${input.description}`,
        color: 0x8b5cf6, // Vibrant Violet
        fields: [
          { name: 'Category', value: `\`${input.category}\``, inline: true },
          { name: 'Direct Link', value: input.url, inline: true },
          {
            name: 'Suggested By',
            value: input.submitterName
              ? `**${input.submitterName}**${input.submitterCitizenId ? ` (\`${input.submitterCitizenId}\`)` : ''}`
              : 'Anonymous Visitor',
            inline: false,
          },
        ],
        footer: { text: 'SPOT Grand Codex • Curated Dev Vault' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Discord library suggestion webhook failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Discord library suggestion webhook error:', err);
  }
}
