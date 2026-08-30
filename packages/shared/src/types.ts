/**
 * Core domain types for Spot
 */

export interface MySessionResponse {
  authenticated: boolean;
  success?: boolean;
  citizen: Citizen | null;
  ownedSpot: {
    id: string;
    x: number;
    y: number;
    claimedAt: string;
  } | null;
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface Spot {
  id: string; // e.g. "42,17"
  x: number;
  y: number;
  ownerId: string | null;
  claimedAt?: string | null;
}

export interface Citizen {
  id: string;
  displayName: string;
  username?: string;
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
  createdAt: string;
  updatedAt?: string;
}

export interface OccupiedSpotSummary {
  spotId: string;
  x: number;
  y: number;
  citizenId: string;
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
  isOnline?: boolean;
}

export interface WorldConfig {
  width: number;
  height: number;
  spotSize: number; // in world units (px)
  spotGap: number;  // in world units (px)
}

export interface WorldSnapshot {
  width: number;
  height: number;
  totalSpots: number;
  claimedCount: number;
  totalVisitors?: number;
  onlineCount: number;
  occupied: OccupiedSpotSummary[];
}

export interface AvatarDefinition {
  id: string;
  name: string;
  category: 'pixel' | 'retro' | 'geek' | 'creature';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    skin?: string;
  };
  pattern: number[][]; // 8x8 or 16x16 matrix representation
}
