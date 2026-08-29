# SPOT — Product & Technical Specification

## 1. Product

**Name:** Spot

**Subdomain:** `spot.fazleyrabbi.xyz`

**Tagline:**

> Your place on the Internet.

**Core concept:**

Spot is a persistent, interactive Internet canvas where every person can claim exactly one physical spot and represent themselves with an avatar.

Each person gets:

- one identity
- one avatar
- one spot
- one small profile

The goal is to create a simple, playful, visual directory of people on the Internet rather than another traditional profile/listing website.

---

# 2. Product Philosophy

The project must remain extremely simple.

The core interaction is:

    Visit Spot
        ↓
    See the world
        ↓
    See other people
        ↓
    Claim a spot
        ↓
    Choose an avatar
        ↓
    Add basic identity
        ↓
    Claim
        ↓
    Become part of the world

The project should feel like a small Internet toy rather than a conventional SaaS application.

Do not turn the MVP into:

- a social network
- a full portfolio platform
- an MMORPG
- a complex account system
- a complete virtual world
- a marketplace

The product should be understandable within seconds.

---

# 3. Core User Promise

The entire product should communicate one idea:

> **Claim your spot on the Internet.**

Supporting language may include:

- One person. One avatar. One spot.
- Find your place.
- Your little corner of the Internet.
- Everyone gets one spot.
- The Internet is getting crowded.

---

# 4. MVP

The MVP consists of one primary page.

The page contains:

1. Header
2. World/canvas
3. Avatars
4. Spot interaction
5. Claim flow
6. Profile popup/card
7. Basic statistics

Example:

    ┌────────────────────────────────────────────┐
    │                    SPOT                    │
    │                                            │
    │        🧑       🧑‍💻       🧑               │
    │                                            │
    │   🧑‍🎨       🧑       🧑‍🚀       🧑          │
    │                                            │
    │        🧑       🧑‍💻       🧑               │
    │                                            │
    │                                            │
    │             842 / 10,000                  │
    │                                            │
    │             [ CLAIM A SPOT ]               │
    └────────────────────────────────────────────┘

The world should be immediately understandable without a tutorial.

---

# 5. Phase 0 — Static Visual Prototype

## Goal

Create the visual concept before implementing persistence or multiplayer.

## Stack

- Astro
- TypeScript
- HTML Canvas
- CSS

## Build

Create:

- full-page canvas
- simple background
- grid/spots
- placeholder avatars
- hover state
- click state
- basic camera/panning if needed
- responsive layout
- header
- population counter

Use placeholder geometric characters initially.

Do not use a database.

Do not use WebSockets.

Do not implement authentication.

Do not search for external assets yet.

## Success condition

A user can open the page and immediately understand:

> "This is a place where people occupy spots."

---

# 6. Phase 1 — Spot Grid

## Goal

Introduce the actual spot system.

The world consists of a finite number of claimable locations.

Initial target:

    100 × 100
    = 10,000 spots

This number should be configurable.

Do not hard-code the world size throughout the codebase.

Example configuration:

    WORLD_WIDTH = 100
    WORLD_HEIGHT = 100

Each spot has:

- unique ID
- x coordinate
- y coordinate
- availability
- owner ID

Example:

    spot:
      id: "42,17"
      x: 42
      y: 17
      owner: null

---

# 7. Spot Rules

The fundamental rule is:

> One person can own one spot.

A citizen cannot claim multiple spots.

A spot cannot have multiple owners.

The server must enforce both rules.

Do not rely on frontend validation.

The database must enforce uniqueness where appropriate.

---

# 8. Spot Selection

Available spots should be visually distinguishable.

Interaction:

    Hover spot
        ↓
    Highlight
        ↓
    Click
        ↓
    Show claim UI

If occupied:

    Hover
        ↓
    Show avatar
        ↓
    Click
        ↓
    Show profile

Do not allow an occupied spot to be claimed.

---

# 9. Phase 2 — Anonymous Identity

## Goal

Allow users to participate without registration.

A first-time visitor receives an anonymous identity.

Example:

    citizen_id: "c_9f83a..."
    display_name: "Explorer"
    created_at: 2026-08-29T00:00:00Z

### Token Security & Recovery Model

Since anonymous spots are permanent until account claiming (Phase 7), the recovery token **is** the account. It must be treated with maximum security from day one:

