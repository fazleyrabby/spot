/**
 * WorldBannerManager — High-Prestige Cyber Billboard Network across Spot World.
 * 20 carefully curated prime landmark placements across public highways, mountain peaks,
 * grand plaza gates, and coastal boardwalks — with zero residential plot obstruction.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@spot/world';

export interface WorldBanner {
  id: string;
  name: string;
  district: string;
  gx: number;
  gy: number;
  pixelWidth: number;
  pixelHeight: number;
  tag: string;
  headline: string;
  subtext: string;
  statusText: string;
  accentColor: string;
  lightColor: string;
  lightRadius: number;
  description: string;
  targetUrl?: string;
  bannerImageUrl?: string;
  buyerName?: string;
  citizen?: SponsorCitizen | null;
  isSponsored?: boolean;
  expiresAt?: string;
}

export interface SponsorCitizen {
  id: string;
  displayName: string;
  avatarId?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  githubUrl?: string;
  spot?: { x: number; y: number } | null;
}

export const WORLD_BANNERS: WorldBanner[] = [
  // ── 0. Grand Founder & Architect Monument (Overlooking Grand Central Hub) ─
  {
    id: 'banner_founder_showcase',
    name: 'SPOT Founder HQ & Architect Showcase',
    district: 'Grand Central Plaza • Founder Promenade',
    gx: 50,
    gy: 42,
    pixelWidth: 168,
    pixelHeight: 76,
    tag: 'FOUNDER & ARCHITECT',
    headline: 'MD FAZLEY RABBI',
    subtext: 'Creator of SPOT • Backend & Distributed Systems Engineer',
    statusText: 'Architect Showcase • fazleyrabbi.xyz',
    targetUrl: 'https://fazleyrabbi.xyz',
    bannerImageUrl: 'https://fazleyrabbi.xyz/og.png',
    buyerName: 'Fazley Rabbi (Founder)',
    accentColor: '#00f0ff',
    lightColor: 'rgba(0, 240, 255, 0.45)',
    lightRadius: 130,
    description: 'The monumental flagship jumbotron of SPOT World. Showcasing the founder portfolio and open engineering architecture. Built to welcome tech builders, SaaS partners, and potential sponsors.',
    isSponsored: true,
  },

  // ── 1. Northern Alpine Peaks & Summits (gy < 0) ──────────────────────────
  {
    id: 'banner_alpine_west',
    name: 'West Granite Summit Megaboard',
    district: 'Northern Alpine Ridge',
    gx: 16,
    gy: -5,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'SUMMIT MEGABOARD',
    headline: 'COMING SOON...',
    subtext: 'High-Altitude Showcase • Reserve Space',
    statusText: 'Alpine Summit • Coming Soon',
    accentColor: '#38bdf8',
    lightColor: 'rgba(56, 189, 248, 0.35)',
    lightRadius: 95,
    description: 'Towering digital megaboard anchored on the western granite peaks. Overlooks the entire northern valley and approaching bullet train.',
  },
  {
    id: 'banner_glacier_overlook',
    name: 'Glacier Overlook Jumbotron',
    district: 'Northern Alpine Ridge',
    gx: 38,
    gy: -6,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'SUMMIT DISPLAY',
    headline: 'YOUR LOGO HERE',
    subtext: 'Peak Visibility • Coming Soon',
    statusText: 'Glacier Peak • Coming Soon',
    accentColor: '#00f0ff',
    lightColor: 'rgba(0, 240, 255, 0.35)',
    lightRadius: 95,
    description: 'Mounted directly onto the central snow crags with full panoramic line of sight over the northern metropolitan borders.',
  },
  {
    id: 'banner_alpine_crest',
    name: 'Alpine Ridge Crest Billboard',
    district: 'Northern Alpine Ridge',
    gx: 62,
    gy: -5,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'PEAK SHOWCASE',
    headline: 'COMING SOON...',
    subtext: 'High-Altitude Sponsor Space',
    statusText: 'Ridge Crest • Coming Soon',
    accentColor: '#fbbf24',
    lightColor: 'rgba(251, 191, 36, 0.35)',
    lightRadius: 95,
    description: 'Perched along the high evergreen tree line, catching the morning sunrise above the railway overpass.',
  },
  {
    id: 'banner_pine_summit',
    name: 'Eastern Pine Summit Megaboard',
    district: 'Pine Crest Overlook',
    gx: 84,
    gy: -6,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'SUMMIT MEGABOARD',
    headline: 'RESERVE BILLBOARD',
    subtext: 'Developer & Web3 Hub Space',
    statusText: 'Pine Summit • Coming Soon',
    accentColor: '#10b981',
    lightColor: 'rgba(16, 185, 129, 0.35)',
    lightRadius: 95,
    description: 'Flanked by towering alpine pines with dramatic visibility over the eastern rail switchbacks.',
  },

  // ── 2. High-Speed Bullet Rail Corridor (gy: 0 .. 2) ──────────────────────
  {
    id: 'banner_rail_west',
    name: 'West Rail Gantry Billboard',
    district: 'Northern Rail Corridor',
    gx: 20,
    gy: 1,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'RAILWAY GANTRY',
    headline: 'COMING SOON...',
    subtext: 'High-Speed Transit Sponsorship',
    statusText: 'Transit Hub • Coming Soon',
    accentColor: '#38bdf8',
    lightColor: 'rgba(56, 189, 248, 0.35)',
    lightRadius: 90,
    description: 'High-impact overhead rail gantry billboard spanning the westbound bullet train track.',
  },
  {
    id: 'banner_rail_center',
    name: 'Central Viaduct Holo-Screen',
    district: 'Northern Rail Corridor',
    gx: 50,
    gy: 1,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'TRANSIT MEGABOARD',
    headline: 'YOUR AD HERE',
    subtext: 'Reach 10,000+ Transit Commuters',
    statusText: 'Central Rail • Coming Soon',
    accentColor: '#f59e0b',
    lightColor: 'rgba(245, 158, 11, 0.38)',
    lightRadius: 95,
    description: 'Positioned above the central railway station crossing, seen by every passenger and visitor traveling through the city core.',
  },
  {
    id: 'banner_rail_east',
    name: 'East Sky-Truss Rail Billboard',
    district: 'Northern Rail Corridor',
    gx: 80,
    gy: 1,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'TECH SHOWCASE',
    headline: 'COMING SOON...',
    subtext: 'Developer Tool / SaaS Showcase',
    statusText: 'Overlook Placement • Coming Soon',
    accentColor: '#10b981',
    lightColor: 'rgba(16, 185, 129, 0.35)',
    lightRadius: 90,
    description: 'Anchored directly above the eastern express viaduct with luminous green neon accents.',
  },

  // ── 3. Grand Central Plaza Gates & Perimeters ─────────────────────────────
  {
    id: 'banner_plaza_nw',
    name: 'Grand Plaza North Gateway',
    district: 'Grand Central Plaza',
    gx: 44,
    gy: 46,
    pixelWidth: 148,
    pixelHeight: 66,
    tag: 'PRIME SPONSOR SPACE',
    headline: 'COMING SOON...',
    subtext: 'Featured Project / Brand Space',
    statusText: 'Reservation Available Soon',
    accentColor: '#f59e0b',
    lightColor: 'rgba(245, 158, 11, 0.40)',
    lightRadius: 100,
    description: 'High-traffic digital billboard marking the northern entrance to Grand Central Plaza spawn hub.',
  },
  {
    id: 'banner_plaza_ne',
    name: 'Grand Plaza East Promenade Screen',
    district: 'Grand Central Plaza',
    gx: 56,
    gy: 46,
    pixelWidth: 148,
    pixelHeight: 66,
    tag: 'PRIME SPONSOR SPACE',
    headline: 'YOUR AD HERE',
    subtext: 'Overlooking Central Fountain Hub',
    statusText: 'Plaza Prime • Coming Soon',
    accentColor: '#00f0ff',
    lightColor: 'rgba(0, 240, 255, 0.38)',
    lightRadius: 100,
    description: 'Framing the northeastern corner of the spawn plaza, greeting all newly arriving digital citizens.',
  },
  {
    id: 'banner_plaza_south',
    name: 'Grand Plaza South Boulevard Screen',
    district: 'Grand Central Plaza',
    gx: 50,
    gy: 56,
    pixelWidth: 148,
    pixelHeight: 66,
    tag: 'GLOBAL BANNER',
    headline: 'FEATURE YOUR APP',
    subtext: 'Core Metropolitan Placement',
    statusText: 'Plaza South • Coming Soon',
    accentColor: '#c084fc',
    lightColor: 'rgba(192, 132, 252, 0.38)',
    lightRadius: 100,
    description: 'Positioned along the main southern avenue connecting Grand Central Plaza to the coastal districts.',
  },

  // ── 4. Downtown Cyber District Intersections (5 Prime Spots) ─────────────
  {
    id: 'banner_cyber_ave14',
    name: 'Avenue 14 Tech Corridor Billboard',
    district: 'Downtown Cyber District',
    gx: 14,
    gy: 20,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'SPONSOR SPOT',
    headline: 'YOUR AD HERE',
    subtext: 'Reach 10,000+ Builders',
    statusText: 'Tech Corridor • Coming Soon',
    accentColor: '#00f0ff',
    lightColor: 'rgba(0, 240, 255, 0.38)',
    lightRadius: 95,
    description: 'Towering over the tech corridor intersection in the Cyber District. Ideal for dev tools, APIs, and cloud services.',
  },
  {
    id: 'banner_cyber_neon_way',
    name: 'Neon Way North Gantry',
    district: 'Downtown Cyber District',
    gx: 20,
    gy: 12,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'HIGHWAY GANTRY',
    headline: 'BUILD ON SPOT',
    subtext: 'High-Speed Tech Arterial Display',
    statusText: 'Neon Way • Coming Soon',
    accentColor: '#ec4899',
    lightColor: 'rgba(236, 72, 153, 0.38)',
    lightRadius: 95,
    description: 'Elevated highway gantry spanning the busy northbound avenue connecting the cyber high-rises to the northern bullet rail.',
  },
  {
    id: 'banner_cyber_junction',
    name: 'Cyber Tower Junction Billboard',
    district: 'Downtown Cyber District',
    gx: 28,
    gy: 28,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'DEV TOOL SHOWCASE',
    headline: 'COMING SOON...',
    subtext: 'Featured Startup Placement',
    statusText: 'Cyber Junction • Coming Soon',
    accentColor: '#a3e635',
    lightColor: 'rgba(163, 230, 53, 0.35)',
    lightRadius: 95,
    description: 'Positioned at the bustling crossroads between the neon high-rises and the central district boundary.',
  },
  {
    id: 'banner_cyber_skyline',
    name: 'West Downtown Skyline Overpass',
    district: 'Downtown Cyber District',
    gx: 18,
    gy: 36,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'PARTNER TAKEOVER',
    headline: 'BRAND TAKEOVER',
    subtext: 'Exclusive Billboard Placement',
    statusText: 'Skyline Overpass • Coming Soon',
    accentColor: '#c084fc',
    lightColor: 'rgba(192, 132, 252, 0.35)',
    lightRadius: 95,
    description: 'Illuminating the western avenue with radiant violet scanlines and prominent branding space.',
  },
  {
    id: 'banner_cyber_metro_hub',
    name: 'East Metro Gateway Jumbotron',
    district: 'Downtown Cyber District',
    gx: 35,
    gy: 20,
    pixelWidth: 122,
    pixelHeight: 54,
    tag: 'METRO GATEWAY',
    headline: 'PROMOTE YOUR APP',
    subtext: 'Downtown East Corridor • High Visibility',
    statusText: 'Metro Hub • Coming Soon',
    accentColor: '#06b6d4',
    lightColor: 'rgba(6, 182, 212, 0.38)',
    lightRadius: 95,
    description: 'High-traffic gateway jumbotron greeting travelers moving between the Downtown Cyber District and Grand Central Plaza.',
  },

  // ── 5. Central Park & Zen Enclaves ────────────────────────────────────────
  {
    id: 'banner_park_lakeview',
    name: 'Lakeside Park Digital Totem',
    district: 'Central Park Lake & Grove',
    gx: 74,
    gy: 14,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'PARK DISPLAY',
    headline: 'COMING SOON...',
    subtext: 'Peaceful Lakeside Showcase',
    statusText: 'Park Promenade • Coming Soon',
    accentColor: '#10b981',
    lightColor: 'rgba(16, 185, 129, 0.35)',
    lightRadius: 90,
    description: 'Set gracefully along the perimeter of Central Park Lake, blending high-tech digital glass with lush green surroundings.',
  },
  {
    id: 'banner_zen_pavilion',
    name: 'Zen Gardens Pavilion Screen',
    district: 'Zen Bamboo Gardens',
    gx: 76,
    gy: 70,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'ZEN DISPLAY',
    headline: 'YOUR BRAND HERE',
    subtext: 'Minimalist Tech Placement',
    statusText: 'Zen Enclave • Coming Soon',
    accentColor: '#fbbf24',
    lightColor: 'rgba(251, 191, 36, 0.35)',
    lightRadius: 90,
    description: 'A sleek, minimalist digital screen situated at the northern entrance to the tranquil bamboo gardens.',
  },

  // ── 6. Coastal Timber Boardwalk & Moonlit Beach ───────────────────────────
  {
    id: 'banner_boardwalk_pier',
    name: 'Grand Ocean Pier Jumbotron',
    district: 'Coastal Boardwalk & Pier',
    gx: 50,
    gy: 99,
    pixelWidth: 148,
    pixelHeight: 66,
    tag: 'GLOBAL BANNER',
    headline: 'SPONSOR SPOT',
    subtext: 'Company Takeover Coming Soon',
    statusText: 'Beachfront Jumbotron • Coming Soon',
    accentColor: '#c084fc',
    lightColor: 'rgba(192, 132, 252, 0.38)',
    lightRadius: 100,
    description: 'Commanding beachfront jumbotron positioned right at the entrance of the southern timber boardwalk.',
  },
  {
    id: 'banner_beach_west',
    name: 'West Sunset Dunes Billboard',
    district: 'Moonlit Sunset Beach',
    gx: 24,
    gy: 104,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'BEACHFRONT DISPLAY',
    headline: 'COMING SOON...',
    subtext: 'Coastal Exposure • Reserve Space',
    statusText: 'Sunset Sands • Coming Soon',
    accentColor: '#fb7185',
    lightColor: 'rgba(251, 113, 133, 0.35)',
    lightRadius: 95,
    description: 'Glowing seaside billboard anchored into the western dunes, facing the gentle bioluminescent surf.',
  },
  {
    id: 'banner_beach_east',
    name: 'East Surfside Palms Jumbotron',
    district: 'Eastern Surf & Palms',
    gx: 76,
    gy: 104,
    pixelWidth: 102,
    pixelHeight: 46,
    tag: 'SURFSIDE SPONSOR',
    headline: 'BRAND TAKEOVER',
    subtext: 'Beach Crowd Sponsor • Coming Soon',
    statusText: 'Tropical Palms • Coming Soon',
    accentColor: '#2dd4bf',
    lightColor: 'rgba(45, 212, 191, 0.35)',
    lightRadius: 95,
    description: 'Flanked by swaying coastal palms and beach loungers, catching the eye of every visitor enjoying the beach bonfire.',
  },
];

// ── Spatial Map for O(1) Instant Lookup ──────────────────────────────────────
const bannerSpatialMap = new Map<string, WorldBanner>();
for (const b of WORLD_BANNERS) {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const key = `${b.gx + dx},${b.gy + dy}`;
      if (!bannerSpatialMap.has(key)) {
        bannerSpatialMap.set(key, b);
      }
    }
  }
}

/**
 * Find banner by grid coordinates (O(1) Spatial Map lookup within 3 tiles).
 */
