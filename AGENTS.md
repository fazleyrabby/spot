# Antigravity Workspace Guidelines & Shortcuts

## Database Switching (Local Docker <-> VPS Production)

Quick-switch commands for instant database swapping:
- **Switch to VPS Prod DB**: `pnpm db:vps` (or `./scripts/switch-db.sh vps`)
- **Switch to Local Docker DB**: `pnpm db:local` (or `./scripts/switch-db.sh local`)

### How it works:
- **VPS DB**: Secure SSH port-forward to `homelab` (192.168.0.222) container `spot-postgres` (port 65432).
- **Local DB**: Docker Postgres container on port 55432.
- Automatically swaps `.env.local` and hot-reloads `apps/server/src/index.ts`.