- **Token Generation:** The server generates a cryptographically secure 256-bit random opaque secret upon citizen creation.
- **Storage:** The server stores only the SHA-256 hash of this token in PostgreSQL (`citizens.session_token_hash`).
- **Transport & Client Storage:** Sent to the browser exclusively via an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- **No LocalStorage:** The raw authentication token is **never** stored in `localStorage` or exposed to clientside JavaScript, protecting spots against XSS exfiltration.
- **Public vs Secret Identity:** The browser receives the public `citizen_id` and profile data. All mutating API requests (`/api/spots/claim`, `/api/citizens/me`, WebSocket handshake) authenticate against the `HttpOnly` cookie.

The server remains authoritative.

Do not require:

- email
- password
- OAuth
- account creation

for the initial experience.

The user should be able to claim a spot within seconds.

---

# 10. Citizen Model

Conceptual model:

    Citizen
    ├── id
    ├── display_name
    ├── username
    ├── avatar_id
    ├── tagline
    ├── website_url
    ├── github_url
    ├── linkedin_url
    ├── created_at
    └── updated_at

Only include fields that are actually required.

Avoid turning the profile into a resume.

---

# 11. Profile

Each citizen has a tiny profile.

Example:

    ┌────────────────────────────┐
    │            🧑‍💻            │
    │                            │
    │       Fazley Rabbi         │
    │    Full-stack engineer     │
    │                            │
    │      fazleyrabbi.xyz       │
    │                            │
    │   [ Portfolio ] [ GitHub ] │
    └────────────────────────────┘

The profile should be compact.

Recommended fields:

- avatar
- name
- short tagline
- personal website
- optional GitHub
- optional social/profile link

Do not add a long biography in MVP.

---

# 12. Avatar System

Initially use a fixed collection of predefined avatars.

Do not implement a complicated avatar creator.

Example:

    avatar-01
    avatar-02
    avatar-03
    avatar-04
    ...
    avatar-24

The avatar system must use stable IDs.

Example:

    avatar_id = "astronaut"

The renderer resolves the ID into the appropriate visual asset.

---

# 13. Avatar Asset Strategy

For MVP, avatars may be:

- SVG
- pixel-art sprites
- simple Canvas drawings
- small PNGs

Prefer lightweight assets.

External assets must have a compatible license.

Maintain:

    ASSET-LICENSES.md

Do not use copyrighted characters or recognizable commercial game assets.

---

# 14. Visual Direction

The initial version should be playful and minimal.

Preferred aesthetic:

- pixel-art inspired
- retro Internet
- miniature world
- colorful
- slightly weird
- clean UI
- high readability

Avoid:

- corporate dashboard aesthetics
- excessive gradients
- generic SaaS cards
- over-designed landing-page sections

The canvas should be the primary visual element.

---

# 15. Phase 3 — Persistence

## Goal

Persist citizens and claimed spots.

Database:

    PostgreSQL

Primary entities:

    citizens
    spots

Possible future entities:

    events
    reactions
    visits

Do not create unnecessary tables during MVP.

---

# 16. Database Constraints & Idempotency

The database must guarantee:

- unique citizen ID
- unique spot ID
- one owner per spot (`spots.owner_id UNIQUE`)
- one spot per citizen

The system must remain correct even under high concurrency and network retry scenarios.

---

# 17. Claim Transaction & Network Retries

Claim flow:

    Client
      ↓
    POST /api/spots/claim (with spotId, optional idempotencyKey)
      ↓
    Authenticate citizen via HttpOnly session cookie
      ↓
    Validate input with Zod
      ↓
    Execute atomic claim query
      ↓
    Commit & Broadcast via WS
      ↓
    Return success (200 OK)

### Atomic Claim & Retry Query

To prevent race conditions and handle network timeouts cleanly on retry:

```sql
-- Atomic check & claim:
UPDATE spots
SET owner_id = $1, claimed_at = NOW()
WHERE id = $2 AND (owner_id IS NULL OR owner_id = $1)
RETURNING *;
```

- **Conflict:** If the spot is already occupied by a different citizen, return `409 Conflict`.
- **Idempotent Retry:** If a network timeout occurred after the claim was committed and the client retries, the query succeeds idempotently and returns `200 OK`.
- **Startup Check:** On initial page load, client calls `GET /api/citizens/me` to hydrate ownership state before rendering the claim UI.

---

# 18. API

Use a small API surface.

Potential endpoints:

    GET  /api/world
    GET  /api/citizens/:id
    POST /api/citizens
    POST /api/spots/claim
    PATCH /api/citizens/me
    GET  /api/stats

Do not build a large REST API.

---

# 19. World API

The client needs enough data to render occupied spots.

