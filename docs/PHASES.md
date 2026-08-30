# SPOT — The Great Lockdown (a phase-by-phase story)

> Every line of this repo has a story. This is the story of the night we
> discovered anyone with a browser could delete your city, steal spots, and
> walk off with other people's identities — and how we locked it all down.
> Each phase is a chapter: **why it happened, what we did, and the scars we
> kept.**

---

## Chapter 1 — "Wait, that's a public key?"

**The horror:** The Supabase *anon* key lives in plain sight inside the JS bundle. That's fine for reads... except the database handed that key the keys to the kingdom:

| Attack | The button anon had | What we saw |
|--------|--------------------|-------------|
| Vaporize citizens | `DELETE /citizens` | `204` — poof, gone |
| Steal spots | `PATCH /spots` | `204` — yours is now mine |
| Identity theft | `SELECT session_token_hash` | `200` — every login token, leaked |

Anyone could delete your whole city, claim any square, or log in as anyone.
**Decision:** build a real backend, route everything through it, and turn the
anon key into a *glorified viewing window*.

**The plan (Option 3):**
```
browser ──> /api/* ──> Express (authoritative) ──> Postgres
               └──── anon key now can only LOOK, never touch
```

---

## Chapter 2 — Building the Bouncer (the Express server)

**The bouncer does everything:** claims spots atomically (no two people get the
same square — `23505` becomes a polite `409`), edits/deletes profiles, syncs
GitHub logins, serves `/world`, searches citizens. It even runs a profanity
bouncer: say something nasty and your name becomes `****`, you get a warning,
three strikes and your IP is out.

**The split-personality trick:** `app.ts` is pure logic (never listens), while
`index.ts` is the "run forever" mode for long-lived hosts. On Vercel the bouncer
gets called per-request instead.

---

## Chapter 3 — Pointing the Browser at the Bouncer

The frontend now sends every write through `/api/*`. If the server *answers*,
we **trust it** — even when it says "not logged in." (That one-line fix stopped
a whole class of "my session is broken" 401s later.)

> **Battle scar:** direct-mode fallback code still exists for local dev, but
> after the lockdown it must only `SELECT` safe columns. `select('*')` now
> explodes with 401 — the DB is telling the browser "mind your own business."

---

## Chapter 4 — Serving Express from a Static Site (Vercel edition)

An Astro static site hosting a full Express API sounds impossible. It isn't —
it just took *several* fights:

- **The phantom dist:** workspace packages pointed at `./dist` that didn't exist
  on a fresh deploy. Fix: point exports at `./src` so the bundler eats TypeScript directly.
- **The import wall:** Vercel refused to bundle code living *outside* the web app.
  Fix: `scripts/build-api.mjs` esbuild-bundles the server into
  `api/_server-bundle.mjs` (committed!) — workspace packages inlined, npm deps external.
- **Missing types:** `Cannot find module 'node:http'` → add `@types/node`.
- **Lazy, always lazy:** the DB pool is created on first use, and dotenv is
  wrapped in try/catch — a cold function must never die at import time.

**Rule of thumb:** touch `apps/server/src/*` → run
`node apps/web/scripts/build-api.mjs` → commit → push.

---

## Chapter 5 — The Case of the Missing Route

`/api/world` worked. `/api/citizens/me` → Vercel `NOT_FOUND`. Same function,
same day, different depth.

**Vercel generated a broken route table** for `api/[...path].ts`:
- `/api/world` ✓ (one segment)
- `/api/citizens/me` ✗ (two segments → hard 404, never reached Express)

**The fix:** we override Vercel's routes in `vercel.json` so the catch-all
actually catches all: `^/api/(.*)$` → the function. Watch the route table build
locally with `npx vercel build --yes && cat .vercel/output/config.json`.

---

## Chapter 6 — The Database That Only Speaks IPv6

The DB wouldn't connect. `getaddrinfo ENOTFOUND`. Turns out the project's
direct host (`db.<ref>.supabase.co`) is **IPv6-only**, and Vercel couldn't see it.

The rescue: the **pooler** — and finding which region actually hosts the tenant
took probing every `aws-0-<region>.pooler.supabase.com` until one answered:
```
ap-southeast-1  →  1   ← the winner 🏆
```
Use the **session pooler** (`:5432`) for serverless. Also: the password needs
URL-encoding, and *rotate it if it ever appears in a chat log*.

---

## Chapter 7 — The Lockdown (anon key gets demoted to tourist)

Now that the bouncer exists, we take the anon key's write powers away:

- Drop all public `INSERT/UPDATE/DELETE` policies on `citizens` & `spots`.
- Enable RLS on `moderation_flags` (server-only table).
- Recreate `increment_visitors()` as `SECURITY DEFINER` so the counter still ticks.

**The sneaky gotcha:** `REVOKE SELECT (session_token_hash)` does **nothing**
while `anon` still holds *table-level* SELECT. The real fix is surgical:
```
REVOKE ALL ON citizens FROM anon;           -- strip it all
GRANT SELECT (safe, public columns...)      -- give back only the public bits
```
After this, the anon key can read *profiles* but never *secrets*.

**Proof (fired from a browser with the public key):**
```
select=session_token_hash  → 401   🔒
select=id,display_name     → 200   ✅
DELETE citizens            → 401   🔒
PATCH citizens             → 401   🔒
POST citizens              → 401   🔒
```

---

## Chapter 8 — Rescuing the Founding Citizens

Lockdown done. Then the founder logged in and saw... "Claim a Spot"?? Two ghosts:

**Ghost A — old tokens:** pre-server accounts had `direct_auth_<random>` stored
*raw*. The new server hashes tokens with SHA-256, so the hashes never matched.
**Exorcism:**
```sql
UPDATE citizens SET session_token_hash = encode(digest(session_token_hash,'sha256'),'hex')
WHERE session_token_hash LIKE 'direct_auth_%';
```

**Ghost B — duplicate citizens:** the browser sends `githubId: user.id` (a
Supabase **UUID**), but accounts carry the *numeric* GitHub ID. No match →
the server lovingly created a **brand-new citizen with no spot**. Fix: fall
back to matching by `github_url` username, then persist the real `github_id`.

**Final plot twist:** `localStorage` is per-origin. A token saved on `localhost`
is invisible to `claimyourspot.lol`. That's not a bug — it's why GitHub OAuth
is the "re-attach to your identity" button.

---

## Chapter 9 — Making It Feel Fast

- `/api/world` gets a 10-second in-memory cache (invalidated on claim/update/delete).
- The function runs in `sin1` (Singapore), next door to the `ap-southeast-1` DB —
  a ~230ms round trip became ~0.3s warmed.

---

## Runbook (the boring but important part)

| Thing | Command |
|-------|---------|
| Deploy | push to `main` → auto-deploy (wait 2–4 min) |
| Check deploys | `vercel ls spot-web` |
| Fix stale domain | `vercel alias set <url> claimyourspot.lol` (+ `www.`) |
| Rebuild API bundle | `node apps/web/scripts/build-api.mjs` |
| Inspect live routes | `cd apps/web && npx vercel build --yes && cat .vercel/output/config.json` |
| Backup DB | `pg_dump` (see Chapter 6 creds) → `~/Desktop/spot-backup/` |

## Unfinished Business

- [ ] Rotate the DB password (it once appeared in a chat) → update Vercel.
- [ ] Sweep the now-dead direct-mode *write* paths out of `supabase.ts`.
- [ ] Delete the accidental `spot` / `web` Vercel projects from CLI experiments.
