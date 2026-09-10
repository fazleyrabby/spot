import { config, hasTwitter } from './config.js';

/**
 * Twitter/X posting requires a PAID X developer plan (free tier is read-only).
 * This adapter stays dormant until X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN /
 * X_ACCESS_SECRET are provided, then uses OAuth 1.0a user context via
 * twitter-api-v2.
 */
export async function postToTwitter(text: string): Promise<string> {
  if (!hasTwitter) throw new Error('Twitter/X credentials are not configured');

  const { TwitterApi } = await import('twitter-api-v2');
  const client = new TwitterApi({
    appKey: config.xApiKey,
    appSecret: config.xApiSecret,
    accessToken: config.xAccessToken,
    accessSecret: config.xAccessSecret,
  });

  const res = await client.v2.tweet(text);
  return res.data.id;
}
