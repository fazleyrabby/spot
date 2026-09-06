import express from 'express';
import { sendErrorAlert } from '../../discord.js';

export const logsRouter: express.Router = express.Router();

/**
 * POST /api/logs/client-error
 * Ingests uncaught client-side JavaScript crashes and unhandled promise rejections.
 * 1. Emits structured log to stdout/stderr (ingested by Promtail -> Grafana Loki)
 * 2. Relays non-noisy errors to Discord error channel
 */
logsRouter.post('/client-error', (req, res) => {
  try {
    const { message, stack, source, lineno, colno, url, userAgent } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, message: 'Invalid error payload' });
    }

    const msgLower = message.toLowerCase();
    const isNoisy =
      msgLower.includes('resizeobserver') ||
      msgLower.includes('chrome-extension://') ||
      msgLower.includes('moz-extension://') ||
      msgLower.includes('metamask') ||
      msgLower.includes('adblock') ||
      msgLower.includes('network request failed');

    const rawIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.ip ||
      'unknown';

    // Structured output for Promtail / Loki ingestion
    console.error(`[Client Error] ${message.slice(0, 300)} (URL: ${url || req.headers.referer || '/'})`, {
      type: 'client_error',
      message: message.slice(0, 1000),
      source: source || 'browser',
      lineno,
      colno,
      url: url || req.headers.referer,
      userAgent: userAgent || (req.headers['user-agent'] as string),
      ip: rawIp,
      timestamp: new Date().toISOString(),
      stack: stack ? stack.slice(0, 1500) : undefined,
    });

    // Alert Discord if serious / not an extension noise
    if (!isNoisy) {
      sendErrorAlert({
        title: 'Browser Client Error',
        message: message.slice(0, 1000),
        source: 'Frontend (User Browser)',
        stack,
        url: url || (req.headers.referer as string),
        userAgent: userAgent || (req.headers['user-agent'] as string),
        ip: rawIp,
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Client Error Log Ingest Failed]', err);
    res.status(500).json({ ok: false });
  }
});
