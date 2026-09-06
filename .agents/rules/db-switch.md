# Database Switching (Local Docker <-> VPS Production)

When the user asks to switch between local and VPS database, execute the switch instantaneously:

## Switching to VPS Production Database:
Run:
```bash
./scripts/switch-db.sh vps
# or: pnpm db:vps
```
This:
1. Opens an SSH tunnel to `homelab` (192.168.0.222) mapping `10.210.3.2:5432` -> `localhost:65432`
2. Copies `.env.local.vps` to `.env.local`
3. Touches `apps/server/src/index.ts` to trigger immediate hot-reload
4. Verifies via `curl -s http://localhost:5050/api/stats` (21 claimed spots, 24 citizens)

## Switching to Local Docker Database:
Run:
```bash
./scripts/switch-db.sh local
# or: pnpm db:local
```
This:
1. Copies `.env.local.docker` to `.env.local`
2. Touches `apps/server/src/index.ts` to reload
3. Uses local Docker PostgreSQL on port 55432

## VPS Database Credentials:
- **Host**: `homelab` (192.168.0.222) via SSH key `~/.ssh/homelab`
- **Docker Container**: `spot-postgres` (Internal IP `10.210.3.2:5432`)
- **Port Forward**: `localhost:65432`
- **DB Name**: `spot_db`
- **User**: `spot_user`
- **Password**: `c8ee7a37c0dc606856bf9b4373c5f277`
