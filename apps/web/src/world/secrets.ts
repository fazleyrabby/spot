/**
 * Easter Eggs, Hidden Landmarks, and Curated Resources in Spot World.
 */

export interface WorldSecret {
  id: string;
  name: string;
  district: string;
  icon: string;
  gx: number;
  gy: number;
  title: string;
  subtitle: string;
  description: string;
  category: 'lore' | 'resource' | 'interactive' | 'fun';
  actionLabel?: string;
  actionUrl?: string;
  quote?: string;
  reward?: string;
}

export const WORLD_SECRETS: WorldSecret[] = [
  {
    id: 'genesis_monolith',
    name: 'The Genesis Monolith',
    district: 'Central Park Grove',
    icon: '🪙',
    gx: 64,
    gy: 16,
    category: 'lore',
    title: 'Spot #0: The Genesis Lore',
    subtitle: 'Artifact from the first block',
    description:
      'In the beginning, there was an empty 100×100 grid. 10,000 permanent citizens will claim their territory in this shared universe. Every pixel, every brick, and every memory here is permanently preserved on the digital canvas.',
    reward: 'Genesis Explorer Badge Unlocked!',
    quote: '“Claim your place in history before the grid fills up.”',
  },
  {
    id: 'cyber_vending',
    name: '24/7 Cyber Vending Machine',
    district: 'Downtown Cyber District',
    icon: '🥤',
    gx: 18,
    gy: 24,
    category: 'interactive',
    title: 'Neon Cyber Vending Machine',
    subtitle: 'Dispensing coder elixirs & fortunes',
    description:
      'A glowing vending machine serving legendary developer drinks. Every time you insert a coin, you receive an energy boost and a fortune prediction for your next coding sprint.',
    actionLabel: 'Dispense Another Fortune',
    quote: '“Glitch Cola: +50 Coffee. Your next pull request will be approved without changes.”',
  },
  {
    id: 'dev_library',
    name: 'The Open Study Kiosk',
    district: 'Grand Central Plaza',
    icon: '📚',
    gx: 44,
    gy: 52,
    category: 'resource',
    title: 'Curated Developer & Builder Library',
    subtitle: 'Open-source study materials & roadmaps',
    description:
      'A public open-air library stocked with top-tier learning roadmaps, cheat sheets, and architectural guides curated for fullstack engineers, AI developers, and designers.',
    actionLabel: 'Explore Developer Roadmaps ↗',
    actionUrl: 'https://roadmap.sh',
    reward: 'Scholar Knowledge +100',
  },
  {
    id: 'mystic_duck',
    name: 'The Mystic Lake Duck',
    district: 'Central Park Lake',
    icon: '🦆',
    gx: 72,
    gy: 22,
    category: 'fun',
    title: 'Sir Quackington the Wise',
    subtitle: 'Guardian of the Central Waters',
    description:
      '“*QUACK!* 🦆 Looking for wisdom, traveler? Remember: 90% of complex code can be solved by taking a walk outside, drinking a glass of water, and pet-checking the cafe cat in the Promenade!”',
    quote: '“Quack softly, but carry a big git rebase.”',
    reward: 'Peace of Mind +50',
  },
  {
    id: 'cafe_cat',
    name: 'Midnight Whiskers',
    district: 'Cafe Promenade',
    icon: '🐱',
    gx: 22,
    gy: 70,
    category: 'fun',
    title: 'Midnight Whiskers the Cafe Cat',
    subtitle: 'Honorary Chief Cozy Officer',
    description:
      'Chilling peacefully on a velvet cafe chair under the amber streetlamp. When you give Whiskers a gentle ear scratch, you hear a deep mechanical purr resonating through the metaverse.',
    quote: '“Purrrrr... ❤️ (You feel an overwhelming sense of cozy warmth).”',
    reward: 'Cozy Blessing Active (Speed +10%)',
  },
  {
    id: 'zen_lantern',
    name: 'The Whispering Stone Lantern',
    district: 'Zen Garden',
    icon: '🏮',
    gx: 78,
    gy: 74,
    category: 'interactive',
    title: 'The Whispering Runestone',
    subtitle: 'Live Metaverse Pulse',
    description:
      'An ancient stone lantern that hums with the collective energy of all citizens. Touching the warm stone channels live world statistics directly into your mind.',
    quote: '“100×100 Universe • 10,000 Total Spots • 5 Living Districts • Infinite Possibilities.”',
    reward: 'Enlightenment Achieved!',
  },
];

export function getSecretAt(gx: number, gy: number): WorldSecret | null {
  for (const s of WORLD_SECRETS) {
    if (Math.abs(s.gx - gx) <= 1 && Math.abs(s.gy - gy) <= 1) {
      return s;
    }
  }
  return null;
}
