# 🗺️ SPOT — Product Roadmap & Evolution Plan

> **Mission**: Build the internet's most iconic, permanent, and playful 10,000-plot cyber world where developers, founders, and creators claim their plot, showcase their work, and connect in a living 60fps canvas city.

---

## ✅ Recently Shipped & Live in Production

- [x] **🕹️ The Byte Cade (Playable 1984 Vintage Arcade Cabinet)**
  - **Authentic Cabinet Shell**: Molded CRT monitor bezel with corner hex bolts, curved scanlines, illuminated backlit neon marquee, and 3D convex pushbuttons (**PUNCH** 🔴, **KICK** 🟡, **SURGE** 🔵).
  - **Spot Fighter II (Cyber Brawl 1v1)**: Street Fighter-style fighting engine with articulated sprite skeletons, 7-character roster, 3 CPU AI bosses (*Sysadmin*, *Invader X*, *Grand Ronin*), Hadouken surge projectiles, hit particles, screen shake, and 99s timer.
  - **Byte Snake '84**: 60fps procedural snake with touch joystick, 4-way D-Pad, and gesture swipe pad.
  - **Procedural 8-Bit Web Audio**: Synthesizer producing punch/kick impacts, special surges, game over sweeps, and authentic dual-tone coin drop chimes.
  - **Trophy Unlocks**: Persistent streak records and "Arcade Legend" badge unlocks.
- [x] **⚡ Database Dual-Switching Engine (`scripts/switch-db.sh`)**
  - Instant hot-swapping between Local Docker DB (port 55432) and VPS Production DB (port 65432 via secure SSH tunnel).
  - Shortcut commands `pnpm db:vps` and `pnpm db:local`.
- [x] **👥 Multiplayer & World Stability**
  - Ghost avatar deduplication (`senderTabId` + local player exclusions) eliminating visitor duplicates in incognito mode.
  - Tightened plaza walking hitboxes to prevent inadvertent landmark modal triggers.
  - Normalized social links (X, GitHub, LinkedIn, Reddit) with safe URL formatting.

---

## 🚀 Upcoming Priorities

### 🎨 Phase 1: Character Art, 4-Way Walk Cycles & Gear (Immediate)
*Goal: Bring unmatched visual personality to each developer and founder avatar roaming the map.*

- **Directional Micro-Details across 4 Walk Directions**:
  - **Facing Up**: Visible backpacks, utility rigs, capes, or katana scabbards.
  - **Facing Left / Right**: Side headphones, holstered gadgets, glowing cyber-visors.
  - **Facing Down**: Chest badges, animated laptop/pad glows, necklaces.
- **New Creator Archetypes in World**:
  - `indie_hacker`: Cozy hoodie, oversized headphones, backpack, glowing laptop screen.
  - `cyber_sysadmin`: Cyberpunk trench coat, holographic eye monocle/visor, server keycard.
  - `ai_architect`: Floating syntax halo, purple rune robe, terminal staff.
- **Idle / Resting Animations**:
  - Citizens idle for >5s perform subtle procedural actions (checking hologram device, sword sheath shine, coffee sip).

---

### 🌐 Phase 2: High-ROI Virality & Growth Engine
*Goal: Turn every existing citizen into an evergreen distribution channel to attract developers and founders.*

- **Dynamic GitHub Profile README Badge (`/api/badge/:username.svg`)**:
  - Auto-generated SVG badge snippet for GitHub profile READMEs (`[Spot Citizen #42 | (52, 60) | Live Avatar]`).
  - Deep-links directly to coordinates: `claimyourspot.lol/world?x=52&y=60&inspect=true`.
- **Shareable Fight & Citizen Victory Cards**:
  - 1-click generation of retro 16-bit victory cards (e.g. *"CYBER RONIN • 7 WIN STREAK • CITIZEN (52, 60)"*) optimized for instant sharing to **X** and **Facebook**.
