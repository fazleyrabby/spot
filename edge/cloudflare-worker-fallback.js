/**
 * ==============================================================================
 * Cloudflare Edge Failover Worker for SPOT (Homelab Power Outage Protection)
 * ==============================================================================
 *
 * How it works:
 * 1. Proxies incoming requests directly to your Homelab VPS origin.
 * 2. If the Homelab VPS is offline (power outage, ISP drop, 521/522/523 errors),
 *    this worker intercepts the failure and instantly returns a lightweight,
 *    pixel-art styled 503 Maintenance page with an automated 15-second retry loop.
 *
 * Deploy to Cloudflare:
 * - Go to Cloudflare Dashboard -> Workers & Pages -> Create Worker
 * - Paste this script and add a Route (e.g., spot.fazleyrabbi.xyz/*)
 */

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPOT — Homelab Sleeping (Power Outage)</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.88);
      --border: #232d42;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #ff4757;
      --accent-glow: rgba(255, 71, 87, 0.35);
      --cyan: #00d2d3;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace;
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 30%, rgba(255, 71, 87, 0.08) 0%, transparent 60%),
        linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 100% 100%, 32px 32px, 32px 32px;
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 40px var(--accent-glow);
      backdrop-filter: blur(12px);
    }
    .icon-container {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
      border-radius: 50%;
      background: rgba(255, 71, 87, 0.12);
      border: 1px solid var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 var(--accent-glow); }
      50% { transform: scale(1.05); box-shadow: 0 0 20px 6px var(--accent-glow); }
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 71, 87, 0.15);
      color: var(--accent);
      border: 1px solid rgba(255, 71, 87, 0.3);
      margin-bottom: 1rem;
    }
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .retry-box {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--cyan);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container">⚡</div>
    <div class="badge">Homelab Power Outage</div>
    <h1>Spot is Taking a Power Nap</h1>
    <p>
      The self-hosted server running this world is temporarily offline due to a local power interruption. 
      The system will automatically restore as soon as electricity returns.
    </p>
    <div class="retry-box">
      <span>Auto-checking in <strong id="timer">15</strong>s...</span>
      <div class="spinner"></div>
    </div>
  </div>

  <script>
    let seconds = 15;
    const timerEl = document.getElementById('timer');
    setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        window.location.reload();
      } else {
        timerEl.textContent = seconds;
      }
    }, 1000);
  </script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    try {
      const response = await fetch(request, {
        cf: { connectTimeout: 4000 },
      });

      // Cloudflare origin errors: 521 (Web server is down), 522 (Connection timed out), 523 (Origin unreachable)
      if ([521, 522, 523, 502, 503, 504].includes(response.status)) {
        return new Response(OFFLINE_HTML, {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }

      return response;
    } catch (err) {
      // Direct network failure / timeout
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }
  },
};
