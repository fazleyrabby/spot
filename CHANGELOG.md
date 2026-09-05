# Changelog

All notable changes to SPOT are documented here.

---

## [Unreleased]

---

## 2026-09-05

### Added
- **Cyber World Expansion & Interactive Arcade System (`ArcadeModal.astro`):**
  - **Retro-Futuristic CRT Arcade Cabinet:** Built an interactive arcade zone running "Cyber Viper / Neon Snake" with custom CRT scanline shader, phosphor glow, high-score tracking, and synthesized 8-bit audio effects.
  - **Multi-Controller Input Engine:** Engineered five distinct input controller modes, selectable via instant UI tabs and persisted in `localStorage` (`spot_snake_ctrl_mode`):
    1. *Virtual Joystick:* Analog thumb-puck with 360° spring physics, dynamic radial boundary clamping, and angle-to-vector steering.
    2. *Tactile D-Pad:* Low-latency directional cross with instant `pointerdown` reaction and glowing active state feedback.
    3. *Swipe Touchpad:* Dedicated gesture-flick touchpad calibrated for fluid one-handed mobile play.
    4. *Direct Canvas Drag:* Touch/drag directly onto the game board with gesture velocity tracking.
    5. *Physical Keyboard:* Full WASD / Arrow key mappings with reverse-direction safety locks.
- **The Grand Codex — Cyber Library Landmark (`LibraryModal.astro`, `library-resources.ts`):**
  - Erected neoclassical cyber library landmark at Sector 3 with golden dome and dynamic glow pillars.
  - **Curated Knowledge & Learning Hub:** Added top-tier developer and data science platforms including AWS Skill Builder, DataCamp, freeCodeCamp, fast.ai, The Odin Project, and Kaggle Learn alongside Vizly spotlight.
  - Added real-time category filtering (All, Learning Hub, Dev Tools, Design, Reading, Community), search queries, and direct navigation links.
- **Atmospheric Weather Simulation (`weather-manager.ts`, `renderer.ts`):**
  - Added procedural weather states: Neon Rain (streaking cyan raindrops with surface splash particles), Cyber Motes (drifting golden ambient dust), and Day/Night illumination shifts.
- **Explorer Journal & Citizen Milestones (`JournalModal.astro`):**
  - Built interactive world journal tracking landmark discoveries, secret caches, district exploration, and profile badge unlocks.
- **Proximity Emotes & Ambient Synthesis (`WorldChatBar.astro`):**
  - Added floating proximity emotes dock with spatial broadcast, audio pings via Web Audio API oscillator, and speech bubble rendering over avatars.
- **Transactional Email Delivery System via Resend REST API (`mailer.ts`):**
  - Built zero-dependency, lightweight transactional email client using native `fetch` against Resend REST API (`https://api.resend.com/emails`).
  - **Welcome Plot Deed Email (`sendWelcomeClaimEmail`):** Sent immediately upon claiming a grid spot, featuring sector coordinates, Citizen ID, cyberpunk plot deed layout, and direct links to grid view and 2D virtual world.
  - **Cyber Billboard Sponsorship Confirmation (`sendBillboardSponsoredEmail`):** Sent upon successful Gumroad sponsor webhook, rendering tier badge, active holographic preview, target URL, and Gumroad order ID.
- **Database Email Tracking & Idempotency Safeguards (`email_logs`):**
  - Created `database/migrations/011_email_logs.sql` with `UNIQUE(kind, reference_id)` constraint.
  - Intercepts duplicate dispatch attempts at the application layer before making outgoing HTTP requests to Resend, ensuring zero duplicate emails from payment webhook retries or multi-clicks.
  - Records delivery status, recipient, timestamp, and Resend tracking ID for full auditability.
- **Email Deliverability & Anti-Spam Hardening:**
  - Added strict DMARC record to DNS (`_dmarc.claimyourspot.lol` with `v=DMARC1; p=none; sp=none; aspf=r;`).
  - Updated root SPF record to include Amazon SES / Resend (`include:amazonses.com`).
  - Removed duplicate bare DKIM key from root `@` and isolated to `resend._domainkey`.
  - Added `reply_to: 'welcome@claimyourspot.lol'` and `X-Entity-Ref-ID` headers to avoid automated spam filter penalties.

