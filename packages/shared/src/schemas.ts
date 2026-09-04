import { z } from 'zod';
import {
  PROHIBITED_CRYPTO_TERMS,
  PROHIBITED_GAMBLING_TERMS,
  PROHIBITED_ALCOHOL_DRUG_TERMS,
  PROHIBITED_ADULT_NSFW_TERMS,
} from './moderation.js';

// Robust profanity, slurs, and hate-speech blocklist
export const BLOCKED_WORDS = [
  // Profanities & Vulgarities
  'fuck', 'fucker', 'fucking', 'fuk', 'fucc', 'fck', 'fuxk',
  'shit', 'shite', 'sh!t', 'bullshit', 'shitty',
  'bitch', 'b!tch', 'bitches', 'bastard', 'asshole', 'a$$hole', 'a$$', 'asshat', 'asswipe',
  'dick', 'd!ck', 'dickhead', 'cock', 'c0ck', 'pussy', 'pussies', 'cunt', 'c*nt',
  'slut', 'sluts', 'whore', 'whores', 'motherfucker', 'douche', 'douchebag',
  'jackass', 'prick', 'twat', 'wanker',

  // Hate Speech & Slurs
  'nigger', 'nigga', 'n1gger', 'n1gga', 'chink', 'gook', 'kike', 'kyke',
  'spic', 'faggot', 'fag', 'f@g', 'f@ggot', 'dyke', 'tranny', 'retard',
  'retarded', 'pedophile', 'pedo', 'hitler', 'nazi', 'terrorist',
];

export const ALL_RESTRICTED_TERMS = [
  ...BLOCKED_WORDS,
  ...PROHIBITED_CRYPTO_TERMS,
  ...PROHIBITED_GAMBLING_TERMS,
  ...PROHIBITED_ALCOHOL_DRUG_TERMS,
  ...PROHIBITED_ADULT_NSFW_TERMS,
];

/**
 * Normalizes l33tspeak, zero-width characters, and spaced-out letters.
 * e.g., "f.u.c.k" -> "fuck", "b!tch" -> "bitch", "a$$hole" -> "asshole"
 */
function normalizeText(text: string): string {
  let s = text.toLowerCase();
  // Remove zero-width spaces and soft hyphens
  s = s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  // Common character substitutions
  s = s.replace(/[@]/g, 'a')
       .replace(/[$]/g, 's')
       .replace(/[!|1]/g, 'i')
       .replace(/[0]/g, 'o')
       .replace(/[3]/g, 'e')
       .replace(/[5]/g, 's')
       .replace(/[+]/g, 't')
       .replace(/[*_~`]/g, '');
  return s;
}

export function containsBlockedWord(text?: string | null): boolean {
  if (!text) return false;
  const rawLower = text.toLowerCase();
  const normalized = normalizeText(text);

  // Check against raw and normalized strings across all restricted lists
  for (const w of ALL_RESTRICTED_TERMS) {
    const wordPattern = w.toLowerCase();

    // 1. Direct word boundary match
    const re1 = new RegExp(`\\b${escapeRegExp(wordPattern)}\\b`, 'i');
    if (re1.test(rawLower) || re1.test(normalized)) {
      return true;
    }

    // 2. Continuous substring match for longer words
    if (wordPattern.length >= 4 && (rawLower.includes(wordPattern) || normalized.includes(wordPattern))) {
      return true;
    }

    // 3. Spaced-out / dotted bypass check (e.g. "f u c k" or "f.u.c.k")
    const spacedPattern = wordPattern.split('').map(escapeRegExp).join('[\\s._-]*');
    const reSpaced = new RegExp(`\\b${spacedPattern}\\b`, 'i');
    if (reSpaced.test(rawLower) || reSpaced.test(normalized)) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Censors blocked words with asterisks
export function censorProfanity(text: string): string {
  let clean = text;
  for (const w of BLOCKED_WORDS) {
    const spacedPattern = w.split('').map(escapeRegExp).join('[\\s._-]*');
    const re = new RegExp(`\\b${spacedPattern}\\b`, 'gi');
    clean = clean.replace(re, (m) => '*'.repeat(m.length));
  }
  return clean;
}

// Replace blocked words with asterisks of the same length; fall back to "Citizen"
export function sanitizeDisplayName(name: string): string {
  let clean = censorProfanity(name.trim());
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  return (clean.slice(0, 32) || 'Citizen').trim();
}

/**
 * Validates external URLs to strictly permit only http: and https: protocols,
 * preventing javascript:, data:, or vbscript: XSS vectors.
 */
export const SafeUrlSchema = z
  .string()
  .max(256, 'URL must not exceed 256 characters')
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) return false;
      try {
        const testUrl = val.includes('://') ? val : `https://${val}`;
        const parsed = new URL(testUrl);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use a valid http:// or https:// scheme' }
  )
  .optional()
  .or(z.literal(''));

/** Allows social handles (e.g. @username, username) or full http/https URLs. */
export const SafeSocialUrlSchema = z
  .string()
  .max(128, 'Social link must not exceed 128 characters')
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('javascript:') || val.startsWith('data:') || val.startsWith('vbscript:')) return false;
      if (!val.includes('://')) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Social handle or URL must use a valid scheme' }
  )
  .optional()
  .or(z.literal(''));

