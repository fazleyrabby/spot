# Changelog

All notable changes to SPOT are documented here.

---

## [Unreleased]

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
- Cache world snapshot with 10s TTL; run Vercel function in `sin1` region near DB
- Configure Astro output for Vercel
- Enable SSL for Supabase pooler connections
- Bundle server into `api/_server-bundle.mjs` for Vercel deployment
- Override Vercel routes so catch-all matches all `/api/*` paths

---

<!-- 
  How to update this file:
  Add a new dated section at the top under [Unreleased] when you ship changes.
  Keep entries grouped by: Added | Changed | Fixed | Security | Removed | Infrastructure
-->
