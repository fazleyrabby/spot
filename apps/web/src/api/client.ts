import type { WorldSnapshot, Citizen, CreateCitizenInput } from '@spot/shared';
import {
  fetchWorldDirect,
  fetchSessionDirect,
  claimSpotDirect,
  updateProfileDirect,
  deleteAccountDirect,
  searchCitizensDirect,
} from './supabase.js';
import { getDeviceFingerprint } from './fingerprint.js';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

// All writes go through the authoritative server when PUBLIC_API_BASE is set.
// Leave unset for local dev without the server (falls back to direct Supabase mode).
function resolveApiClientBase(): string | null {
  const configuredApiBase = (import.meta.env.PUBLIC_API_BASE as string | undefined)?.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // If client is not on localhost, never route to localhost
    if (!isLocal && configuredApiBase && (configuredApiBase.includes('localhost') || configuredApiBase.includes('127.0.0.1'))) {
      return '/api';
    }
  }
  if (configuredApiBase) {
    return configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`;
  }
  return import.meta.env.PROD || (typeof window !== 'undefined' && window.location.origin) ? '/api' : null;
}
export const API_BASE = resolveApiClientBase();

export interface MySessionResponse {
  authenticated: boolean;
  success?: boolean;
  citizen: Citizen | null;
  ownedSpot: { id: string; x: number; y: number; claimedAt: string } | null;
}

export interface ClaimSpotResponse {
  success: boolean;
  spot: { id: string; x: number; y: number; ownerId: string; claimedAt: string };
  citizen: Citizen;
  error?: string;
  message?: string;
}

export interface SpotComment {
  id: number;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SpotWallState {
  comments: SpotComment[];
  visibility: 'open' | 'readonly';
  canPost: boolean;
  isOwner: boolean;
}

export async function registerPasskey(): Promise<void> {
  if (!API_BASE) throw new Error('Passkeys require the authoritative API');
  const optionsRes = await fetch(`${API_BASE}/auth/passkey/register/options`, { method: 'POST', headers: getAuthHeaders(), credentials: 'include' });
  const options = await optionsRes.json();
  if (!optionsRes.ok) throw new Error(options.message || 'Could not start passkey setup');
  const credential = await startRegistration({ optionsJSON: options });
  const verifyRes = await fetch(`${API_BASE}/auth/passkey/register/verify`, {
    method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(credential),
  });
  const result = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) throw new Error(result.message || 'Could not save passkey');
}

export async function authenticateWithPasskey(): Promise<MySessionResponse> {
  if (!API_BASE) throw new Error('Passkeys require the authoritative API');
  const optionsRes = await fetch(`${API_BASE}/auth/passkey/authenticate/options`, { method: 'POST', headers: getAuthHeaders(), credentials: 'include' });
  const options = await optionsRes.json();
  if (!optionsRes.ok) throw new Error(options.message || 'Could not start passkey sign in');
  const credential = await startAuthentication({ optionsJSON: options });
  const verifyRes = await fetch(`${API_BASE}/auth/passkey/authenticate/verify`, {
    method: 'POST', headers: getAuthHeaders(), credentials: 'include', body: JSON.stringify(credential),
  });
  const result = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok) throw new Error(result.message || 'Could not verify passkey');
  if (result.sessionToken) localStorage.setItem('spot_session_token', result.sessionToken);
  if (result.citizen?.id) localStorage.setItem('spot_citizen_id', result.citizen.id);
  return result;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('spot_session_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-spot-session'] = token;
    }
  }
  return headers;
}

export async function fetchSpotComments(spotId: string): Promise<SpotWallState> {
  if (!API_BASE) return { comments: [], visibility: 'readonly', canPost: false, isOwner: false };
  const res = await fetch(`${API_BASE}/spots/${encodeURIComponent(spotId)}/comments`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load spot wall');
  const data = await res.json();
  return data;
}

export async function postSpotComment(spotId: string, body: string, authorName?: string): Promise<SpotComment> {
  if (!API_BASE) throw new Error('Spot walls require the authoritative API');
  const res = await fetch(`${API_BASE}/spots/${encodeURIComponent(spotId)}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ body, authorName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to post comment');
  return data.comment;
}

export async function updateSpotWall(spotId: string, visibility: 'open' | 'readonly'): Promise<'open' | 'readonly'> {
  if (!API_BASE) throw new Error('Spot walls require the authoritative API');
  const res = await fetch(`${API_BASE}/spots/${encodeURIComponent(spotId)}/wall`, {
    method: 'PATCH', headers: getAuthHeaders(), credentials: 'include',
    body: JSON.stringify({ visibility }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not update wall settings');
  return data.visibility;
}

export async function fetchWorldSnapshot(): Promise<WorldSnapshot> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/world`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('API /world fetch failed, falling back to direct mode:', err);
    }
  }
  return await fetchWorldDirect();
}

export async function fetchMySession(): Promise<MySessionResponse> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/citizens/me`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      } else {
        const errData = await res.json().catch(() => ({}));
        const err: any = new Error(errData.message || errData.error || 'Session check failed');
        err.status = res.status;
        throw err;
      }
    } catch (err: any) {
      if (err?.status) throw err;
      console.warn('API /citizens/me unreachable, falling back to direct mode:', err);
    }
  }
  return await fetchSessionDirect();
}