export const CreateCitizenSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(32, 'Display name must not exceed 32 characters')
    .trim(),
  avatarId: z
    .string()
    .min(1, 'Avatar selection is required')
    .max(32, 'Avatar ID must not exceed 32 characters')
    .trim(),
  customAvatarData: z
    .string()
    .max(65536)
    .refine(
      (val) => !val || val.startsWith('data:image/') || val.startsWith('{'),
      { message: 'customAvatarData must be a data URI (data:image/...) or a JSON pixel map' }
    )
    .optional()
    .or(z.literal('')),
  tagline: z
    .string()
    .max(80, 'Tagline must not exceed 80 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  bio: z.string().max(280, 'Bio must not exceed 280 characters').trim().optional().or(z.literal('')),
  websiteUrl: SafeUrlSchema,
  // Social URL fields: enforce http/https to block javascript: / data: XSS vectors
  githubUrl: SafeSocialUrlSchema,
  twitterUrl: SafeSocialUrlSchema,
  facebookUrl: SafeSocialUrlSchema,
  instagramUrl: SafeSocialUrlSchema,
  youtubeUrl: SafeSocialUrlSchema,
  linkedinUrl: SafeUrlSchema,
  githubId: z.string().max(64).optional(),
  email: z.string().email().optional().or(z.literal('')),
  avatarUrl: z.string().url().max(512).optional().or(z.literal('')),
});

export const ClaimSpotSchema = z.object({
  spotId: z
    .string()
    .regex(/^\d{1,3},\d{1,3}$/, 'Spot ID must be in format x,y (e.g. "42,17")'),
  idempotencyKey: z
    .string()
    .uuid('Idempotency key must be a valid UUID')
    .optional(),
  // Optional citizen profile if claiming simultaneously on first visit
  citizen: CreateCitizenSchema.optional(),
});

export const UpdateCitizenSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name cannot be empty')
    .max(32, 'Display name must not exceed 32 characters')
    .trim()
    .optional(),
  avatarId: z
    .string()
    .min(1)
    .max(32)
    .trim()
    .optional(),
  customAvatarData: z
    .string()
    .max(65536)
    .refine(
      (val) => !val || val.startsWith('data:image/') || val.startsWith('{'),
      { message: 'customAvatarData must be a data URI (data:image/...) or a JSON pixel map' }
    )
    .optional()
    .or(z.literal('')),
  tagline: z
    .string()
    .max(80)
    .trim()
    .optional(),
  bio: z.string().max(280).trim().optional(),
  websiteUrl: SafeUrlSchema,
  // Social URL fields: enforce http/https to block javascript: / data: XSS vectors
  githubUrl: SafeSocialUrlSchema,
  twitterUrl: SafeSocialUrlSchema,
  facebookUrl: SafeSocialUrlSchema,
  instagramUrl: SafeSocialUrlSchema,
  youtubeUrl: SafeSocialUrlSchema,
  linkedinUrl: SafeUrlSchema,
});

export type CreateCitizenInput = z.infer<typeof CreateCitizenSchema>;
export type ClaimSpotInput = z.infer<typeof ClaimSpotSchema>;
export type UpdateCitizenInput = z.infer<typeof UpdateCitizenSchema>;
export type SafeSocialUrl = z.infer<typeof SafeSocialUrlSchema>;

/**
 * Normalizes a raw social handle, username, or URL into a fully qualified HTTPS URL.
 * e.g.:
 *   formatSocialUrl('@alrifatsabbir', 'instagram') -> 'https://instagram.com/alrifatsabbir'
 *   formatSocialUrl('alrifatsabbir', 'twitter')   -> 'https://x.com/alrifatsabbir'
 *   formatSocialUrl('alrifatsabbir.me', 'website') -> 'https://alrifatsabbir.me'
 */
export function formatSocialUrl(
  val?: string | null,
  platform?: 'twitter' | 'facebook' | 'instagram' | 'youtube' | 'github' | 'linkedin' | 'website'
): string | undefined {
  if (!val) return undefined;
  let clean = val.trim();
  if (!clean) return undefined;

  // Block pseudo-protocols
  const lower = clean.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return undefined;
  }

  // Already a full URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }

  // Strip leading @
  clean = clean.replace(/^@+/, '');

  switch (platform) {
    case 'twitter':
      if (clean.startsWith('x.com/') || clean.startsWith('twitter.com/')) {
        return `https://${clean}`;
      }
      return `https://x.com/${clean}`;

    case 'facebook':
      if (clean.startsWith('facebook.com/')) {
        return `https://${clean}`;
      }
      return `https://facebook.com/${clean}`;

    case 'instagram':
      if (clean.startsWith('instagram.com/')) {
        return `https://${clean}`;
      }
      return `https://instagram.com/${clean}`;

    case 'youtube':
      if (clean.startsWith('youtube.com/')) {
        return `https://${clean}`;
      }
      return clean.startsWith('UC') ? `https://youtube.com/channel/${clean}` : `https://youtube.com/@${clean}`;

    case 'github':
      if (clean.startsWith('github.com/')) {
        return `https://${clean}`;
      }
      return `https://github.com/${clean}`;

    case 'linkedin':
      if (clean.startsWith('linkedin.com/')) {
        return `https://${clean}`;
      }
      return clean.startsWith('in/') ? `https://linkedin.com/${clean}` : `https://linkedin.com/in/${clean}`;

    case 'website':
    default:
      return `https://${clean}`;
  }
}
