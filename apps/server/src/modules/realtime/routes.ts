import express, { Response } from 'express';
import { optionalAuthMiddleware, AuthenticatedRequest, resolveCitizen } from '../../auth.js';

export const realtimeRouter: express.Router = express.Router();

export interface SseConnection {
  res: Response;
  clientId: string;
  citizenId?: string;
}

export const sseConnections = new Set<SseConnection>();

export function getUniqueOnlineCount(): number {
  const uniqueIds = new Set<string>();
  for (const conn of sseConnections) {
    uniqueIds.add(conn.clientId);
  }
  return uniqueIds.size;
}

export function getOnlineCitizenIds(): string[] {
  return [...new Set([...sseConnections].map((conn) => conn.citizenId).filter(Boolean) as string[])];
}

export function broadcastRealtimeEvent(event: { type: string; [key: string]: any }) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const conn of sseConnections) {
    try {
      conn.res.write(data);
    } catch {
      sseConnections.delete(conn);
    }
  }
}

const enableSSE = process.env.ENABLE_SSE !== 'false';

const sseHandler = async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Deduplicate by Citizen ID, Session Token, Tab ID, or Client IP
  const tokenParam = typeof req.query.token === 'string' ? req.query.token : undefined;
  const tabParam = typeof req.query.tabId === 'string' ? req.query.tabId : undefined;
  const rawToken = req.rawSessionToken || tokenParam;

  let citizenId = req.citizen?.id;
  if (!citizenId && rawToken) {
    const resolved = await resolveCitizen(rawToken);
    if (resolved) citizenId = resolved.id;
  }

  const clientId = citizenId || (rawToken ? `tok_${rawToken.substring(0, 12)}` : (tabParam ? `tab_${tabParam}` : `ip_${req.ip || 'local'}`));
  const conn: SseConnection = { res, clientId, citizenId };
  sseConnections.add(conn);

  const initialCount = getUniqueOnlineCount();
  res.write(`data: ${JSON.stringify({ type: 'connected', onlineCount: initialCount, onlineCitizenIds: getOnlineCitizenIds() })}\n\n`);
  broadcastRealtimeEvent({ type: 'presence', onlineCount: initialCount, onlineCitizenIds: getOnlineCitizenIds() });

  const cleanup = () => {
    if (sseConnections.has(conn)) {
      sseConnections.delete(conn);
      broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount(), onlineCitizenIds: getOnlineCitizenIds() });
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
};

if (enableSSE) {
  realtimeRouter.get('/stream', optionalAuthMiddleware, sseHandler as any);
}

/**
 * POST /api/realtime/position
 * Broadcast live player position, state, and speech bubble to all connected world viewers.
 */
realtimeRouter.post('/position', optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const { wx, wy, direction, state, speech, displayName, avatarId, guestId } = req.body || {};
  if (typeof wx !== 'number' || typeof wy !== 'number') {
    res.status(400).json({ error: 'InvalidCoordinates' });
    return;
  }

  const citizenId = req.citizen?.id || (typeof guestId === 'string' ? guestId : `guest_${req.ip || 'anon'}`);
  const finalName = req.citizen?.displayName || (typeof displayName === 'string' ? displayName.slice(0, 24) : 'Visitor');
  const finalAvatar = req.citizen?.avatarId || (typeof avatarId === 'string' ? avatarId : 'astronaut');
  const finalDir = ['down', 'up', 'left', 'right'].includes(direction) ? direction : 'down';
  const finalState = typeof state === 'string' ? state : 'idle';
  const finalSpeech = typeof speech === 'string' ? speech.slice(0, 100) : null;

  broadcastRealtimeEvent({
    type: 'player-position',
    citizenId,
    displayName: finalName,
    avatarId: finalAvatar,
    wx,
    wy,
    direction: finalDir,
    state: finalState,
    speech: finalSpeech,
    timestamp: Date.now(),
  });

  res.json({ ok: true });
});

// Periodic heartbeat every 15s to prune stale socket connections
if (enableSSE) {
  setInterval(() => {
    for (const conn of sseConnections) {
      try {
        conn.res.write(': ping\n\n');
      } catch {
        sseConnections.delete(conn);
        broadcastRealtimeEvent({ type: 'presence', onlineCount: getUniqueOnlineCount(), onlineCitizenIds: getOnlineCitizenIds() });
      }
    }
  }, 15000);
}