- **Automated Social Graph Preview Cards (`/api/og/:x/:y.png`)**:
  - Dynamic Satori/Canvas edge generation of Twitter/Discord preview cards showing the user's avatar, coordinate badge, and project name.
- **Community Discord / X Bot for New Claims**:
  - Automated webhook broadcast when a new citizen claims a plot.

---

### 🥊 Phase 3: Arcade Hall of Fame & Multiplayer Brawls
*Goal: Deepen the gaming loop and community competition inside The Byte Cade.*

- **Global Arcade Hall of Fame (Daily Leaderboard)**:
  - Top 5 daily streak champions persisted in PostgreSQL, rendered on the cabinet's CRT screen when idle.
- **2-Player Local Dual Battle**:
  - 2 players on one keyboard: `P1 (WASD + JKL)` vs `P2 (Arrow Keys + NumPad 1,2,3)`.
- **Peer-to-Peer Arcade Challenge**:
  - Challenge any player standing next to the arcade cabinet in `/world` to an instant live cyber brawl.

---

### 🌆 Phase 4: World Immersion & Navigation
*Goal: Deepen the cyber-city atmosphere while keeping 60fps HTML5 Canvas performance.*

- **Holographic Mini-Map Radar**:
  - Floating radar in top-right HUD showing user position, claimed spots, and landmarks (Plaza Fountain, Byte Cade, Wall of Fame).
- **Dynamic Day/Night Lighting & Ambient Glows**:
  - Real-time twilight-to-night transitions where building windows and streetlamps cast soft radial neon halos.
- **Cyberpunk Low-Fi Radio / Chiptune Toggle**:
  - Procedural 8-bit ambient background music toggleable from the top HUD.
- **2.5D Isometric Camera Toggle**:
  - Optional HUD switch (`[2D / 2.5D]`) providing vertical depth to buildings and plots using existing isometric transforms.
- **🎥 Cinematic Tour Mode Camera** *(inspired by multi-view strategy games like "We March as One")*:
  - One-click **Tour** button in the HUD launching an auto-piloted cinematic fly-through gliding over landmarks, the mountain ridge, beach, and citizen hotspots.
  - Smooth eased camera path with slow zoom drift; any input instantly returns control to the player.
  - Doubles as the **video source for the marketing autoposter** (Playwright records the tour for Bluesky / Instagram / X posts).

---

### 💼 Phase 5: Founder Ecosystem & Commercial Monetization
*Goal: Provide tangible marketing ROI for indie startups, SaaS tools, and sponsors.*

- **Thematic Districts & Neighborhoods**:
  - *AI Alley*, *Open Source Grove*, *Indie Boulevard*, *Creator Boardwalk*.
- **Self-Serve Billboard & Event Sponsorship**:
  - Automated booking flow for large billboards along the monorail/transit line (Stripe/LemonSqueezy checkout, 7/30 day slots, impression counter).
- **Featured Spot of the Week**:
  - Weekly community spotlight on the homepage header and in-game marquee blimp.

---

## 📅 Roadmap Schedule & Milestones

| Milestone | Focus | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Milestone 1** | **Arcade Cabinet & Combat** | Spot Fighter II, Byte Snake '84, CRT Bezel, Web Audio Synth, DB Quick-Switch | ✅ **Completed** |
| **Milestone 2** | **Character Sprites & Gear** | 4-way walk cycles, directional gear (backpacks, visors), 3 new archetypes | 🟡 **Next In Line** |
| **Milestone 3** | **Viral Distribution** | GitHub README Badges, Twitter OG Cards, Fight Record Social Share | ⚪ Scheduled |
| **Milestone 4** | **Arcade Leaderboard & 2P** | Global Hall of Fame, local 2-player keyboard duel | ⚪ Scheduled |
| **Milestone 5** | **Immersion & Radar** | Mini-map HUD radar, Day/Night neon cycle, Chiptune soundtrack, Cinematic Tour Mode | ⚪ Scheduled |
| **Milestone 6** | **Founder Economy** | Thematic Districts, Self-Serve Billboards | ⚪ Future |
