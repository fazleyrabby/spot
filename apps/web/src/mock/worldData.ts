import type { OccupiedSpotSummary, WorldSnapshot } from '@spot/shared';

const MOCK_NAMES = [
  'Fazley Rabbi', 'Elena Rostova', 'Marcus Chen', 'Aria Montgomery', 'David K.',
  'Sofia Thorne', 'Leo Vance', 'Maya Lin', 'Kai Tanaka', 'Zara Al-Mansoor',
  'Oliver Scott', 'Chloe Dupont', 'Liam Gallagher', 'Nadia Volkov', 'Siddharth Rao',
  'Freja Lindqvist', 'Amara Okafor', 'Julian Rossi', 'Taro Yamada', 'Hanna Becker'
];

const MOCK_TAGLINES = [
  'Building playful decentralized tools & games 🕹️',
  'Full-stack engineer & open-source tinkerer',
  'Exploring generative canvas art & retro shaders',
  'Distributed systems & realtime multiplayer tech',
  'Crafting minimalist design systems & micro-apps',
  'Indie hacker building small internet toys',
  'TypeScript, WebAssembly, and graphics nerd',
  'Designing calm, intentional software interfaces',
  'Building the future of personal websites 🌐',
  'Hardware enthusiast & retro computing fan'
];

const MOCK_AVATAR_IDS = [
  'astronaut', 'hacker', 'pixel_wizard', 'bot_9000',
  'retro_cat', 'ghosty', 'pixel_knight', 'neon_ninja'
];

export function generateMockWorldSnapshot(
  width = 100,
  height = 100,
  claimedCount = 842
): WorldSnapshot {
  const totalSpots = width * height;
  const occupied: OccupiedSpotSummary[] = [];
  const occupiedSet = new Set<string>();

  // Add the founder / primary demo spot at (42, 42)
  const founderSpot: OccupiedSpotSummary = {
    spotId: '42,42',
    x: 42,
    y: 42,
    citizenId: 'c_founder_001',
    displayName: 'Fazley Rabbi',
    avatarId: 'hacker',
    tagline: 'Creator of Spot. Crafting tiny internet places.',
    websiteUrl: 'https://fazleyrabby.dev',
    githubUrl: 'https://github.com/fazleyrabby',
    linkedinUrl: 'https://linkedin.com/in/fazleyrabbi',
    isOnline: true,
  };
  occupied.push(founderSpot);
  occupiedSet.add('42,42');

  // Generate deterministic clusters around the center and random scattering
  let seed = 1337;
  function random(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  while (occupied.length < claimedCount) {
    // Bias generation slightly towards the center
    let gx: number;
    let gy: number;

    if (random() < 0.6) {
      // Clustered near center (30..70)
      const u = random() + random();
      const v = random() + random();
      gx = Math.floor(25 + u * 25);
      gy = Math.floor(25 + v * 25);
    } else {
      // Spread across whole map
      gx = Math.floor(random() * width);
      gy = Math.floor(random() * height);
    }

    gx = Math.max(0, Math.min(width - 1, gx));
    gy = Math.max(0, Math.min(height - 1, gy));

    const spotId = `${gx},${gy}`;
    if (occupiedSet.has(spotId)) continue;
    occupiedSet.add(spotId);

    const nameIdx = Math.floor(random() * MOCK_NAMES.length);
    const name = MOCK_NAMES[nameIdx];
    const avatarId = MOCK_AVATAR_IDS[Math.floor(random() * MOCK_AVATAR_IDS.length)];
    const tagline = MOCK_TAGLINES[Math.floor(random() * MOCK_TAGLINES.length)];
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    occupied.push({
      spotId,
      x: gx,
      y: gy,
      citizenId: `c_${spotId.replace(',', '_')}`,
      displayName: name,
      avatarId,
      tagline,
      websiteUrl: `https://${slug}.dev`,
      githubUrl: `https://github.com/${slug}`,
      isOnline: random() < 0.25, // 25% online
    });
  }

  const onlineCount = occupied.filter((s) => s.isOnline).length;

  return {
    width,
    height,
    totalSpots,
    claimedCount,
    onlineCount,
    occupied,
  };
}
