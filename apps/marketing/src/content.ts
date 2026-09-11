import type { Claim, Totals } from './db.js';

export const BLUESKY_LIMIT = 300;

function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + '…';
}

export interface PostContent {
  text: string;
  claims: Claim[];
  isRecap: boolean;
}

export function buildDailyPost(
  claims: Claim[],
  totals: Totals,
  appUrl: string,
): PostContent {
  const n = claims.length;

  if (n === 0) {
    const text = clamp(
      `🏙️ Spot Metropolis has ${totals.claimed.toLocaleString()}/10,000 tiles claimed.\n\n` +
        `There's still space for you on the map. Claim your permanent pixel → ${appUrl}`,
      BLUESKY_LIMIT,
    );
    return { text, claims, isRecap: false };
  }

  const lines = claims
    .slice(0, 3)
    .map((c) => `• ${c.displayName} → (${c.x}, ${c.y})${c.tagline ? ` — ${c.tagline}` : ''}`);

  const header =
    n === 1
      ? `🏙️ A new citizen just claimed a tile in Spot Metropolis!`
      : `🏙️ ${n} new citizens claimed their tiles in Spot Metropolis today!`;

  const footer = `\n\n${totals.claimed.toLocaleString()}/10,000 claimed. Get yours → ${appUrl}`;

  const body = `${header}\n\n${lines.join('\n')}`;
  return { text: clamp(body + footer, BLUESKY_LIMIT), claims, isRecap: true };
}

export function buildManualPost(text: string): PostContent {
  return { text: clamp(text, BLUESKY_LIMIT), claims: [], isRecap: false };
}

export const INSTAGRAM_LIMIT = 2200;

export function buildInstagramCaption(
  claims: Claim[],
  totals: Totals,
  appUrl: string,
): string {
  const n = claims.length;
  const head =
    n === 0
      ? `🏙️ Spot Metropolis — a living 10,000-tile world on the internet.\n\n${totals.claimed.toLocaleString()} of 10,000 tiles are already claimed. There's still space for you on the map.`
      : n === 1
        ? `🏙️ A new citizen just claimed a tile in Spot Metropolis!\n\n• ${claims[0].displayName} → (${claims[0].x}, ${claims[0].y})${claims[0].tagline ? ` — ${claims[0].tagline}` : ''}`
        : `🏙️ ${n} new citizens claimed their tiles in Spot Metropolis today!\n\n` +
          claims
            .slice(0, 8)
            .map(
              (c) =>
                `• ${c.displayName} → (${c.x}, ${c.y})${c.tagline ? ` — ${c.tagline}` : ''}`,
            )
            .join('\n');

  const tail = `\n\n${totals.claimed.toLocaleString()}/10,000 tiles claimed.\nPick an 8-bit avatar, grab your permanent pixel, and link your portfolio.\n\n👉 ${appUrl}\n\n#claimyourspot #indiedev #pixelart #buildinpublic #webdev`;

  const full = head + tail;
  return full.length <= INSTAGRAM_LIMIT ? full : full.slice(0, INSTAGRAM_LIMIT - 1) + '…';
}

export function recapImageUrl(claims: Claim[], appUrl: string): string {
  const first = claims[0];
  return first ? `${appUrl}/api/og/${first.x},${first.y}` : `${appUrl}/api/og`;
}