export function getBannerAt(gx: number, gy: number): WorldBanner | null {
  return bannerSpatialMap.get(`${gx},${gy}`) ?? null;
}

/**
 * Hit test a world-space point (wx, wy) against all banners.
 */
export function hitTestBanner(wx: number, wy: number): WorldBanner | null {
  const gx = Math.floor(wx / TILE_WIDTH);
  const gy = Math.floor(wy / TILE_HEIGHT);
  const candidate = bannerSpatialMap.get(`${gx},${gy}`);
  if (!candidate) return null;

  const bannerWx = candidate.gx * TILE_WIDTH + TILE_WIDTH / 2;
  const bannerWy = candidate.gy * TILE_HEIGHT + TILE_HEIGHT / 2;
  const halfW = candidate.pixelWidth / 2;
  const poleH = 30;
  const topWy = bannerWy - (poleH + candidate.pixelHeight + 6);
  const bottomWy = bannerWy + 6;

  if (
    wx >= bannerWx - halfW - 4 &&
    wx <= bannerWx + halfW + 4 &&
    wy >= topWy &&
    wy <= bottomWy
  ) {
    return candidate;
  }

  return null;
}

export interface ActiveSponsorshipRecord {
  billboard_id: string;
  billboard_name?: string;
  headline: string;
  subtext?: string;
  target_url?: string;
  banner_image_url?: string;
  brand_color?: string;
  buyer_name?: string;
  status?: string;
  expires_at?: string;
  citizen?: SponsorCitizen | null;
}