### Fixed
- **Tree Foliage X-Ray Canopy & Citizen Occlusion (`renderer.ts`, `monument-manager.ts`):**
  - Implemented dynamic X-ray alpha transparency (`globalAlpha = 0.32`) when player avatars or citizens walk behind tree canopies.
  - Added entity clearance checks (`hasEntityNear`) to prevent trees, monuments, and foliage from generating on occupied citizen plots.
- **AI Slop & Dev Humor Purge:**
  - Audited and purged placeholder developer memes (`git rebase`, `QUACK!`, `Glitch Cola`, `+50 Peace of Mind`) from secrets lore, dialogue, and UI modals in favor of cohesive cyberpunk universe lore.
  - Replaced tacky colored border stripes in `SecretModal.astro` and `NpcModal.astro` with quiet luxury aesthetics and subtle `✦` badges.
- **Ad Banner Modal Visual Clipping & Layout Squishing:**
  - Added `min-height: 124px`, `box-sizing: border-box`, and `flex-shrink: 0` to prevent holographic preview screen squishing in `BannerModal.astro`.
  - Synchronized modal accent color, LED border glow, and color pip with active canvas state in `world.astro`.

---

## 2026-09-04

### Added
- **Multi-Device Persistent Session Architecture (`citizen_sessions`):**
  - Replaced single-device session overwrite on `citizens` table with multi-session token storage in `citizen_sessions` with 10-year lifespan.
  - Enabled multi-device sign-in (phone + desktop) without premature session invalidation.
  - Implemented automatic legacy migration on server boot to copy existing active session hashes into `citizen_sessions`.
- **Domain & Cookie Unification:**
  - Scoped production session cookie domain to `.claimyourspot.lol` so authentication is seamlessly shared across root and `www`.
  - Added canonical 301 permanent redirect from `www.claimyourspot.lol` to `https://claimyourspot.lol` to eliminate session cookie fragmentation.
  - Added client-side fallback to `localStorage` (`spot_session_token`) and Supabase `INITIAL_SESSION` hydration in `apps/web/src/pages/world.astro`.
- **Deep System Healthcheck & Monitoring (`/health`):**
  - Upgraded `/health` endpoint to perform live database query latency measurements, spot count validation, Node process uptime, and RSS/heap memory tracking.
  - Returns HTTP 503 Service Unavailable if database is unreachable.
  - Mapped `127.0.0.1:4323:4323` to host in `docker-compose.prod.yml` and added container healthcheck probes.

---

## 2026-09-03

### Added
- **Top-View Billboard Display Priority Hierarchy (`renderer.ts`):**
  - Implemented strict canvas visual priority:
    1. *Priority 1 (Image):* Renders banner/logo image scaled and clipped directly onto the cyber screen frame with aspect-ratio preservation.
    2. *Priority 2 (Business):* Renders Business Name as top tag pill, with Marquee Headline and Tagline.
    3. *Priority 3 (Citizen):* Renders `CITIZEN SPONSOR` and Citizen Display Name if sponsored by a digital citizen without separate business branding.
- **Dual Modal Presentation (Citizen vs Guest Sponsor):**
  - *Citizen Sponsors:* Shows procedural 8-bit citizen avatar, verified checkmark, and clickable `📍 Plot (x, y)` chip flying camera to their plot, alongside business data.
  - *Guest Sponsors:* Shows clean business branding, headline, tagline, and direct "Visit Sponsor Website ↗" link with zero citizen UI.
- **Automated OpenGraph Extraction & Admin Security:**
  - Added `GET /api/billboards/fetch-og` to auto-extract og:image and titles.
  - Protected `GET /api/billboards/orders` with admin secret key.
  - Added `POST /api/billboards/manual-assign` for manual assignment and recovery.
  - Added atomic upsert with idempotent Discord alerts.
