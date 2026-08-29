import { z } from 'zod';

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
  tagline: z
    .string()
    .max(80, 'Tagline must not exceed 80 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  websiteUrl: SafeUrlSchema,
  githubUrl: z
    .string()
    .max(64, 'GitHub handle must not exceed 64 characters')
    .trim()
    .optional()
    .or(z.literal('')),
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
  tagline: z
    .string()
    .max(80)
    .trim()
    .optional(),
  websiteUrl: SafeUrlSchema,
  githubUrl: z
    .string()
    .max(64)
    .trim()
    .optional(),
  linkedinUrl: SafeUrlSchema,
});

export type CreateCitizenInput = z.infer<typeof CreateCitizenSchema>;
export type ClaimSpotInput = z.infer<typeof ClaimSpotSchema>;
export type UpdateCitizenInput = z.infer<typeof UpdateCitizenSchema>;
