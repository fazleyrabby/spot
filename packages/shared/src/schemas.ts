import { z } from 'zod';

// Lightweight profanity blocklist — extend as needed or swap for a library like `bad-words`
export const BLOCKED_WORDS = [
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'bastard', 'asshole',
  'nigger', 'nigga', 'cunt', 'dick', 'pussy', 'slut', 'whore',
  'motherfucker', 'bullshit', 'douche',
];

export function containsBlockedWord(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => {
    const re = new RegExp(`\\b${w}\\b`, 'i');
    return re.test(lower) || (w.length > 4 && lower.includes(w));
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Replace blocked words with asterisks of the same length; fall back to "Citizen"
export function sanitizeDisplayName(name: string): string {
  let clean = name.trim();
  for (const w of BLOCKED_WORDS) {
    if (w.length >= 3) {
      const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'gi');
      clean = clean.replace(re, (m) => '*'.repeat(m.length));
    }
  }
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
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use a valid http:// or https:// scheme' }
  )
  .optional()
  .or(z.literal(''));

/** Same as SafeUrlSchema but capped at 128 characters for social handles / profile URLs. */
export const SafeSocialUrlSchema = z
  .string()
  .max(128, 'URL must not exceed 128 characters')
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use a valid http:// or https:// scheme' }
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
