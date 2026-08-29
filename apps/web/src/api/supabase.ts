import { createClient } from '@supabase/supabase-js';
import type { WorldSnapshot, OccupiedSpotSummary, Citizen, CreateCitizenInput } from '@spot/shared';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || 'https://koqodifauvvemouhnjqz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvcW9kaWZhdXZ2ZW1vdWhuanF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTk5ODYsImV4cCI6MjEwMzU5NTk4Nn0.hCknsp_62Qj0bj3Vlhe5gNftDYMiNGSv1vZa-Ib9OlI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signInWithGitHub(redirectTo?: string) {
  const targetUrl = redirectTo || (typeof window !== 'undefined' ? window.location.href : 'http://localhost:4322');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: targetUrl,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * DIRECT SUPABASE MODE: Fetch entire 10k world snapshot directly from PostgreSQL
 */
export async function fetchWorldDirect(): Promise<WorldSnapshot> {
  const { data: spots, error: spotsErr } = await supabase
    .from('spots')
    .select(`
      id, x, y, owner_id, claimed_at,
      citizens:citizens!spots_owner_id_fkey (
        id, display_name, avatar_id, tagline, website_url, github_url, linkedin_url
      )
    `)
    .not('owner_id', 'is', null);

  if (spotsErr) {
    console.error('Error fetching spots from Supabase:', spotsErr);
  }

  const occupied: OccupiedSpotSummary[] = (spots || []).map((s: any) => {
    const c = Array.isArray(s.citizens) ? s.citizens[0] : s.citizens;
    return {
      spotId: s.id,
      x: s.x,
      y: s.y,
      citizenId: c?.id || s.owner_id,
      displayName: c?.display_name || 'Citizen',
      avatarId: c?.avatar_id || 'astronaut',
      tagline: c?.tagline || undefined,
      websiteUrl: c?.website_url || undefined,
      githubUrl: c?.github_url || undefined,
      linkedinUrl: c?.linkedin_url || undefined,
      isOnline: true,
    };
  });

  // Read / Increment visitor counter
  let totalVisitors = 1;
  try {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const hasVisited = typeof localStorage !== 'undefined' && localStorage.getItem('spot_visited_direct');
    if (!isLocal && !hasVisited) {
      const { data: count } = await supabase.rpc('increment_visitors');
      if (count) totalVisitors = Number(count);
      localStorage.setItem('spot_visited_direct', '1');
    } else {
      const { data: stat } = await supabase.from('site_stats').select('value').eq('key', 'total_visitors').single();
      if (stat) totalVisitors = Number(stat.value);
    }
  } catch {}

  return {
    width: 100,
    height: 100,
    totalSpots: 10000,
    claimedCount: occupied.length,
    totalVisitors,
    onlineCount: 1,
    occupied,
  };
}

/**
 * DIRECT SUPABASE MODE: Fetch current session & owned spot directly from Supabase
 */