/**
 * Dynamically skins the world billboards with active sponsorships fetched from the database.
 */
export function applyActiveSponsorships(activeRecords: ActiveSponsorshipRecord[]): void {
  if (!Array.isArray(activeRecords)) return;

  for (const record of activeRecords) {
    const banner = WORLD_BANNERS.find((b) => b.id === record.billboard_id);
    if (!banner) continue;

    if (record.headline) {
      banner.headline = record.headline.trim().toUpperCase();
    }
    if (record.subtext) {
      banner.subtext = record.subtext.trim();
    }
    banner.tag = 'FEATURED SPONSOR';
    banner.statusText = record.buyer_name ? `Sponsored by ${record.buyer_name}` : 'Active Sponsor';
    banner.targetUrl = record.target_url || undefined;
    banner.bannerImageUrl = record.banner_image_url || undefined;
    banner.buyerName = record.buyer_name || undefined;
    banner.citizen = record.citizen || null;
    banner.isSponsored = true;
    banner.expiresAt = record.expires_at || undefined;

    if (record.brand_color && record.brand_color.startsWith('#')) {
      banner.accentColor = record.brand_color;
      banner.lightColor = `rgba(${parseInt(record.brand_color.slice(1, 3), 16) || 0}, ${
        parseInt(record.brand_color.slice(3, 5), 16) || 240
      }, ${parseInt(record.brand_color.slice(5, 7), 16) || 255}, 0.40)`;
    }
  }
}

