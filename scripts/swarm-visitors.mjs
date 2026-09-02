#!/usr/bin/env node
// ==============================================================================
// SPOT — Real-time Multiplayer Swarm Load Tester (100–200 Concurrent Visitors)
// ==============================================================================

import { setTimeout as sleep } from 'node:timers/promises';

const TARGET_URL = process.env.TARGET_URL || 'https://www.claimyourspot.lol';
const VISITOR_COUNT = parseInt(process.env.COUNT || process.argv[2] || '150', 10);
const DURATION_SEC = parseInt(process.env.DURATION || process.argv[3] || '120', 10);
const RAMP_UP_SEC = 10;

const AVATARS = [
  'astronaut', 'hacker', 'pixel_wizard', 'bot_9000', 'retro_cat',
  'ghosty', 'pixel_knight', 'neon_ninja', 'pixel_alien', 'golden_knight',
  'cyber_samurai', 'pixel_dino'
];

const EMOTES = [
  '👋', '☕', '✨', '❤️', '🚀', '🎮',
  '🌸 Hey neighbors!', '✨ Loving this island!',
  '☕ Coffee break!', '🚀 Strolling around the plaza!',
  '🎮 Nice spot you have here!', '🌟 Hello Spot World!'
];

console.log('========================================================');
console.log(`🚀 SPOT Monorepo — Swarm Load Generator`);
console.log(`🎯 Target:       ${TARGET_URL}`);
console.log(`👥 Visitors:     ${VISITOR_COUNT} concurrent dummy guests`);
console.log(`⏱️ Duration:     ${DURATION_SEC} seconds (Ramp-up: ${RAMP_UP_SEC}s)`);
console.log(`🚫 DB Impact:    0 writes (pure in-memory SSE + broadcast relay)`);
console.log('========================================================\n');

let isRunning = true;
const stats = {
  connected: 0,
  positionsSent: 0,
  positionsFailed: 0,
  sseEventsReceived: 0,
  totalLatencyMs: 0,
  latencyCount: 0,
};

class SimulatedVisitor {
  constructor(id) {
    this.id = id;
    this.tabId = `swarm_tab_${id}_${Math.random().toString(36).slice(2, 7)}`;
    this.citizenId = `guest_swarm_${id}`;
    this.displayName = `Explorer #${id}`;
    this.avatarId = AVATARS[id % AVATARS.length];
    
    // Spawn in downtown area
    this.wx = 2300 + (Math.random() * 400 - 200);
    this.wy = 1800 + (Math.random() * 400 - 200);
    this.direction = ['down', 'up', 'left', 'right'][Math.floor(Math.random() * 4)];
    this.state = 'walk';
    this.abortController = new AbortController();
  }

  async connectSSE() {
    try {
      const sseUrl = `${TARGET_URL}/api/realtime/stream?tabId=${this.tabId}`;
      const res = await fetch(sseUrl, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController.signal,
      });

      if (!res.ok || !res.body) {
        return;
      }

      stats.connected++;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (isRunning) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            const eventCount = (text.match(/data:/g) || []).length;
            stats.sseEventsReceived += eventCount;
          }
        } catch {
          // stream ended or aborted
        } finally {
          stats.connected = Math.max(0, stats.connected - 1);
        }
      })();
    } catch {
      // connection failed or aborted
    }
  }

  async startWandering() {
    while (isRunning) {
      // Wander step: update coordinates
      const step = 6 + Math.random() * 8;
      const moveRoll = Math.random();

      if (moveRoll < 0.25) {
        this.direction = 'left';
        this.wx = Math.max(100, this.wx - step);
      } else if (moveRoll < 0.5) {
        this.direction = 'right';
        this.wx = Math.min(4700, this.wx + step);
      } else if (moveRoll < 0.75) {
        this.direction = 'up';
        this.wy = Math.max(100, this.wy - step);
      } else {
        this.direction = 'down';
        this.wy = Math.min(3100, this.wy + step);
      }

      this.state = Math.random() < 0.1 ? 'idle' : 'walk';

      // 3% chance to say an emote/speech bubble
      const speech = Math.random() < 0.03 ? EMOTES[Math.floor(Math.random() * EMOTES.length)] : null;

      const payload = {
        citizenId: this.citizenId,
        senderTabId: this.tabId,
        displayName: this.displayName,
        avatarId: this.avatarId,
        wx: Math.round(this.wx * 10) / 10,
        wy: Math.round(this.wy * 10) / 10,
        direction: this.direction,
        state: this.state,
        speech,
        timestamp: Date.now(),
      };

      const t0 = performance.now();
      try {
        const res = await fetch(`${TARGET_URL}/api/realtime/position`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: this.abortController.signal,
        });

        const lat = performance.now() - t0;
        if (res.ok) {
          stats.positionsSent++;
          stats.totalLatencyMs += lat;
          stats.latencyCount++;
        } else {
          stats.positionsFailed++;
        }
      } catch {
        if (isRunning) stats.positionsFailed++;
      }

      // Interval between movement broadcasts (400ms - 900ms per visitor)
      await sleep(400 + Math.random() * 500);
    }
  }

  stop() {
    try {
      this.abortController.abort();
    } catch {}
  }
}