export async function fetchSessionDirect(): Promise<{
  authenticated: boolean;
  citizen: Citizen | null;
  ownedSpot: { id: string; x: number; y: number; claimedAt: string } | null;
}> {
  const user = await getSupabaseUser();
  const ghUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;

  // Look up citizen by github_url, email, github_id, or user id
  let citizenRow: any = null;
  if (ghUsername) {
    const { data } = await supabase
      .from('citizens')
      .select('*')
      .ilike('github_url', `%${ghUsername}%`)
      .limit(1)
      .maybeSingle();
    citizenRow = data;
  }

  if (!citizenRow && user?.email) {
    const { data } = await supabase
      .from('citizens')
      .select('*')
      .eq('email', user.email)
      .limit(1)
      .maybeSingle();
    citizenRow = data;
  }

  if (!citizenRow && user) {
    const { data } = await supabase
      .from('citizens')
      .select('*')
      .or(`github_id.eq.${user.id},id.eq.c_${user.id.replace(/-/g, '').substring(0, 24)}`)
      .limit(1)
      .maybeSingle();
    citizenRow = data;
  }

  if (!citizenRow && typeof window !== 'undefined') {
    const savedCitId = localStorage.getItem('spot_citizen_id');
    const savedToken = localStorage.getItem('spot_session_token');
    const savedOwned = localStorage.getItem('spot_my_owned');
    if (savedCitId) {
      const { data } = await supabase.from('citizens').select('*').eq('id', savedCitId).limit(1).maybeSingle();
      citizenRow = data;
    } else if (savedToken) {
      const { data } = await supabase.from('citizens').select('*').eq('session_token_hash', savedToken).limit(1).maybeSingle();
      citizenRow = data;
    } else if (savedOwned) {
      try {
        const parsed = JSON.parse(savedOwned);
        const spotId = parsed.id || `${parsed.x},${parsed.y}`;
        const { data: sp } = await supabase.from('spots').select('owner_id').eq('id', spotId).limit(1).maybeSingle();
        if (sp?.owner_id) {
          const { data: cit } = await supabase.from('citizens').select('*').eq('id', sp.owner_id).limit(1).maybeSingle();
          citizenRow = cit;
        }
      } catch {}
    }
  }

  if (!citizenRow) {
    return { authenticated: Boolean(user), citizen: null, ownedSpot: null };
  }

  const citizen: Citizen = {
    id: citizenRow.id,
    displayName: citizenRow.display_name,
    avatarId: citizenRow.avatar_id,
    tagline: citizenRow.tagline || undefined,
    websiteUrl: citizenRow.website_url || undefined,
    githubUrl: citizenRow.github_url || undefined,
    linkedinUrl: citizenRow.linkedin_url || undefined,
    createdAt: citizenRow.created_at,
    updatedAt: citizenRow.updated_at,
  };

  // Find owned spot
  const { data: spotRow } = await supabase
    .from('spots')
    .select('id, x, y, claimed_at')
    .eq('owner_id', citizen.id)
    .limit(1)
    .maybeSingle();

  const ownedSpot = spotRow ? {
    id: spotRow.id,
    x: spotRow.x,
    y: spotRow.y,
    claimedAt: spotRow.claimed_at,
  } : null;

  return { authenticated: true, citizen, ownedSpot };
}

/**
 * DIRECT SUPABASE MODE: Claim spot directly in Supabase
 */
