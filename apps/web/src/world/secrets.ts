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
    title: 'Spot #0: The Genesis Inscription',
    subtitle: 'Artifact of the First Grid Block',
    description:
      'A solitary obsidian monolith commemorating the founding coordinate of the 100×100 canvas. Each pixel and every plot here belongs permanently to the citizens who built it.',
    clue: 'In the quiet grove north of the transit line, a golden pillar marks the origin of the grid.',
    reward: 'Genesis Monument Recorded',
    quote: '“Every square tells a story; every coordinate holds a memory.”',
  },
  {
    id: 'cyber_vending',
    name: 'Downtown Neon Automat',
    district: 'Downtown Cyber District',
    icon: '🥤',
    gx: 18,
    gy: 24,
    category: 'interactive',
    title: 'The Downtown Automat',
    subtitle: 'Luminescent night-shift refreshments',
    description:
      'A vintage illuminated street automat glowing softly against the warehouse brick. Its backlit glass shelves dispense chilled tonics and warm brews to travelers crossing the neon quarter.',
    clue: 'Tucked into the neon alleys of Downtown, look for the gentle amber glow of a street automat beside the sidewalk.',
    actionLabel: 'Draw Night Token',
    quote: '“Night falls across the skyline, but the city’s heart keeps beating.”',
    reward: 'Night Owl Explorer',
  },
  {
    id: 'dev_library',
    name: 'The Open Archive Pavilion',
    district: 'Grand Central Plaza',
    icon: '📚',
    gx: 44,
    gy: 52,
    category: 'resource',
    title: 'The Open Archive Pavilion',
    subtitle: 'Public codex & architectural repository',
    description:
      'A sheltered timber pavilion lined with illuminated codices, protocol schematics, and open-source learning archives. Citizens gather around reading lamps to study the crafts that shape the digital world.',
    clue: 'Near the central plaza gardens, open shelves of illuminated manuscripts invite quiet study.',
    actionLabel: 'Open Study Archive ↗',
    actionUrl: 'https://roadmap.sh',
    reward: 'Codex Scholar',
    quote: '“Knowledge shared is knowledge multiplied.”',
  },
  {
    id: 'mystic_duck',
    name: 'The Solitary Lake Waterfowl',
    district: 'Central Park Lake',
    icon: '🦆',
    gx: 72,
    gy: 22,
    category: 'fun',
    title: 'Guardian of the Central Waters',
    subtitle: 'Drifting quietly across the lake',
    description:
      'A graceful mallard drifting along the mirrored surface of Central Park Lake. The gentle rippling water and rustling reeds offer a sanctuary of calm amidst the bustling digital metropolis.',
    clue: 'Drifting among the water lilies along northern Central Park Lake, a quiet waterfowl rests on the calm water.',
    quote: '“Still waters reflect the sky. Take a breath and let the hurry drift away.”',
    reward: 'Serene Sanctuary',
  },
  {
    id: 'cafe_cat',
    name: 'Midnight the Promenade Cat',
    district: 'Cafe Promenade',
    icon: '🐱',
    gx: 22,
    gy: 70,
    category: 'fun',
    title: 'Midnight the Promenade Cat',
    subtitle: 'Guardian of the Warm Corner',
    description:
      'A sleek black cat curled up on a cushioned wicker chair beneath the amber awning of the Promenade cafe. It stirs gently, purrs against your outstretched hand, and dozes off in the afternoon sun.',
    clue: 'Under the warm amber streetlamps of the Cafe Promenade, a sleeping cat rests near the flower boxes.',
    quote: '“A soft purr resonates in the quiet afternoon air.”',
    reward: 'Feline Companion',
  },
  {
    id: 'zen_lantern',
    name: 'The Whispering Stone Lantern',
    district: 'Zen Garden',
    icon: '🏮',
    gx: 78,
    gy: 74,
    category: 'interactive',
    title: 'The Whispering Stone Lantern',
    subtitle: 'Carved granite & eternal ember',
    description:
      'A weathered stone lantern nestled among raked gravel and bamboo stalks. A gentle amber flame flickers inside its rice-paper frame, untouched by the wind.',
    clue: 'Surrounded by bamboo grove tranquility in the Zen quarter, a hand-carved stone lantern glows with quiet warmth.',
    quote: '“Silence is not empty; it is where clarity begins.”',
    reward: 'Inner Stillness',
  },
  {
    id: 'glitch_void',
    name: 'The Outer Horizon Marker',
    district: 'Outer Fringe',
    icon: '🌌',
    gx: 98,
    gy: 98,
    category: 'lore',
    title: 'The Outer Horizon Marker',
    subtitle: 'Boundary of the 100×100 canvas',
    description:
      'At coordinate (98, 98), paved pathways give way to the boundless starlit void. A polished boundary marker marks the outer limit of the known metropolis.',
    clue: 'Journey to the extreme south-eastern border of the map, where the grid meets the edge of the sky.',
    quote: '“Every map ends somewhere. Beyond here lies what we create next.”',
    reward: 'Horizon Pioneer',
  },
  {
    id: 'cyber_lighthouse',
    name: 'The Headland Lighthouse',
    district: 'Southern Ocean Beach',
    icon: '🗼',
    gx: 4,
    gy: 94,
    category: 'interactive',
    title: 'The Headland Lighthouse',
    subtitle: 'Beacon over the southern surf',
    description:
      'A solitary white stone lighthouse perched on the rocky cliffs of the south-western coast. Its rotating warm beam cuts across the ocean mist, watching over all who travel the waters.',
    clue: 'Follow the sandy beach south-west to the rocky headland where a lighthouse sweeps across the surf.',
    quote: '“A steadfast beacon for all who journey through the dark.”',
    reward: 'Coastal Beacon Keeper',
  },
  {
    id: 'hermit_cabin',
    name: "The Mountain Hermitage",
    district: 'Northern Mountain Range',
    icon: '🏔️',
    gx: 50,
    gy: 4,
    category: 'lore',
    title: 'The Alpine Hermitage',
    subtitle: 'Solitude among high pine crags',
    description:
      'Perched in the snowy northern pine peaks, a hand-hewn cedar cabin looks out over the entire metropolis. Birchwood smoke curls gently from the stone chimney into the crisp mountain air.',
    clue: 'Climb into the snowy northern pine ridges where a secluded cabin overlooks the valley below.',
    quote: '“From this height, the bustling city below becomes a constellation of quiet lights.”',
    reward: 'Summit Wanderer',
  },
  {
    id: 'retro_arcade',
    name: 'The Byte Arcade Pavilion',
    district: 'Downtown Cyber District',
    icon: '👾',
    gx: 86,
    gy: 22,
    category: 'fun',
    title: 'The Byte Arcade Pavilion',
    subtitle: 'Classic vector cabinet showcase',
    description:
      'An illuminated arcade pavilion tucked into Downtown. Glowing CRT vector cabinets invite passersby to test their reflexes on retro games under neon trusses.',
    clue: 'Behind the eastern warehouse alleys, vibrant neon marquees light up the arcade entrance.',
    quote: '“Insert token to play • Arrow keys or touch swipe to steer.”',
    reward: 'Arcade Challenger',
  },
  {
    id: 'sunken_sub',
    name: 'The Sunken Coastline Vessel',
    district: 'Western Coast Reef',
    icon: '⚓',
    gx: 14,
    gy: 78,
    category: 'lore',
    title: 'The Sunken Coastline Vessel',
    subtitle: 'Tide-worn hull from the outer reef',
    description:
      'A weathered submersible hull resting in the shallow tide pools of the western coastline. Sea-spray mist rises as rolling waves wash across its reinforced plates.',
    clue: 'Where the western coastal boardwalk winds toward the surf, search the shallow reef for a weathered vessel.',
    quote: '“The tide always returns what was lost to the deep.”',
    reward: 'Reef Explorer',
  },
  {
    id: 'cyber_glitch_byte',
    name: 'Glitch Byte (Bug Bounty)',
    district: 'Tech Corridor',
    icon: '🪲',
    gx: 32,
    gy: 38,
    category: 'fun',
    title: 'Daily Glitch Byte #01',
    subtitle: 'Rogue neon bytecode critter',
    description:
      'A flickering cyber bug with iridescent wings fluttering near the tech plaza. You caught it before it could cause a stack overflow!',
    clue: 'Look for a glowing cyan bug fluttering around the neon tech corridor at (32, 38).',
    quote: '“Stack overflow averted! Clean compile achieved.”',
    reward: 'Bug Bounty: Glitch Catcher ✦',
  },
  {
    id: 'cyber_glitch_mantis',
    name: 'Memory Leak Mantis (Bug Bounty)',
    district: 'Central Park Green',
    icon: '🦗',
    gx: 60,
    gy: 44,
    category: 'fun',
    title: 'Daily Glitch Critter #02',
    subtitle: 'Consuming RAM among the reeds',
    description:
      'A crystalline neon-green mantis nibbling on uncollected garbage data in Central Park. Safely deallocated!',
    clue: 'Searching through the tall grass in Central Park near (60, 44) reveals a green glowing critter.',
    quote: '“Garbage collector ran: 512MB RAM reclaimed.”',
    reward: 'Bug Bounty: Memory Cleaner ✦',
  },
  {
    id: 'cyber_glitch_null',
    name: 'NullPointer Sprite (Bug Bounty)',
    district: 'Boardwalk Coast',
    icon: '✨',
    gx: 48,
    gy: 82,
    category: 'fun',
    title: 'Daily Glitch Sprite #03',
    subtitle: 'Undefined reference near the surf',
    description:
      'A playful golden spark dancing over the ocean spray near the boardwalk. Successfully handled with an optional chain!',
    clue: 'Near the warm coastal boardwalk at (48, 82), a golden spark skips over the surf.',
    quote: '“Cannot read properties of undefined? Handled safely with ?.”',
    reward: 'Bug Bounty: Master Debugger ✦',
  },
];