// ── Spawn Swarm with Staggered Ramp-Up ─────────────────────────────────────────
const visitors = [];
const rampDelayMs = (RAMP_UP_SEC * 1000) / VISITOR_COUNT;

(async () => {
  console.log(`⏳ Ramping up ${VISITOR_COUNT} visitors over ${RAMP_UP_SEC}s...`);

  for (let i = 1; i <= VISITOR_COUNT; i++) {
    if (!isRunning) break;
    const v = new SimulatedVisitor(i);
    visitors.push(v);
    v.connectSSE();
    v.startWandering();
    await sleep(rampDelayMs);
  }

  console.log(`\n🎉 All ${VISITOR_COUNT} visitors are active and roaming Spot World!\n`);
})();

// ── Dashboard Reporter (every 2s) ─────────────────────────────────────────────
let lastPositions = 0;
let lastSseEvents = 0;
let elapsed = 0;

const interval = setInterval(() => {
  elapsed += 2;
  const posDiff = stats.positionsSent - lastPositions;
  const sseDiff = stats.sseEventsReceived - lastSseEvents;
  lastPositions = stats.positionsSent;
  lastSseEvents = stats.sseEventsReceived;

  const posRate = (posDiff / 2).toFixed(1);
  const sseRate = (sseDiff / 2).toFixed(1);
  const avgLat = stats.latencyCount > 0 ? (stats.totalLatencyMs / stats.latencyCount).toFixed(1) : '0';

  process.stdout.write(
    `\r[${String(elapsed).padStart(3, ' ')}s / ${DURATION_SEC}s] ` +
    `🟢 Active SSE: ${String(stats.connected).padStart(3, ' ')} | ` +
    `📤 POST/s: ${String(posRate).padStart(5, ' ')} | ` +
    `📥 Fan-out SSE/s: ${String(sseRate).padStart(6, ' ')} | ` +
    `⚡ Latency: ${avgLat}ms | ` +
    `❌ Errors: ${stats.positionsFailed}   `
  );

  if (elapsed >= DURATION_SEC) {
    shutdown();
  }
}, 2000);

function shutdown() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(interval);
  console.log('\n\n🛑 Stopping swarm and disconnecting visitors...');
  for (const v of visitors) v.stop();

  setTimeout(() => {
    console.log('\n========================================================');
    console.log('📊 Swarm Load Test Summary Report:');
    console.log(`- Peak Concurrent Visitors:   ${VISITOR_COUNT}`);
    console.log(`- Total Position Updates:     ${stats.positionsSent}`);
    console.log(`- Total Fan-out SSE Events:   ${stats.sseEventsReceived}`);
    console.log(`- Total Request Failures:     ${stats.positionsFailed}`);
    const finalAvg = stats.latencyCount > 0 ? (stats.totalLatencyMs / stats.latencyCount).toFixed(1) : '0';
    console.log(`- Average POST Latency:       ${finalAvg} ms`);
    console.log('========================================================\n');
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
