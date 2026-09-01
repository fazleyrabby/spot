import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Elena', 'Lucas', 'Maya', 'Liam', 'Sophia', 'Noah',
  'Aria', 'Ethan', 'Chloe', 'Oliver', 'Zoe', 'Mason', 'Lily', 'Logan',
  'Mia', 'James', 'Amara', 'Benjamin', 'Isabella', 'Elijah', 'Harper',
  'William', 'Evelyn', 'Henry', 'Abigail', 'Sebastian', 'Emily', 'Jack',
  'Luna', 'Owen', 'Scarlett', 'Samuel', 'Layla', 'Julian', 'Grace',
  'Levi', 'Nora', 'David', 'Riley', 'Leo', 'Zoey', 'Gabriel', 'Stella',
  'Furkan', 'Sojon', 'Rabbi', 'Tariq', 'Kaito', 'Yuki', 'Ren', 'Sora',
  'Kenji', 'Hana', 'Mei', 'Lin', 'Wei', 'Chen', 'Bo', 'An',
  'Mateo', 'Camila', 'Santiago', 'Valentina', 'Dante', 'Lucia', 'Diego',
  'Chiara', 'Marco', 'Astrid', 'Felix', 'Freja', 'Lars', 'Ingrid',
  'Nico', 'Sven', 'Tove', 'Arjun', 'Ananya', 'Rohan', 'Priya', 'Kabir',
];

const TITLES = [
  'The Builder', 'The Explorer', 'Pixel Artist', 'AI Wizard', 'Indie Hacker',
  'Code Crafter', 'Fullstack Dev', 'Design Engineer', 'Cyber Nomad', 'Voxel Architect',
  'Cloud Pioneer', 'Open Sourcer', 'Retro Gamer', 'Coffee Brewer', 'Algorithmic Poet',
  'Rustacean', 'TypeScript Alchemist', 'Shader Sorcerer', 'Deep Thinker', 'Solopreneur',
];

const TAGLINES = [
  'Building the future, one pixel at a time ✨',
  'Crafting cozy web apps and exploring digital worlds 🚀',
  'Coffee enthusiast & open-source contributor ☕',
  'Designing delightful experiences for curious minds 🎨',
  'Turning ideas into living software 💻',
  'Metaverse citizen & digital explorer 🌟',
  'Indie maker scaling micro-SaaS with joy 🛠️',
  'Passionate about TypeScript, Canvas & Retro RPGs 🎮',
  'Building in public and learning every single day 📈',
  'Searching for the rarest secrets in Spot World 🧭',
  'Always down for a chat over virtual coffee! ☕❤️',
  'Coding under the cherry blossoms in Zen Garden 🌸',
];

const AVATARS = [
  'astronaut', 'cyber', 'wizard', 'champion', 'robot',
  'shinobi', 'cat', 'dino', 'alien', 'builder', 'ghost', 'fox',
];