Example response:

    {
      "width": 100,
      "height": 100,
      "occupied": [
        {
          "spotId": "42,17",
          "citizenId": "...",
          "avatarId": "astronaut",
          "displayName": "Fazley"
        }
      ]
    }

Do not send unnecessary private information.

---

# 20. Phase 4 — Realtime

## Goal

Make the world feel alive.

Add:

    Node.js
    TypeScript
    WebSocket (`ws`)

When a user claims a spot, connected clients should see the new avatar without refreshing.

Events may include:

    citizen:joined
    citizen:left
    spot:claimed
    citizen:updated

Keep the protocol small and explicit.

---

# 21. WebSocket Rules

The server is authoritative.

Clients must not be able to broadcast arbitrary world state.

Example:

Client:

    claim spot

Server:

    validate
    persist
    broadcast

Never:

    client → "I own this spot"
    server → blindly broadcast

---

# 22. Online Presence

Realtime presence is separate from permanent ownership.

A citizen can be:

    online
    offline

Being offline does NOT release the spot.

The spot remains permanently associated with the citizen until the product explicitly supports account/spot transfer.

---

# 23. Online Indicator

If useful, show a small indicator:

    🟢 online
    ⚪ offline

Do not make presence the primary mechanic.

The important thing is persistent identity.

---

# 24. Phase 5 — Better Canvas

Once persistence and realtime functionality work, improve the visual experience.

Potential additions:

- isometric-style grid
- subtle depth
- avatar idle animation
- hover effects
- camera zoom
- smooth panning
- ambient particles
- small decorative objects

Do not introduce 3D yet.

The underlying world data must remain renderer-independent.

---

# 25. Renderer Abstraction

Keep world state separate from rendering.

Conceptually:

    World State
        ↓
    Renderer Interface
        ↓
    Canvas Renderer

Later:

    World State
        ↓
    Renderer Interface
        ↓
    Three.js Renderer

The database and multiplayer systems must not depend on Canvas or Three.js.

---

# 26. Future 3D Version

3D is a future visual upgrade, not an MVP requirement.

When the product proves interesting, a future version may introduce:

- Three.js
- OrthographicCamera
- low-poly 3D avatars
- low-poly environment
- GLB/GLTF assets
- isometric camera
- 3D lighting
- 3D interaction

The logical model should remain:

    spot
    x
    y
    citizen
    avatar

The renderer decides how those entities look.

---

# 27. Statistics

Display simple global statistics.

Example:

    SPOT

    842 / 10,000 claimed
    37 online

Potential additional statistics:

- total citizens
- spots remaining
- newest citizen
- oldest citizen
- recently claimed spots

Do not create complicated analytics dashboards.

---

# 28. Discovery

The world should encourage exploration.

Users should be able to:

- click avatars
- inspect profiles
- discover websites
- find interesting people

Potential future features:

    Search
    ↓
    Find citizen
    ↓
    Focus camera on spot

Do not require search for MVP.

---

# 29. Shareability

Each citizen should eventually have a shareable URL.

Example:

    spot.fazleyrabbi.xyz/?citizen=abc123

or:

    spot.fazleyrabbi.xyz/c/abc123

Opening the link should focus on that citizen's spot and show their profile.

This makes individual spots shareable.

---

# 30. Social Loop

The core loop should be:

    Visit
      ↓
    Explore
      ↓
    Discover people
      ↓
    Click profiles
      ↓
    Find interesting people
      ↓
    Claim your own spot
      ↓
    Share your spot
      ↓
    Bring another visitor
      ↓
    Repeat

Every feature should strengthen this loop.

---

# 31. Claim Flow UX

The claim process should take less than 30 seconds.

Recommended:

    Click "Claim a Spot"
          ↓
    Choose available spot
          ↓
    Choose avatar
          ↓
    Enter name
          ↓
    Optional tagline
          ↓
    Optional website
          ↓
    Claim
          ↓
    Welcome to Spot

Avoid multi-page onboarding.

---

# 32. Returning User

Returning anonymous users should be recognized.

Flow:

    Visit
      ↓
    Recover local identity
      ↓
    Load citizen
      ↓
    Focus/indicate their spot
      ↓
    Continue exploring

If local identity is unavailable, the user may be treated as a new visitor.

Provide a future account-claiming mechanism to prevent permanent loss of ownership.

---

# 33. Account Claiming — Future

Later allow users to associate an anonymous citizen with:

- GitHub
- Google
- email
- another identity provider

The important requirement:

    anonymous citizen
          ↓
    account claim
          ↓
    preserve existing spot

Do not force authentication before participation.

---

# 34. Moderation & Input Safety

