# 🗺️ SPOT — Future Roadmap & Product Expansion Plan

> **Mission**: Build the internet's most iconic, permanent, and playful 10,000-plot cyber world where developers, founders, and creators claim their plot, showcase their work, and connect in a living 60fps canvas city.

---

## ⚡ Phase 1: High-ROI Virality & Growth Engine (Immediate Priority)
*Goal: Turn every existing and new citizen into an evergreen distribution channel to attract devs and founders.*

### 1.1 Dynamic GitHub Profile README Badge (`/api/badge/:username.svg`)
- **What**: Provide every citizen with an auto-generated SVG badge snippet to paste into their GitHub profile README (`github.com/username/username`).
- **Visual**: Pixel-styled badge displaying `[Spot Citizen #4242 | (52, 60) | Live Avatar]`.
- **Action**: Clicking the badge deep-links directly to their coordinates on `claimyourspot.lol/world?x=52&y=60&inspect=true`.
- **Impact**: Every person visiting a developer's GitHub profile sees Spot and is invited to claim an adjacent plot.

### 1.2 Automated Social Graph (Open Graph) Preview Cards (`/api/og/:x/:y.png`)
- **What**: Dynamic Satori/Canvas edge generation of Twitter/Discord preview cards showing the user's avatar, coordinate badge, and project name.
- **Impact**: When users tweet their link, it renders a bold cyber-card instead of a generic website thumbnail.

### 1.3 Discord / Telegram / Twitter Bot for New Claims
- **What**: Automated webhook bot that tweets/posts whenever a new citizen claims a spot:
  > *"🚀 Welcome @developer to plot (34, 82) in the Downtown District! Claim your spot at claimyourspot.lol"*
- **Impact**: Creates steady proof-of-life and social proof.

---

## 🎮 Phase 2: Gamification & Plot Personalization (Retention)
*Goal: Give citizens a reason to revisit, customize their space, and interact with neighbors.*

### 2.1 Mini-Plot Decorator (Micro-Voxel Props)
- **What**: Allow citizens to place 1 or 2 small pixel props on their occupied plot:
  - *Tech Gear*: Server rack, Dual-monitor battle station, Cyber coffee machine.
  - *Pets*: Sleeping pixel cat, cyber dog, hovering drone.
  - *Landmarks*: Neon flag, solar panel, bonsai tree.
- **Why it matters**: Turns plots from static icons into personalized digital homes.

### 2.2 Guestbook & High-Fives ("Spot Wall")
- **What**: Let visitors leave quick 1-click pixel reactions (⚡ +1, 🔥 fire, ☕ coffee) or short 80-character visitor notes on a citizen's plot.
- **Notification**: Send an optional weekly digest: *"34 developers visited your spot this week and left 12 reactions!"*

### 2.3 Genesis Citizen Perks & Tiered Hologram Borders
- **What**: First 1,000 citizens receive an exclusive glowing cyan/gold border on their plot and a "Genesis Citizen" badge on their 3D profile card.

---

## 🌆 Phase 3: World Immersion & 2.5D Elevation
*Goal: Deepen the cyber-city atmosphere while keeping the ultra-fast 60fps HTML5 Canvas performance.*

### 3.1 Toggleable 2.5D Isometric Camera Angle
- **What**: An optional HUD toggle (`[2D / 2.5D]`) that switches the projection to an isometric tilt (SimCity / Final Fantasy Tactics style), giving buildings, trees, and citizens vertical height.
- **Implementation**: Reuse `@spot/world` isometric transform utilities with zero extra asset weight.

### 3.2 Dynamic Day/Night Lighting & Neon Glows
- **What**:
  - As time transitions to Twilight and Night, building windows light up with warm amber and cyan glows.
  - Streetlamps and billboards cast real-time soft radial light halos onto the pavement.
  - Occasional ambient neon flicker for high-density cyber districts.

### 3.3 Mobile Virtual Joystick / D-Pad
- **What**: An optional floating thumb joystick or retro NES-style D-pad in the bottom corner of mobile screens for users who prefer stick controls over click-to-walk.

---

## 💼 Phase 4: Founder & Commercial Ecosystem (Monetization)
*Goal: Provide tangible marketing ROI for indie startups, SaaS tools, and sponsors.*

### 4.1 "Districts" / Thematic Neighborhoods
- Organize the 100x100 island into recognizable hubs:
  - **AI Alley**: For AI tools, models, and LLM wrappers.
  - **Open Source Grove**: For libraries, frameworks, and OSS maintainers.
  - **Indie Boulevard**: For bootstrapped micro-SaaS and solo founders.
  - **Boardwalk & Beach**: For podcasts, newsletters, and creative creators.

### 4.2 Self-Serve Billboard & Event Sponsorship
- **What**: Automated booking flow for the large billboard spaces along the train line:
  - Select billboard → Upload banner art & target URL → Checkout via LemonSqueezy/Stripe → Live on island for 7 / 30 days.
  - Live impression & click counter in the sponsor modal.

### 4.3 Featured Spot of the Week
- Weekly community spotlight featured on the homepage banner, in-game blimp marquee, and Twitter broadcast.

---

## 📱 Phase 5: Mobile & Performance Polish
- [ ] **PWA (Progressive Web App)**: Add `manifest.json` and service worker so users can install Spot directly to their iOS/Android home screen like a native retro game.
- [ ] **Haptic Feedback**: Subtle vibration on mobile devices when claiming a spot, popping chat bubbles, or discovering a secret.
- [ ] **Low-Power Mode**: Automatic framerate throttling (60fps → 30fps) when device battery saver is active.

---

## 📅 Suggested Implementation Schedule

| Milestone | Target | Key Deliverable |
| :--- | :--- | :--- |
| **Sprint 1 (Growth)** | Next 1–2 Weeks | Dynamic GitHub README Badges + Twitter OG Generator + Reddit Launch |
| **Sprint 2 (Social)** | Weeks 3–4 | High-Fives / Guestbook Wall + 3D Card sharing polish |
| **Sprint 3 (Customization)** | Month 2 | Plot Decorator (micro-props & pets) + Founder Districts |
| **Sprint 4 (Immersion)** | Month 3 | 2.5D Isometric View Toggle + Self-Serve Billboards |