- **Dynamic Multi-Tier Zoom Level-of-Detail (LOD) Rendering (`renderer.ts`):**
  - *Satellite View (`zoom < 60%`):* Text and sub-labels are completely hidden; displays render as sleek cyber hardware bars with blinking neon jewel LEDs to eliminate visual clutter.
  - *Mid View (`zoom 60% – 80%`):* High-contrast marquee typography (`COMING SOON...`, `YOUR AD HERE`) renders with drop shadows.
  - *Street View / Hover (`zoom > 80%`):* Full ultra-definition rendering with animated scanline sweeps, glowing tag pills, and metadata.
- **Interactive Billboard Modal & Spatial Hit-Testing (`BannerModal.astro`, `interaction.ts`):**
  - $O(1)$ spatial hash partitioning (`bannerSpatialMap`) for instant mouse hover hit-testing.
  - Interactive hover reticle tooltip `[ 📡 <Name> • Click to Inspect ]` with pointer cursor.
  - Glassmorphism inspect modal showcasing screen dimensions, holographic animated preview, district coordinates, and booking options.
- **Monetization & Creator Payout Pipeline:**
  - Designed multi-tiered Gumroad sponsorship products ($10 Scenic, $20 Downtown Cyber, $35 Grand Central).
  - Documented Bangladesh BEFTN electronic fund transfer routing (Prime Bank Prabartak More branch code: `170156334`).

### Fixed
- Fixed missing `OccupiedSpotSummary` type import in `apps/web/src/pages/world.astro`.
- Fixed text readability and visual spam at wide camera zoom levels.

---

## 2026-09-02

### Added
- **Homelab Self-Hosted Production Migration:**
  - Migrated production database to local containerized `postgres:17-alpine` on private bridge network `spot-network` (<0.5ms query latency).
  - Implemented native Server-Sent Events (SSE) multiplayer engine in `apps/server` (`/api/realtime/stream` & `/api/realtime/position`), completely decoupling from Supabase Realtime limits.
  - Configured Cloudflare Tunnel (`cloudflared`) and Traefik reverse proxy for SSL termination and zero-port-forwarding security on `claimyourspot.lol`.
  - Added Cloudflare Edge Worker failover script (`edge/cloudflare-worker-fallback.js`) with retro pixel-art power outage maintenance screen.

### Fixed
- World HUD positioning and mobile interaction event bubbling.
- Real-time client API base resolution for remote domains.

---

## 2026-09-01

### Fixed
- Prevent bottom HUD (coord pill, creator badge, support button) from overlapping right-side nav controls on small screens — hide district text and coord icon at ≤640px, constrain pill max-width, hide "made by" label on mobile

### Changed
- SEO: clarify SPOT as a shared Internet canvas in homepage copy

### Security
- Fix stored XSS and open redirect vulnerabilities in social URL fields

---

## 2026-08-31

### Added
- Creator badge ("made by fazleyrabbi") displayed next to Support button in bottom HUD
- Dynamic spot share cards (`/api/share?x=&y=`) with Open Graph metadata
- Passkey recovery for citizens (register and authenticate across devices)
- World loading state spinner while canvas data fetches

### Fixed
- Mobile HUD pointer handling — prevent canvas taps leaking through HUD controls
- Mobile floating control hit areas corrected
- Keep mobile HUD controls above the SEO guide layer
- Route production claims through authoritative API
- Remove invalid sitemap reference

### Improved
- Realtime presence and visitor counting accuracy
- Visitor metric label corrected (unique vs. realtime)
- Analytics API bundle regenerated

---

## 2026-08-30

### Added
- Crawlable homepage SEO improvements
- Rate limiting per IP

### Security
- Enforce one anonymous citizen per device (fingerprint-based)
- Harden identity and claim security

### Fixed
- Match GitHub accounts by username; fix direct-mode DB queries
- Expire stale activity ticker
- Limit anonymous guest account creation

---

## 2026-08-29

### Infrastructure
- Cache world snapshot with TTL in memory
- Configure Astro static build output
- Enable SSL for PostgreSQL connections

---

<!-- 
  How to update this file:
  Add a new dated section at the top under [Unreleased] when you ship changes.
  Keep entries grouped by: Added | Changed | Fixed | Security | Removed | Infrastructure
-->
