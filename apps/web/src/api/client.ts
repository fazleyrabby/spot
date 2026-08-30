import type { WorldSnapshot, Citizen, CreateCitizenInput } from '@spot/shared';
import {
  fetchWorldDirect,
  fetchSessionDirect,
  claimSpotDirect,
  updateProfileDirect,
  deleteAccountDirect,
  searchCitizensDirect,
} from './supabase.js';

const API_BASE = null;

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

export async function fetchWorldSnapshot(): Promise<WorldSnapshot> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/world`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('API /world unreachable, using direct Supabase mode:', err);
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
        if (data.authenticated) return data;
      }
    } catch {}
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
      if (res.ok) {
        const json = await res.json();
        if (json.sessionToken) {
          localStorage.setItem('spot_session_token', json.sessionToken);
        }
        return json;
      }
    } catch {}
  }
  return await fetchSessionDirect();
}

export interface ClaimInputData {
  displayName: string;
  avatarId: string;
  customAvatarData?: string;
  tagline?: string;
  websiteUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
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
      const res = await fetch(`${API_BASE}/spots/claim`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(finalInput),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.sessionToken) {
          localStorage.setItem('spot_session_token', data.sessionToken);
        }
        return data;
      }
    } catch (err) {
      console.warn('API /spots/claim failed, falling back to direct mode:', err);
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
      if (res.ok) return await res.json();
    } catch {}
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
      if (res.ok) return await res.json();
    } catch {}
  }
  return await deleteAccountDirect(targetSpotId, targetCitizenId);
}
