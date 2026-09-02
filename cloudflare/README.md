# 🛡️ SPOT — Cloudflare Worker ("Edge Guardian")

A lightweight edge worker that runs on Cloudflare's global CDN network.

If your homelab VPS is ever rebooted, experiences a power outage, or the Docker container is restarting, Cloudflare normally displays a generic, unstyled **"Error 521: Web Server Is Down"** error page.

This Worker intercepts those error codes (`502, 503, 504, 521, 522, 523, 524`) and instead serves a **retro 8-bit cyberpunk "Power Station Recharging"** page with:
- Sleeping pixel astronaut animation (`z Z z`)
- Live heartbeat ping that checks `/health` every 4 seconds
- Instant auto-reload the moment your homelab server comes back online
- Clean JSON responses for API endpoints (`/api/*`)

---

## 🚀 How to Deploy in Cloudflare Dashboard (Takes 2 Minutes)

### Step 1: Create the Worker
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left sidebar, click **Compute (Workers & Pages)** → **Workers & Pages**.
3. Click **Create** → **Create Worker**.
4. Name it `spot-edge-guardian` and click **Deploy**.

### Step 2: Paste the Worker Code
1. On the new worker page, click **Edit code** (top right).
2. Open [`cloudflare/worker.js`](./worker.js) on your computer, copy the entire content, and paste it into the Cloudflare Worker editor (replacing all existing code).
3. Click **Deploy** (top right).

### Step 3: Add Route to your Domain
1. In the Cloudflare Dashboard, go to your domain: **claimyourspot.lol**.
2. On the left sidebar, go to **Workers Routes**.
3. Click **Add route**.
4. Enter:
   - **Route:** `www.claimyourspot.lol/*` (and optionally `claimyourspot.lol/*`)
   - **Worker:** select `spot-edge-guardian`
5. Click **Save**.

That's it! Cloudflare will now transparently proxy all normal traffic to your homelab VPS, and if the homelab is ever offline, visitors will see the branded retro recharging screen instead of Cloudflare's error screen!

---

## 💻 Alternative: Deploy via Wrangler CLI
If you prefer deploying via terminal:

```bash
cd cloudflare
npx wrangler deploy
```
