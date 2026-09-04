import express from 'express';
import { SlidingWindowRateLimiter } from '../../rateLimiter.js';
import { sendLibrarySuggestionNotification } from '../../discord.js';

export const libraryRouter: express.Router = express.Router();

// Rate limiter: Max 5 suggestions per IP per 10 minutes
const suggestionLimiter = new SlidingWindowRateLimiter(
  5,
  10 * 60 * 1000,
  'Too many library suggestions submitted. Please wait before submitting more.'
).middleware();

/**
 * POST /api/library/suggest
 * Submit a community dev tool or resource recommendation
 */
libraryRouter.post('/suggest', suggestionLimiter, async (req, res) => {
  const { title, url, category, description, submitterName, submitterCitizenId } = req.body;

  if (!title || typeof title !== 'string' || !url || typeof url !== 'string') {
    res.status(400).json({ error: 'MissingFields', message: 'Title and URL are required.' });
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'InvalidUrl', message: 'Please provide a valid web URL.' });
    return;
  }

  try {
    await sendLibrarySuggestionNotification({
      title: title.slice(0, 100),
      url: url.slice(0, 500),
      category: typeof category === 'string' ? category.slice(0, 50) : 'General',
      description: typeof description === 'string' ? description.slice(0, 300) : 'No description provided.',
      submitterName: typeof submitterName === 'string' ? submitterName.slice(0, 50) : null,
      submitterCitizenId: typeof submitterCitizenId === 'string' ? submitterCitizenId.slice(0, 50) : null,
    });

    res.json({ success: true, message: 'Suggestion received! Thank you for curating The Grand Codex.' });
  } catch (err) {
    console.error('Failed to process library suggestion:', err);
    res.status(500).json({ error: 'InternalError', message: 'Could not process your suggestion.' });
  }
});
