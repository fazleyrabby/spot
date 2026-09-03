# Changelog

All notable changes to SPOT are documented here.

---

## [Unreleased]

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
