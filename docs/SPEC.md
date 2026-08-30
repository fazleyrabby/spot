# SPOT — Product Spec

**A 10,000-tile canvas where everyone gets a permanent square of the internet.**

This spec covers **what SPOT is today** and **what it could become**. The roadmap
is ordered roughly by *impact ÷ effort* — contained, visual ideas first, so the
map feels alive quickly.

---

## 1. The Concept

One giant 100×100 grid. Every tile is a permanent coordinate. You claim one,
plant your 8-bit avatar, link your portfolio + socials, and you're a **Citizen
of the Internet**. Neighbors, explorers, and the world can find you.

It's part social map, part collectible, part identity. The core loop:

```
discover a spot → claim it forever → deck it out → share it → meet your neighbors
```

---

## 2. Current Features (shipped)

| Area | What exists |
|------|-------------|
| **The Canvas** | Custom 60fps HTML5 canvas engine, pan/zoom with inertia, 100×100 = 10,000 tiles |
| **Claiming** | Permanent, atomic claims — one spot per citizen, race-safe (nobody double-claims) |
| **Avatars** | 8-bit retro catalog **+ upload a photo → auto-pixelized avatar** (8/16/32 res) |
| **Identity** | Display name, tagline, website + 7 social links (GH, X, FB, IG, YT, LI, website) |
| **Auth** | 1-click GitHub OAuth via Supabase; guest claims via opaque token |
| **Badges** | 👑 Founder (gold), ✅ GitHub-verified (cyan), 🟢 Citizen (green) |
| **Search** | `⌘K` global search across citizens/spots/taglines, glide-to-spot |
| **Profiles** | View/edit modal, copy share link, cross-device token sync |
| **Realtime** | Live presence count, SSE events on long-running hosts |
| **Stats** | Claimed count, online count, 24h visitor counter |
| **Moderation** | Server-side profanity filter + warn/block, GDPR right-to-erasure |
| **Security** | All writes via authoritative backend; public key is read-only (RLS lockdown) |

---

## 3. Roadmap — Make It a Living City

### A. Feel Alive (high impact, low effort)

**A1. Live map presence — glowing dots**
Pulse a soft glow on spots whose owner is online right now. We already track
`onlineCount`; this makes the city visibly breathe. *Low effort, huge "living
city" payoff.*

**A2. Recent activity ticker**
A scrolling HUD feed: `🎉 @hamid claimed (53,60)` · `✏️ @sojon updated profile`.
Generates FOMO, makes the map feel like it's happening *right now*. Combined
with the existing SSE events, it's a natural fit.

**A3. Neighborhoods / districts**
Auto-name 10×10 blocks — *Sector 5, Pixel Quarter, The Marina*. Show the
district on hover + a legend. Gives the map structure, gives neighbors a shared
identity, and gives people a reason to coordinate.

**A4. Rare coordinates**
Flag landmark tiles — `(0,0)`, `(99,99)`, `(50,50)` — as **Prime Spots** with a
special badge/frame. Adds a hunt/collector angle and talk-of-the-map moments.

**A5. Spot comments / wall**
A small message board pinned to each spot. Turns a static claim into a social
surface ("this is where we met", shout-outs, memes).

### B. Grow (virality & stickiness)

**B1. Referral chains**
"Claim a spot *adjacent* to your referrer" — reward density and spread. Show
referral count on the profile. Growth with a built-in map mechanic.

**B2. Neighbor ping**
When someone claims a tile next to yours, notify you. Encourages meeting your
neighbors — the sticky-est thing a social product can do.

**B3. Share cards (OG image)**
Generate a branded image of a spot for link previews. `@vercel/og` endpoint at
`/api/og?x=53&y=60` makes every shared link look premium. *We already have
`qrcode`; this is the polish that makes links feel special.*

### C. Go Deep (identity & lore)

**C1. Mini-home bio**
A short "bio post" pinned on your spot — visitors read it on hover. Your tile
becomes your little corner of the internet, not just a link card.

**C2. Spot history**
Show previous owners of a spot (an audit trail). Rare tiles collect lore —
"claimed by X, then Y, then you." Adds depth and storytelling.

**C3. Community clusters / guilds**
Join a district guild — *Dev District, Art Alley*. Badge on profiles. Group
identity beyond a single tile.

### D. Monetize (optional — support/Payoneer already exists)

**D1. Spot auction for Prime Spots**
Bids for the few landmark coordinates. Scarcity + social proof = the most
defensible revenue lever.

---

## 4. Suggested First Builds

**Priority pair:** **A2 (activity ticker)** + **A3 (districts)** — both contained,
visual, and instantly make the map feel alive. **A1 (presence glow)** is the
cheapest "wow" after that.

Order of attack if you want momentum:
1. **A1** — presence glow (tiny, visual)
2. **A2** — activity ticker (SSE already exists)
3. **A3** — districts (pure client-side math)
4. **B3** — OG share cards (marketing win for every claim)

---

## 5. Non-Negotiables (constraints)

- **Security first:** all writes through the server; never loosen the RLS lockdown.
- **One spot per citizen** stays — it's the scarcity that makes claims matter.
- **GDPR right-to-erasure** stays — deletion must always be possible.
- **Performance:** the canvas stays 60fps; server responses stay sub-second
  (cache `/world`, run functions near the DB).