export function isServerOfflineError(err: any): boolean {
  if (!err) return false;
  if (err.isOffline) return true;
  if (err.status === 503 || err.status === 502 || err.status === 504) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('server is temporarily offline') ||
    msg.includes('serveroffline') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused')
  );
}

export async function checkServerHealth(): Promise<boolean> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = origin ? `${origin}/health?t=${Date.now()}` : '/health';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.status === 'ok';
    }
  } catch {}
  return false;
}

export async function syncGithubAuth(data: {
  githubId: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  displayName?: string;
}): Promise<MySessionResponse> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/auth/github/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (json.sessionToken) {
          localStorage.setItem('spot_session_token', json.sessionToken);
        }
        return json;
      }
      // If server is 503/502/504, fall back to direct Supabase session
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        console.warn('Authoritative server offline (503), resolving session directly from Supabase...');
        return await fetchSessionDirect();
      }
      const err: any = new Error(json.message || json.error || 'Failed to sync GitHub');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status && err.status !== 503 && err.status !== 502 && err.status !== 504) throw err;
      console.warn('API /auth/github/sync unreachable, falling back to direct mode:', err);
    }
  }
  return await fetchSessionDirect();
}

export interface ClaimInputData {
  displayName: string;
  avatarId: string;
  customAvatarData?: string;
  tagline?: string;
  bio?: string;
  websiteUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  referrerSpotId?: string;
}

export async function claimSpot(
  spotIdOrInput: string | ({ x: number; y: number } & ClaimInputData),
  optionalInput?: ClaimInputData
): Promise<ClaimSpotResponse> {
  let finalInput: { x: number; y: number } & ClaimInputData;
  if (typeof spotIdOrInput === 'string') {
    const [x, y] = spotIdOrInput.split(',').map(Number);
    finalInput = { x, y, ...optionalInput! };
  } else {
    finalInput = spotIdOrInput;
  }

  if (API_BASE) {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const res = await fetch(`${API_BASE}/spots/claim`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'x-spot-device-fingerprint': deviceFingerprint },
        credentials: 'include',
        body: JSON.stringify(finalInput),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.sessionToken) {
          localStorage.setItem('spot_session_token', data.sessionToken);
        }
        return data;
      }
      // Surface the server's authoritative error (409 spot taken, 403 blocked, etc.)
      const isOffline = res.status === 503 || res.status === 502 || res.status === 504;
      const err: any = new Error(
        isOffline
          ? 'The SPOT server is temporarily recharging or offline for maintenance. Your spot is held and will be claimed as soon as the server wakes up.'
          : (data.message || data.error || 'Claim failed')
      );
      err.status = res.status;
      err.isOffline = isOffline;
      throw err;
    } catch (err: any) {
      if (!err.status || err.status === 503 || err.status === 502 || err.status === 504) {
        err.isOffline = true;
      }
      throw err;
    }
  }
  return await claimSpotDirect(finalInput);
}

export interface CitizenSearchResult {
  id: string;
  displayName: string;
  avatarId: string;
  tagline?: string;
  websiteUrl?: string;
  githubUrl?: string;
  isVerified?: boolean;
  spotId: string;
  x: number;
  y: number;
}

export async function searchCitizens(query: string): Promise<CitizenSearchResult[]> {
  if (!query.trim()) return [];
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/citizens/search?q=${encodeURIComponent(query.trim())}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch {}
  }
  return await searchCitizensDirect(query);
}

export async function updateMyProfile(
  profile: Partial<CreateCitizenInput>
): Promise<{ success: boolean; citizen: Citizen }> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/citizens/me`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      const err: any = new Error(data.message || data.error || 'Failed to update profile');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status) throw err;
      console.error('API /citizens/me PATCH unreachable; refusing direct Supabase fallback:', err);
      throw err;
    }
  }
  return await updateProfileDirect(profile);
}

export async function deleteMyAccount(targetSpotId?: string, targetCitizenId?: string): Promise<{ success: boolean; message: string }> {
  if (API_BASE) {
    const deviceFingerprint = await getDeviceFingerprint().catch(() => '');
    try {
      const res = await fetch(`${API_BASE}/citizens/me`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'x-spot-device-fingerprint': deviceFingerprint,
        },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      const err: any = new Error(data.message || data.error || 'Failed to delete account');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status) throw err;
      console.error('API /citizens/me DELETE unreachable; refusing direct Supabase fallback:', err);
      throw err;
    }
  }
  return await deleteAccountDirect(targetSpotId, targetCitizenId);
}

/**
 * Record a unique visitor hit (1 per 24h per device) on the backend.
 * Returns the updated totalVisitors count or null on failure.
 */
export async function recordVisit(): Promise<number | null> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/analytics/visit`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return typeof data.totalVisitors === 'number' ? data.totalVisitors : null;
      }
    } catch {}
  }
  return null;
}