export async function claimSpotDirect(input: {
  x: number;
  y: number;
  displayName: string;
  avatarId: string;
  tagline?: string;
  websiteUrl?: string;
  githubUrl?: string;
}): Promise<{
  success: boolean;
  spot: { id: string; x: number; y: number; ownerId: string; claimedAt: string };
  citizen: Citizen;
}> {
  const user = await getSupabaseUser();
  const ghUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || input.githubUrl;
  const citizenId = user ? `c_${user.id.replace(/-/g, '').substring(0, 24)}` : `c_${Math.random().toString(36).substring(2, 14)}`;
  const spotId = `${input.x},${input.y}`;

  // Check if target spot is already occupied
  const { data: existingSpot } = await supabase
    .from('spots')
    .select('owner_id')
    .eq('id', spotId)
    .single();

  if (existingSpot && existingSpot.owner_id) {
    throw new Error('This spot is already claimed by another citizen!');
  }

  // 1. Upsert citizen record
  const tokenHash = 'direct_auth_' + Math.random().toString(36).substring(2, 16);
  const { data: citizenData, error: citErr } = await supabase
    .from('citizens')
    .upsert({
      id: citizenId,
      session_token_hash: tokenHash,
      display_name: input.displayName.trim(),
      avatar_id: input.avatarId,
      tagline: input.tagline?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      github_url: ghUsername || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (citErr) throw citErr;

  // 2. Claim spot
  const now = new Date().toISOString();
  const { data: spotData, error: spotErr } = await supabase
    .from('spots')
    .update({
      owner_id: citizenId,
      claimed_at: now,
    })
    .eq('id', spotId)
    .select('id, x, y, owner_id, claimed_at')
    .single();

  if (spotErr) throw spotErr;

  if (typeof window !== 'undefined') {
    localStorage.setItem('spot_session_token', tokenHash);
    localStorage.setItem('spot_citizen_id', citizenData.id);
    localStorage.setItem('spot_my_owned', JSON.stringify({ id: spotData.id, x: spotData.x, y: spotData.y, claimedAt: spotData.claimed_at }));
  }

  const citizen: Citizen = {
    id: citizenData.id,
    displayName: citizenData.display_name,
    avatarId: citizenData.avatar_id,
    tagline: citizenData.tagline || undefined,
    websiteUrl: citizenData.website_url || undefined,
    githubUrl: citizenData.github_url || undefined,
    createdAt: citizenData.created_at,
    updatedAt: citizenData.updated_at,
  };

  return {
    success: true,
    spot: {
      id: spotData.id,
      x: spotData.x,
      y: spotData.y,
      ownerId: spotData.owner_id,
      claimedAt: spotData.claimed_at,
    },
    citizen,
  };
}

/**
 * DIRECT SUPABASE MODE: Update profile directly in Supabase
 */
export async function updateProfileDirect(profile: Partial<CreateCitizenInput>): Promise<{ success: boolean; citizen: Citizen }> {
  const session = await fetchSessionDirect();
  if (!session.citizen) throw new Error('Citizen not authenticated');

  const { data, error } = await supabase
    .from('citizens')
    .update({
      display_name: profile.displayName || session.citizen.displayName,
      avatar_id: profile.avatarId || session.citizen.avatarId,
      tagline: profile.tagline !== undefined ? profile.tagline : session.citizen.tagline,
      website_url: profile.websiteUrl !== undefined ? profile.websiteUrl : session.citizen.websiteUrl,
      github_url: profile.githubUrl !== undefined ? profile.githubUrl : session.citizen.githubUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.citizen.id)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    citizen: {
      id: data.id,
      displayName: data.display_name,
      avatarId: data.avatar_id,
      tagline: data.tagline || undefined,
      websiteUrl: data.website_url || undefined,
      githubUrl: data.github_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * DIRECT SUPABASE MODE: Delete account and release spot directly in Supabase
 */
export async function deleteAccountDirect(targetSpotId?: string, targetCitizenId?: string): Promise<{ success: boolean; message: string }> {
  let citizenId = targetCitizenId;
  let spotId = targetSpotId;

  if (!citizenId) {
    const session = await fetchSessionDirect();
    if (session.citizen) {
      citizenId = session.citizen.id;
      spotId = session.ownedSpot?.id;
    }
  }

  if (!citizenId && typeof window !== 'undefined') {
    const saved = localStorage.getItem('spot_my_owned');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        spotId = spotId || parsed.id || `${parsed.x},${parsed.y}`;
      } catch {}
    }
    citizenId = localStorage.getItem('spot_citizen_id') || undefined;
  }

  if (spotId && !citizenId) {
    const { data: sp } = await supabase.from('spots').select('owner_id').eq('id', spotId).limit(1).maybeSingle();
    if (sp?.owner_id) citizenId = sp.owner_id;
  }

  // 1. Release spot
  if (spotId) {
    await supabase.from('spots').update({ owner_id: null, claimed_at: null }).eq('id', spotId);
  }
  if (citizenId) {
    await supabase.from('spots').update({ owner_id: null, claimed_at: null }).eq('owner_id', citizenId);
    // 2. Delete citizen row
    await supabase.from('citizens').delete().eq('id', citizenId);
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('spot_my_owned');
    localStorage.removeItem('spot_citizen_id');
    localStorage.removeItem('spot_session_token');
  }

  return { success: true, message: 'Account and spot deleted successfully' };
}

/**
 * DIRECT SUPABASE MODE: Search citizens
 */
export async function searchCitizensDirect(queryText: string) {
  if (!queryText.trim()) return [];
  const { data } = await supabase
    .from('citizens')
    .select(`
      id, display_name, avatar_id, tagline, website_url, github_url,
      spots!inner (id, x, y)
    `)
    .or(`display_name.ilike.%${queryText}%,tagline.ilike.%${queryText}%,github_url.ilike.%${queryText}%`)
    .limit(20);

  return (data || []).map((c: any) => {
    const s = Array.isArray(c.spots) ? c.spots[0] : c.spots;
    return {
      id: c.id,
      displayName: c.display_name,
      avatarId: c.avatar_id,
      tagline: c.tagline,
      websiteUrl: c.website_url,
      githubUrl: c.github_url,
      spotId: s?.id || '',
      x: s?.x || 0,
      y: s?.y || 0,
    };
  });
}
