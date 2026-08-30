import { createClient } from '@supabase/supabase-js';
import type { WorldSnapshot, OccupiedSpotSummary, Citizen, CreateCitizenInput } from '@spot/shared';
import { getDeviceFingerprint } from './fingerprint.js';

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

export async function getClientIp(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.ip || null;
    }
  } catch {}
  return null;
}

/**
 * DIRECT SUPABASE MODE: Fetch entire 10k world snapshot directly from PostgreSQL
 */
export async function fetchWorldDirect(): Promise<WorldSnapshot> {
  let spots: any = null;
  let spotsErr: any = null;

  const fullRes = await supabase
    .from('spots')
    .select(`
      id, x, y, owner_id, claimed_at,
      citizens:citizens!spots_owner_id_fkey (
        id, display_name, avatar_id, custom_avatar_data, tagline, website_url, github_url, twitter_url, facebook_url, instagram_url, youtube_url, linkedin_url
      )
    `)
    .not('owner_id', 'is', null);

  if (fullRes.error) {
    const basicRes = await supabase
      .from('spots')
      .select(`
        id, x, y, owner_id, claimed_at,
        citizens:citizens!spots_owner_id_fkey (
          id, display_name, avatar_id, tagline, website_url, github_url, linkedin_url
        )
      `)
      .not('owner_id', 'is', null);

    spots = basicRes.data;
    spotsErr = basicRes.error;
  } else {
    spots = fullRes.data;
    spotsErr = fullRes.error;
  }

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
      customAvatarData: c?.custom_avatar_data || undefined,
      tagline: c?.tagline || undefined,
      websiteUrl: c?.website_url || undefined,
      githubUrl: c?.github_url || undefined,
      twitterUrl: c?.twitter_url || undefined,
      facebookUrl: c?.facebook_url || undefined,
      instagramUrl: c?.instagram_url || undefined,
      youtubeUrl: c?.youtube_url || undefined,
      linkedinUrl: c?.linkedin_url || undefined,
      isVerified: Boolean(c?.github_id || c?.is_verified || (c?.github_url && c?.github_url.trim().length > 0)),
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
    const deviceFp = await getDeviceFingerprint();

    if (savedCitId) {
      const { data } = await supabase.from('citizens').select('*').eq('id', savedCitId).limit(1).maybeSingle();
      citizenRow = data;
    } else if (savedToken) {
      const { data } = await supabase.from('citizens').select('*').or(`id.eq.${savedToken},session_token_hash.eq.${savedToken}`).limit(1).maybeSingle();
      citizenRow = data;
    } else if (deviceFp) {
      try {
        const { data } = await supabase.from('citizens').select('*').eq('device_fingerprint', deviceFp).limit(1).maybeSingle();
        if (data) citizenRow = data;
      } catch {}
    }

    if (!citizenRow && savedOwned) {
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
    customAvatarData: citizenRow.custom_avatar_data || undefined,
    tagline: citizenRow.tagline || undefined,
    websiteUrl: citizenRow.website_url || undefined,
    githubUrl: citizenRow.github_url || undefined,
    twitterUrl: citizenRow.twitter_url || undefined,
    facebookUrl: citizenRow.facebook_url || undefined,
    instagramUrl: citizenRow.instagram_url || undefined,
    youtubeUrl: citizenRow.youtube_url || undefined,
    linkedinUrl: citizenRow.linkedin_url || undefined,
    isVerified: Boolean(citizenRow.github_id || citizenRow.is_verified || (citizenRow.github_url && citizenRow.github_url.trim().length > 0)),
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

  if (typeof window !== 'undefined' && citizen && ownedSpot) {
    localStorage.setItem('spot_citizen_id', citizen.id);
    localStorage.setItem('spot_my_owned', JSON.stringify(ownedSpot));
  }

  return { authenticated: true, citizen, ownedSpot };
}

export function formatSocialUrl(val?: string, platform?: 'twitter' | 'facebook' | 'instagram' | 'youtube' | 'github' | 'linkedin' | 'website'): string | undefined {
  if (!val) return undefined;
  let clean = val.trim();
  if (!clean) return undefined;

  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

  clean = clean.replace(/^@/, '');
  switch (platform) {
    case 'twitter': return `https://x.com/${clean}`;
    case 'facebook': return clean.startsWith('profile.php') ? `https://facebook.com/${clean}` : `https://facebook.com/${clean}`;
    case 'instagram': return `https://instagram.com/${clean}`;
    case 'youtube': return clean.startsWith('UC') || clean.startsWith('@') ? `https://youtube.com/${clean}` : `https://youtube.com/@${clean}`;
    case 'github': return `https://github.com/${clean}`;
    case 'linkedin': return clean.startsWith('in/') ? `https://linkedin.com/${clean}` : `https://linkedin.com/in/${clean}`;
    case 'website': return `https://${clean}`;
    default: return clean;
  }
}

function isColumnMissingError(err: any): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' || err.message?.includes('schema cache') || err.message?.includes('column');
}