async function seed() {
  const connectionString = 'postgresql://spot_user:spot_secret_password@localhost:55432/spot_db';
  const client = new Client({ connectionString });

  console.log('[Seed] Connecting to local Postgres on port 55432...');
  await client.connect();

  try {
    // 1. Run migrations if tables missing
    console.log('[Seed] Ensuring schema exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS citizens (
        id VARCHAR(64) PRIMARY KEY,
        session_token_hash VARCHAR(64) NOT NULL UNIQUE,
        display_name VARCHAR(32) NOT NULL,
        avatar_id VARCHAR(32) NOT NULL,
        tagline VARCHAR(80),
        website_url VARCHAR(256),
        github_url VARCHAR(256),
        twitter_url VARCHAR(256),
        facebook_url VARCHAR(256),
        instagram_url VARCHAR(256),
        linkedin_url VARCHAR(256),
        youtube_url VARCHAR(256),
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(256);
      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(256);
      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(256);
      ALTER TABLE citizens ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(256);
      ALTER TABLE spots ADD COLUMN IF NOT EXISTS wall_visibility VARCHAR(16) DEFAULT 'open';

      CREATE TABLE IF NOT EXISTS spots (
        id VARCHAR(32) PRIMARY KEY,
        x INT NOT NULL,
        y INT NOT NULL,
        owner_id VARCHAR(64) REFERENCES citizens(id) ON DELETE SET NULL UNIQUE,
        claimed_at TIMESTAMP WITH TIME ZONE,
        wall_visibility VARCHAR(16) DEFAULT 'open',
        CONSTRAINT uq_spot_coords UNIQUE (x, y)
      );

      CREATE TABLE IF NOT EXISTS spot_comments (
        id VARCHAR(64) PRIMARY KEY,
        spot_id VARCHAR(32) NOT NULL,
        author_name VARCHAR(32) NOT NULL,
        body VARCHAR(180) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM spots LIMIT 1) THEN
          INSERT INTO spots (id, x, y, owner_id, claimed_at)
          SELECT
            CONCAT(gx, ',', gy) AS id,
            gx AS x,
            gy AS y,
            NULL AS owner_id,
            NULL AS claimed_at
          FROM
            generate_series(0, 99) AS gx
            CROSS JOIN generate_series(0, 99) AS gy;
        END IF;
      END $$;
    `);

    // 2. Clear old demo data
    console.log('[Seed] Resetting spots ownership and citizens...');
    await client.query(`UPDATE spots SET owner_id = NULL, claimed_at = NULL`);
    await client.query(`DELETE FROM spot_comments`);
    await client.query(`DELETE FROM citizens`);

    // 3. Generate 500 coordinates distributed across districts
    console.log('[Seed] Generating 500 citizen spots...');
    const occupiedCoords = new Set<string>();

    // Reserved landmark spots to keep clear
    const reserved = new Set([
      '48,47', '48,48', '48,49', '48,50', // Center plaza
      '64,16', '44,52', '72,22', '22,70', '18,24', '78,74', // Easter eggs
    ]);

    const targetCount = 500;
    const spotsToClaim: Array<{ x: number; y: number }> = [];

    // Distribute among playable area (gx: 8..92, gy: 8..88)
    while (spotsToClaim.length < targetCount) {
      const x = 8 + Math.floor(Math.random() * 84);
      const y = 8 + Math.floor(Math.random() * 80);
      const key = `${x},${y}`;

      // Avoid road gridlines
      if ([48, 49, 14, 32, 68, 86].includes(x) || [48, 49, 14, 32, 68, 86].includes(y)) {
        continue;
      }
      // Avoid water pond
      const dx = x - 70;
      const dy = y - 22;
      if ((dx * dx) / 45 + (dy * dy) / 20 < 1.0) {
        continue;
      }
      if (reserved.has(key) || occupiedCoords.has(key)) {
        continue;
      }

      occupiedCoords.add(key);
      spotsToClaim.push({ x, y });
    }

    // Always include Fazley Rabbi at (52, 60)
    spotsToClaim[0] = { x: 52, y: 60 };

    console.log(`[Seed] Inserting ${spotsToClaim.length} citizens...`);

    for (let i = 0; i < spotsToClaim.length; i++) {
      const { x, y } = spotsToClaim[i];
      const citizenId = `cit_${crypto.randomUUID().slice(0, 16)}`;
      const tokenHash = crypto.createHash('sha256').update(`token_${i}_${citizenId}`).digest('hex');

      let displayName: string;
      let tagline: string;
      let isVerified = false;

      if (i === 0) {
        displayName = 'Fazley Rabbi';
        tagline = 'Founder & Architect of Spot World 🚀';
        isVerified = true;
      } else {
        const first = FIRST_NAMES[i % FIRST_NAMES.length];
        const title = TITLES[i % TITLES.length];
        displayName = i % 3 === 0 ? `${first} ${title}` : (i % 2 === 0 ? `${first} ${i}` : first);
        tagline = TAGLINES[i % TAGLINES.length];
        isVerified = Math.random() < 0.15;
      }

      const avatarId = AVATARS[i % AVATARS.length];
      const websiteUrl = `https://github.com/${displayName.toLowerCase().replace(/\s+/g, '')}`;
      const twitterUrl = `https://x.com/${displayName.toLowerCase().replace(/\s+/g, '')}`;
      const githubUrl = `https://github.com/${displayName.toLowerCase().replace(/\s+/g, '')}`;

      await client.query(
        `INSERT INTO citizens (id, session_token_hash, display_name, avatar_id, tagline, website_url, github_url, twitter_url, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [citizenId, tokenHash, displayName, avatarId, tagline, websiteUrl, githubUrl, twitterUrl, isVerified]
      );

      await client.query(
        `UPDATE spots
         SET owner_id = $1, claimed_at = NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', wall_visibility = 'open'
         WHERE x = $2 AND y = $3`,
        [citizenId, x, y]
      );

      // Add a couple of initial wall comments for community vibe
      if (Math.random() < 0.4) {
        const spotId = `${x},${y}`;
        const commentAuthor = FIRST_NAMES[(i + 7) % FIRST_NAMES.length];
        await client.query(
          `INSERT INTO spot_comments (spot_id, author_name, body)
           VALUES ($1, $2, $3)`,
          [
            spotId,
            commentAuthor,
            'Awesome spot in this district! Greetings from your neighbor ✨',
          ]
        );
      }
    }

    const countRes = await client.query(`SELECT count(*) as total FROM spots WHERE owner_id IS NOT NULL`);
    console.log(`\n✅ [Seed Complete] Successfully seeded ${countRes.rows[0].total} citizens into local Docker Postgres!`);
  } finally {
    await client.end();
  }
}

void seed();