Because users can publish external links and taglines, security and sanitization must be enforced from **Phase 2 & 3** (the moment profiles exist), not deferred to late hardening:

- **Protocol Enforcement:** Only `http:` and `https:` schemes allowed for `website_url`, `github_url`, and `linkedin_url`. Strictly reject `javascript:`, `data:`, or `vbscript:` schemes.
- **Strict Length Limits:**
  - `display_name`: max 32 chars
  - `tagline`: max 80 chars
  - `website_url` / links: max 256 chars
- **Safe Link Rendering:** All external user links must render with `target="_blank" rel="noopener noreferrer nofollow"`.
- **XSS Prevention:** Never use raw HTML insertion (`innerHTML`, `dangerouslySetInnerHTML`). Render all user text via Canvas text primitives or HTML textContent bindings.
- **Server-Side Validation:** All constraints validated on the backend via Zod schemas.

---

# 35. Rate Limiting & Anti-Hoarding

Because there is no upfront authentication, rate limiting is the primary anti-abuse backbone to prevent bot scripts from hoarding the 10,000 spots.

Enforce from **Phase 2 (Identity & Persistence)**:

- **Citizen Creation:** Sliding-window rate limit per IP (e.g., max 5 anonymous citizen creations per IP per 24 hours).
- **Spot Claiming:** Max 2 claim attempts per IP per minute; max 1 successful claim per IP per hour.
- **Profile Updates:** Max 10 updates per minute per citizen.
- **Bot Mitigation:** Support lightweight invisible verification (e.g. Cloudflare Turnstile) if suspicious bot spikes occur.
- **WebSocket Connections:** Connection rate limits per IP to protect server resources.

---

# 36. Security

The server must validate all user input.

Use:

    Zod

for request/message schemas.

Validate:

- names
- URLs
- avatar IDs
- spot IDs
- identifiers

Do not trust:

- client coordinates
- client ownership state
- client identity claims
- client-generated database IDs

---

# 37. Technology Stack

## Frontend

    Astro
    TypeScript
    HTML Canvas
    CSS

## Backend

    Node.js
    TypeScript
    WebSocket (`ws`)

## Database

    PostgreSQL

## Validation

    Zod

## Optional Later

    Redis

## Infrastructure

    Docker
    Docker Compose
    Ubuntu Server
    Cloudflare Tunnel

---

# 38. Redis Policy

Do NOT make Redis a mandatory dependency for the initial deployment.

Start with:

    Astro
    Node
    PostgreSQL

Introduce Redis when required for:

- multiple WebSocket servers
- cross-instance pub/sub
- distributed presence
- high concurrent traffic
- ephemeral state

Avoid infrastructure complexity without a measurable need.

---

# 39. Deployment

Initial production environment:

    Ubuntu Server
          ↓
    Docker Compose
          ↓
    ├── web
    ├── api
    └── postgres

Cloudflare Tunnel exposes the application.

Use environment variables for:

- database credentials
- application secrets
- public URLs
- configuration

Never commit secrets.

---

# 40. Backup

PostgreSQL must be backed up.

At minimum:

- scheduled database dumps
- backup retention
- documented restore process

Because the entire value of Spot is persistent user-created data, losing the database is unacceptable.

---

# 41. Performance

The initial canvas should comfortably render thousands of spots.

Do not create unnecessary DOM elements for every spot.

Prefer Canvas rendering for the world.

Only use HTML elements for:

- menus
- profile panels
- buttons
- overlays
- forms

Avoid:

    10,000 DOM nodes

for:

    10,000 spots

---

# 42. Mobile

Desktop is the primary target.

The MVP should still be usable on mobile.

Support:

- touch/tap
- responsive UI
- readable profile card
- basic zoom/pan

Do not optimize for complex mobile interactions before desktop is stable.

---

# 43. Accessibility

The canvas must not be the only way to access important information.

Provide accessible UI for:

- claim action
- profile information
- navigation
- buttons
- forms

Interactive profile information should be available through conventional HTML UI.

---

# 44. SEO

The main Spot page should have:

    title:
    Spot — Your place on the Internet

    description:
    Claim your spot on a shared Internet canvas.

Individual citizen pages should eventually have dynamic metadata where practical.

Do not over-optimize SEO.

The primary growth mechanism is expected to be sharing and curiosity.

---

# 45. Analytics

Avoid invasive analytics.

Initially track only aggregate metrics such as:

- total citizens
- claimed spots
- active connections
- daily claims

Do not collect unnecessary personal information.

---

# 46. Project Structure

