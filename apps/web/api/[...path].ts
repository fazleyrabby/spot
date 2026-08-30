// Vercel serverless entry — serves the Express API on the same domain as the
// static site. Every request under /api/* lands here and runs the authoritative
// server (claim, edit, delete, github sync, profanity policy).
import { app } from '../../server/src/app';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || !req.url.startsWith('/api')) {
    req.url = `/api${req.url || ''}`;
  }
  return app(req as any, res as any);
}
