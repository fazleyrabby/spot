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
