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