export function getSecretAt(gx: number, gy: number): WorldSecret | null {
  for (const s of WORLD_SECRETS) {
    const dx = Math.abs(s.gx - gx);
    const dy = Math.abs(s.gy - gy);
    const xDist = (s.id === 'dev_library' || s.id === 'retro_arcade') ? 2 : 1;
    if (dx <= xDist && dy <= 1) {
      return s;
    }
  }
  return null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  checkUnlocked: (discoveredSecretIds: string[], stats?: { arcadeHighScore?: number }) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'badge_cartographer',
    name: 'Cartographer',
    description: 'Discovered 3 hidden landmarks across the world',
    icon: '🗺️',
    color: '#38bdf8',
    checkUnlocked: (secrets) => secrets.length >= 3,
  },
  {
    id: 'badge_codex_scholar',
    name: 'Codex Scholar',
    description: 'Explored The Open Archive Pavilion',
    icon: '📚',
    color: '#fbbf24',
    checkUnlocked: (secrets) => secrets.includes('dev_library'),
  },
  {
    id: 'badge_arcade_legend',
    name: 'Arcade Legend',
    description: 'Achieved 50+ points in Byte Snake arcade',
    icon: '👾',
    color: '#a855f7',
    checkUnlocked: (_secrets, stats) => (stats?.arcadeHighScore ?? 0) >= 50,
  },
  {
    id: 'badge_cat_whisperer',
    name: 'Feline Companion',
    description: 'Visited Midnight the Promenade cat',
    icon: '🐱',
    color: '#f43f5e',
    checkUnlocked: (secrets) => secrets.includes('cafe_cat'),
  },
  {
    id: 'badge_highlander',
    name: 'Summit Wanderer',
    description: 'Reached the alpine mountain hermitage',
    icon: '🏔️',
    color: '#34d399',
    checkUnlocked: (secrets) => secrets.includes('hermit_cabin'),
  },
  {
    id: 'badge_bug_hunter',
    name: 'Glitch Hunter',
    description: 'Caught a rogue Cyber Glitch Bug on the island',
    icon: '🪲',
    color: '#10b981',
    checkUnlocked: (secrets) => secrets.some((s) => s.startsWith('cyber_glitch_')),
  },
  {
    id: 'badge_bug_master',
    name: 'Master Debugger',
    description: 'Captured all 3 daily Cyber Glitch critters',
    icon: '🏆',
    color: '#f59e0b',
    checkUnlocked: (secrets) =>
      secrets.includes('cyber_glitch_byte') &&
      secrets.includes('cyber_glitch_mantis') &&
      secrets.includes('cyber_glitch_null'),
  },
  {
    id: 'badge_metropolis_master',
    name: 'World Explorer',
    description: 'Discovered all landmarks across SPOT World',
    icon: '👑',
    color: '#f59e0b',
    checkUnlocked: (secrets) => secrets.length >= WORLD_SECRETS.length,
  },
];

export function getUnlockedBadges(discoveredIds: string[] = [], arcadeScore = 0): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.checkUnlocked(discoveredIds, { arcadeHighScore: arcadeScore }));
}
