/**
 * SPOT API Router Orchestrator
 *
 * Modular sub-routers organized by domain:
 * - /api/auth       -> WebAuthn passkeys, GitHub OAuth sync
 * - /api/realtime   -> Server-Sent Events (SSE) live updates & presence
 * - /api/analytics  -> 24h unique visitor count & Discord alerts
 * - /api/world      -> Cached world snapshot & occupied plots
 * - /api/citizens   -> Profiles, citizen search, updates, right-to-erasure
 * - /api/spots      -> Plot claiming, collisions, spot wall guestbook
 * - /api/billboards -> Gumroad webhook, active campaigns, SSRF OpenGraph
 * - /api/           -> OG SVG social cards, share landing, general stats
 */
import express from 'express';
import { authRouter } from './modules/auth/routes.js';
import { realtimeRouter, broadcastRealtimeEvent, getUniqueOnlineCount } from './modules/realtime/routes.js';
import { analyticsRouter } from './modules/analytics/routes.js';
import { worldRouter, invalidateWorldCache } from './modules/world/routes.js';
import { citizensRouter } from './modules/citizens/routes.js';
import { spotsRouter } from './modules/spots/routes.js';
import { billboardsRouter } from './modules/billboards/routes.js';
import { metaRouter } from './modules/meta/routes.js';

export const apiRouter: express.Router = express.Router();

// Mount modular sub-routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/realtime', realtimeRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/world', worldRouter);
apiRouter.use('/citizens', citizensRouter);
apiRouter.use('/spots', spotsRouter);
apiRouter.use('/billboards', billboardsRouter);
apiRouter.use('/', metaRouter);

// Backwards compatibility re-exports
export { broadcastRealtimeEvent, getUniqueOnlineCount, invalidateWorldCache };
