// Vercel serverless entry — serves the Express API on the same domain as the
// static site. Every request under /api/* lands here and runs the authoritative
// server (claim, edit, delete, github sync, profanity policy).
import { app } from '../../server/src/app.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel serves this catch-all for /api/* — make sure Express sees the /api prefix
  if (!req.url || !req.url.startsWith('/api')) {
    req.url = `/api${req.url || ''}`;
  }
  // Wait for body to be fully available before handing to Express
  return app(req as any, res as any);
}
