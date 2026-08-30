# ◼ SPOT — 10,000 Real-Time Canvas on the Internet

<div align="center">

**A collaborative, real-time 10,000-tile infinite 2D world on the internet.**  
Claim your permanent coordinate, choose or design an 8-bit retro avatar, link your portfolio & socials, and discover internet citizens across the globe.

[Live Demo](https://spot.fazleyrabby.xyz) · [Report Bug](https://github.com/fazleyrabby/spot/issues) · [Support Creator](https://buymeacoffee.com/fazleyrabbi)

</div>

---

## ✨ Features

- **🌐 10,000-Tile Infinite Canvas (100x100):** Custom high-performance 60fps HTML5 2D Canvas engine with smooth pan/zoom interpolation, frustum culling, and 2-pass high-DPI rendering.
- **⚡ Real-Time Multiplayer Sync:** Instant Server-Sent Events (SSE) stream broadcasting tile claims, profile edits, presence counters, and account releases live across all connected devices.
- **🔑 1-Click GitHub OAuth:** Fast authentication powered by Supabase Auth with automatic avatar sync and verified citizen badge tiers.
- **👑 Founder & Citizen Tier Badges:** Permanent gold-badged founder coordinate at `(52, 60)`, cyan badges for GitHub-verified citizens, and green badges for guest citizens.
- **🎨 8-Bit Pixel Character Catalog:** Choose from retro procedural pixel archetypes (Astronaut, Cyber Hacker, Archmage, Solar Champion, Cyber Ronin, and more).
- **🔍 Instant Citizen Search (`⌘K`):** Global search across all citizens, coordinates, and taglines with smooth camera glide navigation.
- **🔒 GDPR-Compliant Right to Erasure:** Users can update their links or release their spot and delete their profile in an atomic database transaction anytime.
- **📊 Realtime Analytics:** Active online count deduplication and 24-hour deduplicated all-time visitor tracking.

---

## 🛠️ Architecture & Tech Stack

This project is built as a modular **pnpm monorepo**:

```
spot/
├── apps/
│   ├── web/           # Astro static frontend + HTML5 Canvas engine + glassmorphic UI
│   └── server/        # Authoritative Node.js / Express backend with SSE real-time streams
├── packages/
│   ├── shared/        # Shared domain models, Zod validation schemas, & TypeScript types
│   └── world/         # Grid coordinate projection & camera mathematics
└── database/          # Supabase PostgreSQL schema and migration scripts
```

### Tech Stack:
- **Frontend:** [Astro](https://astro.build), Vanilla TypeScript, Custom HTML5 Canvas 2D Engine, CSS Glassmorphism
- **Backend:** [Node.js](https://nodejs.org), [Express](https://expressjs.com), Server-Sent Events (SSE)
- **Database & Auth:** [Supabase](https://supabase.com) (PostgreSQL + GitHub OAuth)
- **Tooling:** pnpm workspaces, TypeScript, Docker Compose

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- A [Supabase](https://supabase.com) project with PostgreSQL and GitHub OAuth enabled

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/fazleyrabby/spot.git
cd spot
pnpm install
```

### 2. Environment Setup
Create a `.env` file in the project root based on `.env.example`:
```env
# Database & Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres
PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT].supabase.co
PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]

# Server Config
PORT=5050
NODE_ENV=development
```

### 3. Database Migration
Run the SQL migration located in `database/supabase_migration.sql` inside your Supabase SQL Editor.

### 4. Start Development Server
```bash
pnpm dev
```
- **Web Canvas:** [http://localhost:4322](http://localhost:4322)
- **API Server:** [http://localhost:5050](http://localhost:5050)

---

## 🌐 Production Deployment

> **Security:** the browser only ever gets the public Supabase anon key. In production all
> **writes** (claim / edit / delete / GitHub sync) must go through `apps/server`, and the
> public anon key must be locked to read-only. Steps 3–5 below do exactly that.

### Option A: Hybrid Deployment (Recommended)

1. **Backend (`apps/server`)** — deploy to **Render** (or Railway/Fly). Create a new Web Service from the repo:
   - **Build:** `pnpm install && pnpm --filter @spot/shared build && pnpm --filter @spot/world build && pnpm --filter server build`
   - **Start:** `pnpm --filter server start`
   - **Env vars:**
     ```
     DATABASE_URL=postgresql://...   # Supabase transaction pooler (port 6543)
     CORS_ORIGIN=https://www.claimyourspot.lol
     COOKIE_SECRET=<long random string>
     NODE_ENV=production
     ```
   - Note the resulting URL, e.g. `https://spot-api.onrender.com`.

2. **Frontend (`apps/web`)** — deploy to **Vercel** (Root Directory `apps/web`). Add env var:
   ```
   PUBLIC_API_BASE=https://spot-api.onrender.com
   ```
   (also add `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` if you changed them). Redeploy.

3. **Lock the database** — after the server is live, run `database/migrations/003_rls_lockdown.sql`
   in the Supabase SQL Editor. This drops the public write/delete policies, revokes
   `session_token_hash` reads, and locks `moderation_flags` to server-only. Verify:
   ```bash
   curl https://spot-api.onrender.com/health
   curl https://spot-api.onrender.com/api/world
   ```

4. **Verify writes go through the server** (should return JSON, not a DB error):
   ```bash
   curl -X POST https://spot-api.onrender.com/api/spots/claim \
     -H "Content-Type: application/json" \
     -d '{"x":50,"y":50,"displayName":"Smoke Test","avatarId":"astronaut"}'
   ```

### Option B: Docker Compose
```bash
docker compose up -d --build
```

---

## ☕ Support

Spot is built with care by **Md. Fazley Rabbi** ([@fazleyrabby](https://github.com/fazleyrabby)).

If you find this project fun or useful, consider [buying me a coffee](https://buymeacoffee.com/fazleyrabbi)!

---

## 📄 License

MIT License © 2026 [Md. Fazley Rabbi](https://github.com/fazleyrabby)
