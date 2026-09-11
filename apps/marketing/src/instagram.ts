import { config, hasInstagram } from './config.js';
import { getState, setState } from './db.js';

/**
 * Instagram automation via the official Meta Graph API — FREE, no paid plan.
 * Prerequisites (one-time, on Meta's side):
 *   1. Instagram account switched to Business or Creator.
 *   2. That account linked to a Facebook Page.
 *   3. A Meta developer app with instagram_basic + instagram_content_publish.
 *   4. A long-lived access token (~60 days; this worker auto-refreshes it).
 *
 * Images must be public HTTPS URLs — we use the app's own OG cards:
 *   https://claimyourspot.lol/api/og/{x},{y}  (1200x630, inside IG's 4:5–1.91:1)
 */

function graph(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `https://graph.facebook.com/${config.igGraphVersion}/${config.igUserId}${path}?${qs}`;
}

async function effectiveToken(): Promise<string> {
  try {
    const stored = await getState('ig_access_token');
    if (stored) return stored;
  } catch {
    // DB unavailable — fall back to env
  }
  return config.igAccessToken;
}

export async function verifyInstagram(): Promise<string> {
  if (!hasInstagram) throw new Error('Instagram credentials are not configured');
  const token = await effectiveToken();
  const res = await fetch(
    `https://graph.facebook.com/${config.igGraphVersion}/${config.igUserId}?fields=username,account_type&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) throw new Error(`Instagram verify failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { username?: string; account_type?: string };
  return `@${data.username ?? config.igUserId} (${data.account_type ?? 'unknown type'})`;
}

async function pollContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(
      `https://graph.facebook.com/${config.igGraphVersion}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) throw new Error(`Instagram status check failed (${res.status})`);
    const data = (await res.json()) as { status_code?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram media processing errored');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Instagram media processing timed out');
}

export async function postToInstagram(imageUrl: string, caption: string): Promise<string> {
  if (!hasInstagram) throw new Error('Instagram credentials are not configured');
  const token = await effectiveToken();

  const createRes = await fetch(graph('/media', {
    image_url: imageUrl,
    caption,
    access_token: token,
  }), { method: 'POST' });
  if (!createRes.ok) {
    throw new Error(`Instagram container failed (${createRes.status}): ${await createRes.text()}`);
  }
  const container = (await createRes.json()) as { id?: string };
  if (!container.id) throw new Error('Instagram did not return a media container id');

  await pollContainer(container.id, token);

  const publishRes = await fetch(graph('/media_publish', {
    creation_id: container.id,
    access_token: token,
  }), { method: 'POST' });
  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed (${publishRes.status}): ${await publishRes.text()}`);
  }
  const published = (await publishRes.json()) as { id?: string };
  return published.id ?? container.id;
}

/**
 * Refresh the long-lived token (valid ~60 days). Stores the fresh token in
 * marketing_state so the worker keeps working without manual rotation.
 */
export async function refreshInstagramToken(): Promise<string> {
  const token = await effectiveToken();
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) throw new Error(`Instagram refresh failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Instagram did not return a refreshed token');
  await setState('ig_access_token', data.access_token);
  return `refreshed (valid ~${Math.round((data.expires_in ?? 0) / 86400)} days)`;
}
