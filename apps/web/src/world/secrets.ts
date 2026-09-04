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
  clue: string; // Mystery riddle shown in Explorer Journal before discovery
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
    clue: 'In the lush park grove where the cyber train tracks sweep past, a golden pillar marks the birth of the grid.',
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
    clue: 'Tucked into the bustling neon alleys of Downtown, look for the humming machine dispensing Glitch Cola.',
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
    clue: 'Near the bustling center of the metropolis, wisdom awaits beneath open timber bookshelves.',
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
    clue: 'Bobbing gently along the northern waters of Central Park lake, a noble waterfowl quacks profound truths.',
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
    clue: 'Under the warm amber streetlamps of the Cafe Promenade, a sleeping feline purrs near freshly baked pastries.',
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
    clue: 'Surrounded by bamboo grove tranquility in the Zen quarter, a glowing paper lantern whispers the city pulse.',
    quote: '“100×100 Universe • 10,000 Total Spots • 5 Living Districts • Infinite Possibilities.”',
    reward: 'Enlightenment Achieved!',
  },
  {
    id: 'glitch_void',
    name: 'The Glitch Void Portal',
    district: 'Outer Fringe',
    icon: '🌌',
    gx: 98,
    gy: 98,
    category: 'lore',
    title: 'Sector 99: The Edge of Cyberspace',
    subtitle: 'Where reality breaks down into binary',
    description:
      'You stand at the absolute south-eastern corner of the digital universe. The grid coordinates tear into raw binary code and floating glowing matrix pixels.',
    clue: 'Journey to the absolute south-eastern corner of the known world, where the grid boundaries melt into the void.',
    quote: '“Beyond (99, 99), there is only undefined.”',
    reward: 'Void Walker Title Unlocked!',
  },
  {
    id: 'cyber_lighthouse',
    name: 'The Neon Coast Lighthouse',
    district: 'Southern Ocean Beach',
    icon: '🗼',
    gx: 4,
    gy: 94,
    category: 'interactive',
    title: 'Beacon of the Digital Coast',
    subtitle: 'Guiding oceanic packets safely home',
    description:
      'A majestic retro lighthouse perched on the rocky south-western headland. Its rotating neon cyan beam pierces through the night ocean fog.',
    clue: 'Follow the sandy beach all the way south-west until the rocks meet the breaking surf and a high neon tower.',
    quote: '“Even in the deepest packet storm, the beacon burns bright.”',
    reward: 'Ocean Navigator Badge Unlocked!',
  },
  {
    id: 'hermit_cabin',
    name: "The Mountain Hermit's Cabin",
    district: 'Northern Mountain Range',
    icon: '🏔️',
    gx: 50,
    gy: 4,
    category: 'lore',
    title: 'Old Hacker Mountain Retreat',
    subtitle: 'Off-grid cyber solitude',
    description:
      'Tucked high in the snowy northern pine peaks sits a weathered wooden log cabin. A spiral of pixel smoke curls lazily from its stone chimney.',
    clue: 'Climb high into the snowy northern pine crags near the central ridge where an old programmer retired.',
    quote: '“No push notifications up here. Just crisp mountain air and clean syntax.”',
    reward: 'Highlander Badge Unlocked!',
  },
  {
    id: 'retro_arcade',
    name: 'The 1984 CRT Arcade Cabinet',
    district: 'Downtown Cyber District',
    icon: '👾',
    gx: 86,
    gy: 22,
    category: 'fun',
    title: 'Space Invaders 1984 Machine',
    subtitle: 'Classic coin-op arcade relic',
    description:
      'A mint-condition vintage coin-op arcade cabinet glowing with retro scanlines. The high score board is topped by legend "RABBI" with 999,990 points!',
    clue: 'Behind the eastern warehouse alleys, a glowing CRT arcade screen flickers with 8-bit space invaders.',
    quote: '“INSERT COIN TO CONTINUE — PRESS 1P TO START”',
    reward: 'High Score Champion!',
  },
  {
    id: 'sunken_sub',
    name: 'The Sunken Prototype Submarine',
    district: 'Western Coast Reef',
    icon: '⚓',
    gx: 14,
    gy: 78,
    category: 'lore',
    title: 'Vessel Nautilus-01',
    subtitle: 'Prototype explorer from the deep web',
    description:
      'A rusted titanium submarine conning tower washed ashore on the western sandy flats. Small air bubbles still surface from its mechanical hatch.',
    clue: 'Where the western boardwalk winds toward the surf, look into the shallows for an old submerged vessel.',
    quote: '“Logged: Depth 4,000 meters. We found life in the digital deep.”',
    reward: 'Deep Sea Explorer Badge Unlocked!',
  },
];

export function getSecretAt(gx: number, gy: number): WorldSecret | null {
  for (const s of WORLD_SECRETS) {
    const dx = Math.abs(s.gx - gx);
    const dy = Math.abs(s.gy - gy);
    const xDist = s.id === 'dev_library' ? 2 : 1;
    if (dx <= xDist && dy <= 1) {
      return s;
    }
  }
  return null;
}
