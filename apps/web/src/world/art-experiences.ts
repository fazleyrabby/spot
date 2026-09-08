/**
 * ArtExperiences — Fullscreen iframe "experiences" embedded from
 * art.fazleyrabbi.xyz. Each entry is a world prop that, when clicked,
 * opens the referenced generative art as a clean fullscreen view
 * (no extra chrome, just a close button).
 */

export interface ArtExperience {
  id: string;
  /** CityProp draw type used to render the in-world trigger object. */
  propType: 'sunset_arch' | 'dive_sign';
  gx: number;
  gy: number;
  /** Embed path on art.fazleyrabbi.xyz (e.g. "crepuscular-sunset-rays"). */
  slug: string;
  title: string;
  caption: string;
  /** Hover/click hint shown when the player is near. */
  hint: string;
  /** Whether the trigger sits in water (dive sign) — affects hint styling. */
  underwater?: boolean;
}

export const ART_EXPERIENCES: ArtExperience[] = [
  {
    id: 'sunset_rays',
    propType: 'sunset_arch',
    gx: 6,
    gy: 105,
    slug: 'crepuscular-sunset-rays',
    title: 'Crepuscular Sunset Rays',
    caption: 'Golden rays over the horizon',
    hint: '⛩ Watch the sunset',
  },
  {
    id: 'ocean_dive',
    propType: 'dive_sign',
    gx: 46,
    gy: 107,
    slug: 'underwater-oceanic-sunbeams',
    title: 'Underwater Oceanic Sunbeams',
    caption: 'Descend beneath the waves',
    hint: '🌊 Dive',
    underwater: true,
  },
];

export function getArtExperienceAt(gx: number, gy: number): ArtExperience | null {
  return ART_EXPERIENCES.find((e) => e.gx === gx && e.gy === gy) ?? null;
}

/** World-pixel center of an experience prop (base of the prop on its tile). */
export function artExperienceCenter(exp: ArtExperience): { wx: number; wy: number } {
  return { wx: exp.gx * 48 + 24, wy: exp.gy * 32 + 16 };
}

/**
 * Radial hit test in world pixels. Props like the dive signpost / sunset arch
 * extend well above their base tile, so we test distance to the prop's anchor
 * rather than requiring the exact tile — making the whole visible prop
 * (including the arrow and signboard) clickable.
 */
export function getArtExperienceNear(
  wx: number,
  wy: number,
  radius = 56,
): ArtExperience | null {
  for (const exp of ART_EXPERIENCES) {
    const c = artExperienceCenter(exp);
    if (Math.hypot(wx - c.wx, wy - c.wy) <= radius) return exp;
  }
  return null;
}

export function artEmbedUrl(slug: string): string {
  return `https://art.fazleyrabbi.xyz/embed/${slug}`;
}