Suggested structure:

    spot/
    ├── apps/
    │   ├── web/
    │   └── server/
    │
    ├── packages/
    │   ├── shared/
    │   └── world/
    │
    ├── database/
    │   ├── migrations/
    │   └── seeds/
    │
    ├── public/
    │   └── avatars/
    │
    ├── docs/
    │
    ├── docker-compose.yml
    ├── ASSET-LICENSES.md
    └── SPEC.md

The exact structure may be adjusted to suit the implementation, but shared world types and protocol definitions should not be duplicated.

---

# 47. Shared Types

Share TypeScript types between client and server.

Examples:

    Citizen
    Spot
    WorldState
    Avatar
    WebSocketMessage
    ClaimSpotRequest
    ClaimSpotResponse

This reduces protocol drift.

---

# 48. Development Phases

Implementation order:

## Phase 0

Static Canvas prototype (Astro + Canvas + mock grid + camera pan/zoom).

## Phase 1

Configurable claimable spot grid math & renderer abstraction.

## Phase 2

Anonymous identity (`HttpOnly` cookie session token), PostgreSQL persistence, database unique constraints, idempotent atomic claim transaction, initial IP rate limiting & Zod input validation/URL sanitization.

## Phase 3

Persistent citizen profiles, profile cards, and safe external link rendering.

## Phase 4

WebSocket realtime updates (`ws` broadcast of claimed spots & live presence).

## Phase 5

Visual polish, smooth animations, and enhanced avatar sprite assets.

## Phase 6

Shareable citizen URLs (`/c/:citizenId` with deep-linking & viewport focus).

## Phase 7

Account claiming (associate anonymous citizen to permanent OAuth/email while preserving spot).

## Phase 8

Optional 3D / isometric renderer (leveraging the decoupled world state).

## Phase 9

Automated backups, abuse reporting tools, and production infrastructure hardening.

Do not skip ahead unless there is a concrete reason.

---

# 49. What NOT To Build Initially

Do not implement:

- payments
- subscriptions
- NFTs
- cryptocurrency
- marketplace
- complex chat
- followers
- likes
- comments
- full social graph
- elaborate authentication
- AI avatars
- procedural 3D world
- MMORPG mechanics
- inventory
- economy
- achievements
- clans
- multiplayer combat
- complex animations
- microservices
- Kubernetes

The first version should remain tiny.

---

# 50. Future Ideas

Only consider these after the core system works:

- avatar movement
- small personal spaces
- reactions
- guestbook
- profile customization
- city neighborhoods
- events
- seasonal themes
- rare avatar styles
- interactive landmarks
- 3D world
- Netropolis-style expansion

These are optional.

---

# 51. Netropolis Relationship

Spot should be treated as the minimal foundation for the larger Netropolis concept.

Conceptually:

    SPOT
      │
      │ one person
      │ one avatar
      │ one location
      ▼
    SHARED WORLD
      │
      │ people gather
      ▼
    PERSONAL SPACES
      │
      │ objects/buildings
      ▼
    NETROPOLIS

Do not implement Netropolis features until Spot proves that people actually enjoy occupying and exploring the shared world.

---

# 52. Definition of Success

The MVP is successful when:

1. A visitor can understand Spot within seconds.
2. A visitor can claim a spot in under 30 seconds.
3. Each citizen can own only one spot.
4. Each spot can have only one citizen.
5. Refreshing the page preserves the citizen.
6. Other users can see claimed spots.
7. New claims appear in realtime.
8. Clicking an avatar opens its profile.
9. A profile can link to an external portfolio/product.
10. The system survives simultaneous claim attempts correctly.
11. The world feels visually interesting even with simple graphics.
12. The entire application can run in Docker on the existing server infrastructure.

---

# 53. Product Principle

Always prioritize:

    SIMPLE
      ↓
    IMMEDIATE
      ↓
    FUN
      ↓
    SOCIAL
      ↓
    PERSISTENT
      ↓
    BEAUTIFUL

Do not optimize for feature count.

The strongest version of Spot is one where someone can send a friend a link and say:

> "Go claim your spot."

And the friend immediately understands what to do.

---

# 54. Final Implementation Instruction

Build the project incrementally according to the phases above.

Start with Phase 0.

Do not implement future phases prematurely.

At the end of each phase:

1. Verify the application works.
2. Verify the core interaction manually.
3. Keep the implementation simple.
4. Refactor obvious technical debt.
5. Document important architectural decisions.
6. Only then proceed to the next phase.

The project should remain small enough that one developer can understand the entire system.

The ultimate vision is:

> **Spot is a tiny persistent piece of the Internet where everyone gets one place.**