/**
 * DIRECT SUPABASE MODE: Claim spot directly in Supabase
 */
export async function claimSpotDirect(input: {
  x: number;
  y: number;
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

  // Device Fingerprint verification
  const deviceFp = await getDeviceFingerprint();
  if (deviceFp) {
    try {
      const { data: existingFp } = await supabase
        .from('citizens')
        .select(`
          id, display_name,
          spots!spots_owner_id_fkey (id, x, y)
        `)
        .eq('device_fingerprint', deviceFp)
        .limit(1)
        .maybeSingle();

      if (existingFp && existingFp.id !== citizenId) {
        const sp = Array.isArray(existingFp.spots) ? existingFp.spots[0] : existingFp.spots;
        if (sp && sp.x !== undefined) {
          throw new Error(`You have already claimed Spot (${sp.x}, ${sp.y}) from this device! Release it first before claiming a new one.`);
        }
      }
    } catch (fpErr: any) {
      if (fpErr.message?.includes('already claimed')) throw fpErr;
    }
  }

  // 1. Upsert citizen record
  const tokenHash = 'direct_auth_' + Math.random().toString(36).substring(2, 16);
  const clientIp = await getClientIp();

  const formattedWebsite = formatSocialUrl(input.websiteUrl, 'website');
  const formattedGithub = formatSocialUrl(ghUsername, 'github');
  const formattedTwitter = formatSocialUrl(input.twitterUrl, 'twitter');
  const formattedFacebook = formatSocialUrl(input.facebookUrl, 'facebook');
  const formattedInstagram = formatSocialUrl(input.instagramUrl, 'instagram');
  const formattedYoutube = formatSocialUrl(input.youtubeUrl, 'youtube');
  const formattedLinkedin = formatSocialUrl(input.linkedinUrl, 'linkedin');

  const citizenPayload: any = {
    id: citizenId,
    session_token_hash: tokenHash,
    display_name: input.displayName.trim(),
    avatar_id: input.avatarId,
    custom_avatar_data: input.customAvatarData || null,
    tagline: input.tagline?.trim() || null,
    website_url: formattedWebsite || null,
    github_url: formattedGithub || null,
    twitter_url: formattedTwitter || null,
    facebook_url: formattedFacebook || null,
    instagram_url: formattedInstagram || null,
    youtube_url: formattedYoutube || null,
    linkedin_url: formattedLinkedin || null,
    updated_at: new Date().toISOString(),
  };
  if (clientIp) citizenPayload.ip_address = clientIp;
  if (deviceFp) citizenPayload.device_fingerprint = deviceFp;

  let { data: citizenData, error: citErr } = await supabase
    .from('citizens')
    .upsert(citizenPayload)
    .select()
    .single();

  if (citErr && isColumnMissingError(citErr)) {
    // Retry omitting non-essential custom columns if migration hasn't been run yet
    delete citizenPayload.ip_address;
    delete citizenPayload.device_fingerprint;
    delete citizenPayload.custom_avatar_data;
    delete citizenPayload.twitter_url;
    delete citizenPayload.facebook_url;
    delete citizenPayload.instagram_url;
    delete citizenPayload.youtube_url;
    delete citizenPayload.linkedin_url;
    const retry = await supabase
      .from('citizens')
      .upsert(citizenPayload)
      .select()
      .single();
    citizenData = retry.data;
    citErr = retry.error;
  }

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
    customAvatarData: citizenData.custom_avatar_data || undefined,
    tagline: citizenData.tagline || undefined,
    websiteUrl: citizenData.website_url || undefined,
    githubUrl: citizenData.github_url || undefined,
    twitterUrl: citizenData.twitter_url || undefined,
    facebookUrl: citizenData.facebook_url || undefined,
    instagramUrl: citizenData.instagram_url || undefined,
    youtubeUrl: citizenData.youtube_url || undefined,
    linkedinUrl: citizenData.linkedin_url || undefined,
    isVerified: Boolean(citizenData.github_id || citizenData.is_verified || (citizenData.github_url && citizenData.github_url.trim().length > 0)),
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

  const updatePayload: any = {
    display_name: profile.displayName || session.citizen.displayName,
    avatar_id: profile.avatarId || session.citizen.avatarId,
    custom_avatar_data: profile.customAvatarData !== undefined ? profile.customAvatarData : (session.citizen as any).customAvatarData || null,
    tagline: profile.tagline !== undefined ? profile.tagline : session.citizen.tagline,
    website_url: profile.websiteUrl !== undefined ? formatSocialUrl(profile.websiteUrl, 'website') : session.citizen.websiteUrl,
    github_url: profile.githubUrl !== undefined ? formatSocialUrl(profile.githubUrl, 'github') : session.citizen.githubUrl,
    twitter_url: profile.twitterUrl !== undefined ? formatSocialUrl(profile.twitterUrl, 'twitter') : session.citizen.twitterUrl,
    facebook_url: profile.facebookUrl !== undefined ? formatSocialUrl(profile.facebookUrl, 'facebook') : (session.citizen as any).facebookUrl,
    instagram_url: profile.instagramUrl !== undefined ? formatSocialUrl(profile.instagramUrl, 'instagram') : session.citizen.instagramUrl,
    youtube_url: profile.youtubeUrl !== undefined ? formatSocialUrl(profile.youtubeUrl, 'youtube') : session.citizen.youtubeUrl,
    linkedin_url: profile.linkedinUrl !== undefined ? formatSocialUrl(profile.linkedinUrl, 'linkedin') : session.citizen.linkedinUrl,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('citizens')
    .update(updatePayload)
    .eq('id', session.citizen.id)
    .select()
    .single();

  if (error && isColumnMissingError(error)) {
    delete updatePayload.custom_avatar_data;
    delete updatePayload.twitter_url;
    delete updatePayload.facebook_url;
    delete updatePayload.instagram_url;
    delete updatePayload.youtube_url;
    delete updatePayload.linkedin_url;
    const retry = await supabase
      .from('citizens')
      .update(updatePayload)
      .eq('id', session.citizen.id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  return {
    success: true,
    citizen: {
      id: data.id,
      displayName: data.display_name,
      avatarId: data.avatar_id,
      customAvatarData: data.custom_avatar_data || undefined,
      tagline: data.tagline || undefined,
      websiteUrl: data.website_url || undefined,
      githubUrl: data.github_url || undefined,
      twitterUrl: data.twitter_url || undefined,
      facebookUrl: data.facebook_url || undefined,
      instagramUrl: data.instagram_url || undefined,
      youtubeUrl: data.youtube_url || undefined,
      linkedinUrl: data.linkedin_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * DIRECT SUPABASE MODE: Delete account and release spot directly in Supabase
 */
export async function deleteAccountDirect(targetSpotId?: string, targetCitizenId?: string): Promise<{ success: boolean; message: string }> {
  const session = await fetchSessionDirect();
  const user = await getSupabaseUser();
  const deviceFp = await getDeviceFingerprint();
  const savedCitId = typeof window !== 'undefined' ? localStorage.getItem('spot_citizen_id') : null;
  const savedToken = typeof window !== 'undefined' ? localStorage.getItem('spot_session_token') : null;

  let ownerCitizenId: string | null = null;
  if (session.citizen) {
    ownerCitizenId = session.citizen.id;
  }

  const citizenToDelete = targetCitizenId || ownerCitizenId || savedCitId;
  if (!citizenToDelete) {
    throw new Error('Unauthorized: No active session or owned spot found.');
  }

  // Fetch the target citizen record to verify ownership proof
  const { data: citRecord } = await supabase
    .from('citizens')
    .select('*')
    .eq('id', citizenToDelete)
    .maybeSingle();

  if (!citRecord) {
    throw new Error('Citizen record not found.');
  }

  // STRICT OWNERSHIP VERIFICATION
  let isAuthorized = false;

  // 1. Check if logged in user owns this record (via GitHub id, email, or username)
  if (user) {
    const ghUser = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (
      (citRecord.github_id && citRecord.github_id === user.id) ||
      (citRecord.email && citRecord.email.toLowerCase() === (user.email || '').toLowerCase()) ||
      (ghUser && citRecord.github_url && citRecord.github_url.toLowerCase() === ghUser.toLowerCase()) ||
      (citRecord.id === `c_${user.id.replace(/-/g, '').substring(0, 24)}`)
    ) {
      isAuthorized = true;
    }
  }

  // 2. Check if guest session token, citizen ID, or device fingerprint matches
  if (!isAuthorized) {
    if (savedCitId && savedCitId === citRecord.id) isAuthorized = true;
    if (savedToken && savedToken === citRecord.session_token_hash) isAuthorized = true;
    if (deviceFp && citRecord.device_fingerprint && citRecord.device_fingerprint === deviceFp) isAuthorized = true;
  }

  if (!isAuthorized) {
    throw new Error('Unauthorized: You can only delete your own spot and profile!');
  }

  // Perform deletion
  await supabase.from('spots').update({ owner_id: null, claimed_at: null }).eq('owner_id', citRecord.id);
  if (targetSpotId) {
    await supabase.from('spots').update({ owner_id: null, claimed_at: null }).eq('id', targetSpotId);
  }
  await supabase.from('citizens').delete().eq('id', citRecord.id);

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
