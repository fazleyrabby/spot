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

// All writes go through the authoritative server when PUBLIC_API_BASE is set.
// Leave unset for local dev without the server (falls back to direct Supabase mode).
const configuredApiBase = (import.meta.env.PUBLIC_API_BASE as string | undefined)?.replace(/\/$/, '');
export const API_BASE = configuredApiBase
  ? (configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`)
  : null;

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
      const res = await fetch(`${API_BASE}/world`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) return await res.json();
      throw new Error(`World API returned ${res.status}`);
    } catch (err) {
      // Never fall back to direct Supabase reads when the authoritative API is configured.
      // This keeps local development isolated from the live dataset.
      console.error('API /world unavailable; refusing live-data fallback:', err);
      throw err;
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
      const err: any = new Error(json.message || json.error || 'Failed to sync GitHub');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status) throw err;
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
      const err: any = new Error(data.message || data.error || 'Claim failed');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status) throw err; // real server error — do NOT fall back to direct mode
      console.warn('API /spots/claim unreachable, falling back to direct mode:', err);
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
      console.warn('API /citizens/me PATCH unreachable, falling back to direct mode:', err);
    }
  }
  return await updateProfileDirect(profile);
}

export async function deleteMyAccount(targetSpotId?: string, targetCitizenId?: string): Promise<{ success: boolean; message: string }> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/citizens/me`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      const err: any = new Error(data.message || data.error || 'Failed to delete account');
      err.status = res.status;
      throw err;
    } catch (err: any) {
      if (err?.status) throw err;
      console.warn('API /citizens/me DELETE unreachable, falling back to direct mode:', err);
    }
  }
  return await deleteAccountDirect(targetSpotId, targetCitizenId);
}
