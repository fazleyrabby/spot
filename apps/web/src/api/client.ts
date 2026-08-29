import type { WorldSnapshot, Citizen, CreateCitizenInput } from '@spot/shared';

const API_BASE = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:5050/api'
  : '/api';

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
  const res = await fetch(`${API_BASE}/world`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load world snapshot: ${res.statusText}`);
  return res.json();
}

export async function fetchMySession(): Promise<MySessionResponse> {
  const res = await fetch(`${API_BASE}/citizens/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return { authenticated: false, citizen: null, ownedSpot: null };
  return res.json();
}

export async function syncGithubAuth(data: {
  githubId: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  displayName?: string;
}): Promise<MySessionResponse> {
  const res = await fetch(`${API_BASE}/auth/github/sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to sync GitHub session');
  const result = await res.json();
  if (result.sessionToken && typeof window !== 'undefined') {
    localStorage.setItem('spot_session_token', result.sessionToken);
  }
  return result;
}

export async function claimSpot(
  spotId: string,
  citizenData?: CreateCitizenInput
): Promise<ClaimSpotResponse> {
  const res = await fetch(`${API_BASE}/spots/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      spotId,
      citizen: citizenData,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to claim spot');
  }
  if (data.sessionToken && typeof window !== 'undefined') {
    localStorage.setItem('spot_session_token', data.sessionToken);
  }
  return data;
}

export async function fetchCitizen(id: string): Promise<{ citizen: Citizen; spot: any }> {
  const res = await fetch(`${API_BASE}/citizens/${id}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Citizen not found');
  return res.json();
}

export interface CitizenSearchResult {
  id: string;
  displayName: string;
  avatarId: string;
  tagline?: string;
  websiteUrl?: string;
  githubUrl?: string;
  spotId: string;
  x: number;
  y: number;
}

export async function searchCitizens(query: string): Promise<CitizenSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE}/citizens/search?q=${encodeURIComponent(query.trim())}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function updateMyProfile(
  profile: Partial<CreateCitizenInput>
): Promise<{ success: boolean; citizen: Citizen }> {
  const res = await fetch(`${API_BASE}/citizens/me`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(profile),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to update profile');
  }
  return data;
}

export async function deleteMyAccount(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/citizens/me`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to delete account');
  }
  return data;
}
