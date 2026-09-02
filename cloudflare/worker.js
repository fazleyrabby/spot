/**
 * SPOT Edge Guardian — Cloudflare Worker
 * 
 * Proxies traffic to the SPOT homelab VPS origin.
 * If the VPS is down (rebooting, power outage, or Cloudflare 502/503/504/521/522/523 errors),
 * it catches the failure and serves a self-contained, retro 8-bit cyberpunk "Server Recharging"
 * maintenance page with live auto-reconnect polling.
 */

const SERVER_DOWN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Recharging — SPOT</title>
  <link rel="icon" type="image/png" href="https://www.claimyourspot.lol/favicon.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #090b10;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    /* Ambient Cyber Background */
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(0, 240, 255, 0.04) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(circle at center, black 40%, transparent 85%);
      pointer-events: none;
    }

    .scanlines {
      position: absolute;
      inset: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
      background-size: 100% 4px;
      opacity: 0.35;
      pointer-events: none;
    }

    /* Card Container */
    .card {
      position: relative;
      z-index: 10;
      max-width: 500px;
      width: 100%;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 2.25rem 2rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.1);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Header Telemetry */
    .telemetry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #94a3b8;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .badge-offline {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: #f59e0b;
      font-weight: 600;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Sleeping Astronaut Scene */
    .art-scene {
      position: relative;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }

    .pixel-sleeper {
      filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
      animation: gentleBreathing 3.6s ease-in-out infinite;
    }

    @keyframes gentleBreathing {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-4px) scale(1.02); }
    }

    /* Floating Z particles */
    .z-particle {
      position: absolute;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-weight: 800;
      color: #00f0ff;
      opacity: 0;
      animation: floatZ 3s infinite;
    }

    .z-1 { top: 10px; right: 190px; font-size: 14px; animation-delay: 0s; }
    .z-2 { top: -2px; right: 175px; font-size: 18px; animation-delay: 1s; }
    .z-3 { top: -14px; right: 160px; font-size: 22px; animation-delay: 2s; }

    @keyframes floatZ {
      0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
      30% { opacity: 0.85; }
      80% { opacity: 0.4; transform: translate(12px, -24px) scale(1.1); }
      100% { opacity: 0; transform: translate(18px, -36px) scale(1.3); }
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p {
      font-size: 0.95rem;
      line-height: 1.55;
      color: #94a3b8;
      margin-bottom: 1.75rem;
    }

    p strong { color: #e2e8f0; }

    /* Live Ping & Countdown */
    .reconnect-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.82rem;
      font-family: ui-monospace, SFMono-Regular, monospace;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .reconnect-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #38bdf8;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Actions */
    .btn-retry {
      width: 100%;
      padding: 0.85rem 1.25rem;
      background: #00f0ff;
      color: #090b10;
      border: none;
      border-radius: 10px;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(0, 240, 255, 0.3);
    }

    .btn-retry:hover {
      background: #5df6ff;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 240, 255, 0.45);
    }

    .footer-note {
      margin-top: 1.5rem;
      font-size: 0.72rem;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="scanlines"></div>

  <div class="card">
    <div class="telemetry">
      <div class="badge-offline">
        <span class="pulse-dot"></span>
        <span>STATUS: POWER_GRID_OFFLINE</span>
      </div>
      <span>SYS_CODE: 503</span>
    </div>

    <div class="art-scene">
      <span class="z-particle z-1">z</span>
      <span class="z-particle z-2">Z</span>
      <span class="z-particle z-3">z</span>

      <!-- Sleeping Astronaut Vector -->
      <svg class="pixel-sleeper" width="96" height="54" viewBox="0 0 48 27" fill="none">
        <!-- Pillow / Futon -->
        <rect x="2" y="20" width="44" height="6" rx="2" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <rect x="4" y="16" width="12" height="6" rx="2" fill="#334155"/>
        <!-- Body sleeping horizontal -->
        <rect x="12" y="12" width="28" height="10" rx="3" fill="#cbd5e1"/>
        <rect x="16" y="14" width="14" height="6" rx="1" fill="#475569"/>
        <!-- Helmet Resting on Pillow -->
        <rect x="6" y="9" width="12" height="11" rx="4" fill="#e2e8f0"/>
        <rect x="7" y="12" width="7" height="5" rx="1.5" fill="#00f0ff"/>
        <!-- Closed Eyes reflection -->
        <line x1="8" y1="14" x2="12" y2="14" stroke="#090b10" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </div>

    <h1>Power Station Recharging</h1>
    <p>
      The SPOT homelab server is temporarily offline for routine maintenance or a reboot.
      <strong>All 10,000 grid plots and citizen data are safely preserved in PostgreSQL.</strong>
    </p>

    <div class="reconnect-box">
      <div class="reconnect-text">
        <div class="spinner"></div>
        <span id="status-msg">Auto-reconnecting...</span>
      </div>
      <span id="countdown" style="color: #94a3b8;">4s</span>
    </div>

    <button type="button" class="btn-retry" id="btn-manual-retry" onclick="checkNow()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>Retry Connection Now</span>
    </button>

    <div class="footer-note">
      AUTORETRY ACTIVE • HOST: HOMELAB CLUSTER • SPOT CORE
    </div>
  </div>

  <script>
    let secondsLeft = 4;
    const countdownEl = document.getElementById('countdown');
    const statusMsg = document.getElementById('status-msg');

    async function checkNow() {
      statusMsg.textContent = 'Pinging homelab server...';
      try {
        const res = await fetch('/health?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          statusMsg.textContent = 'Server online! Returning to SPOT...';
          countdownEl.textContent = '✓';
          setTimeout(() => { window.location.reload(); }, 600);
          return;
        }
      } catch (_) {}
      statusMsg.textContent = 'Still recharging...';
      secondsLeft = 4;
    }

    setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        checkNow();
      } else {
        countdownEl.textContent = secondsLeft + 's';
      }
    }, 1000);
  </script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    try {
      // Forward original request to homelab VPS origin
      const response = await fetch(request);

      // 1. Intercept Cloudflare origin down codes (502, 503, 504, 521, 522, 523, 524)
      if ([502, 503, 504, 521, 522, 523, 524].includes(response.status)) {
        return handleOffline(request, response.status);
      }

      // 2. Intercept Traefik reverse proxy fallback when container is stopped
      if (response.status === 404 && response.headers.get('content-type')?.includes('text/plain')) {
        const text = await response.clone().text();
        if (text.trim() === '404 page not found') {
          return handleOffline(request, 503);
        }
      }

      return response;
    } catch (err) {
      // Direct network failure reaching origin VPS
      return handleOffline(request, 503);
    }
  },
};

function handleOffline(request, status) {
  const url = new URL(request.url);

  // Return clean JSON for API endpoints
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    return new Response(
      JSON.stringify({
        error: 'ServerOffline',
        message: 'The SPOT homelab server is temporarily offline for maintenance or a reboot.',
        status,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Retry-After': '5',
        },
      }
    );
  }

  // Return retro 8-bit HTML error page for browser requests
  return new Response(SERVER_DOWN_HTML, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Retry-After': '5',
    },
  });
}
