import { config, hasBluesky, hasTwitter, hasInstagram } from './config.js';
import { buildDailyPost, buildManualPost, buildInstagramCaption, recapImageUrl } from './content.js';
import {
  ensureMarketingTables,
  getLastCursor,
  getRecentClaims,
  getTotals,
  recordPost,
  setLastCursor,
} from './db.js';
import { postToBluesky, verifyBluesky } from './bluesky.js';
import { postToTwitter } from './twitter.js';
import { postToInstagram, refreshInstagramToken, verifyInstagram } from './instagram.js';

interface Args {
  command: string;
  dryRun: boolean;
  text?: string;
  image?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: 'post', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run' || a === '-n') args.dryRun = true;
    else if (a === '--text') args.text = argv[++i];
    else if (a === '--image') args.image = argv[++i];
    else if (!a.startsWith('-')) args.command = a;
  }
  return args;
}

function log(...parts: unknown[]): void {
  console.log('[marketing]', ...parts);
}

async function publish(args: Args): Promise<void> {
  const channels: string[] = [];
  if (hasBluesky) channels.push('bluesky');
  if (hasTwitter) channels.push('twitter');
  if (hasInstagram) channels.push('instagram');
  if (channels.length === 0) {
    log('No channels configured. Set BSKY_HANDLE + BSKY_APP_PASSWORD (free) and/or X_* / IG_* keys.');
    return;
  }

  let text: string;
  let newestClaim: string | null = null;
  let igImageUrl: string | null = null;
  let igCaption: string | null = null;

  if (args.text) {
    text = buildManualPost(args.text).text;
    igImageUrl = `${config.appUrl}/api/og`;
    igCaption = `${args.text}\n\n👉 ${config.appUrl}\n\n#claimyourspot #indiedev #pixelart #buildinpublic`;
  } else {
    await ensureMarketingTables();
    const cursor = await getLastCursor();
    const [claims, totals] = await Promise.all([getRecentClaims(cursor), getTotals()]);
    newestClaim = claims[0]?.claimedAt ?? null;

    if (claims.length === 0 && !config.alwaysPost) {
      log('No new claims since', cursor, '— nothing to post.');
      return;
    }
    const content = buildDailyPost(claims, totals, config.appUrl);
    text = content.text;
    igImageUrl = recapImageUrl(claims, config.appUrl);
    igCaption = buildInstagramCaption(claims, totals, config.appUrl);
    log(`Recap: ${claims.length} new claim(s), ${totals.claimed} total.`);
  }

  if (args.dryRun) {
    log('DRY RUN — would post to', channels.join(', '));
    log('-----');
    log(text);
    log('-----');
    return;
  }

  const posted: string[] = [];

  if (hasBluesky) {
    try {
      const uri = await postToBluesky(text, args.image);
      posted.push('bluesky');
      log('Posted to Bluesky:', uri);
      if (!args.text) await recordPost('bluesky', text, uri).catch(() => {});
    } catch (err) {
      log('Bluesky post failed:', (err as Error).message);
    }
  }

  if (hasTwitter) {
    try {
      const id = await postToTwitter(text);
      posted.push('twitter');
      log('Posted to Twitter/X:', id);
      if (!args.text) await recordPost('twitter', text, id).catch(() => {});
    } catch (err) {
      log('Twitter/X post failed:', (err as Error).message);
    }
  }

  if (hasInstagram && igImageUrl && igCaption) {
    try {
      const id = await postToInstagram(igImageUrl, igCaption);
      posted.push('instagram');
      log('Posted to Instagram:', id);
      if (!args.text) await recordPost('instagram', igCaption, id).catch(() => {});
    } catch (err) {
      log('Instagram post failed:', (err as Error).message);
    }
  }

  if (!args.text && posted.length > 0) {
    await setLastCursor(newestClaim ?? new Date().toISOString());
  }
}

async function serve(): Promise<void> {
  const minutes = Math.max(5, config.intervalMinutes);
  log(`Scheduler running every ${minutes} minute(s). Channels:`,
    [hasBluesky && 'bluesky', hasTwitter && 'twitter', hasInstagram && 'instagram'].filter(Boolean).join(', ') || 'none');

  const run = async () => {
    try {
      await publish({ command: 'post', dryRun: false });
    } catch (err) {
      log('Scheduled run failed:', (err as Error).message);
    }
  };

  await run();
  setInterval(run, minutes * 60 * 1000);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'whoami') {
    if (hasBluesky) log('Bluesky:', await verifyBluesky());
    else log('Bluesky: not configured');
    log('Twitter/X:', hasTwitter ? 'configured' : 'not configured (paid API required)');
    if (hasInstagram) log('Instagram:', await verifyInstagram());
    else log('Instagram: not configured (needs Business/Creator + Meta app token)');
    return;
  }

  if (args.command === 'instagram-refresh') {
    log(await refreshInstagramToken());
    return;
  }

  if (args.command === 'serve') {
    await serve();
    return;
  }

  await publish(args);
}

main().catch((err) => {
  console.error('[marketing] fatal:', err);
  process.exit(1);
});
