import { BskyAgent } from '@atproto/api';
import { readFile } from 'node:fs/promises';
import { config, hasBluesky } from './config.js';

let agent: BskyAgent | null = null;

async function getAgent(): Promise<BskyAgent> {
  if (!hasBluesky) throw new Error('Bluesky credentials are not configured');
  if (agent) return agent;

  const a = new BskyAgent({ service: config.bskyServiceUrl });
  await a.login({ identifier: config.bskyHandle, password: config.bskyAppPassword });
  agent = a;
  return a;
}

export async function verifyBluesky(): Promise<string> {
  const a = await getAgent();
  const res = await a.getProfile({ actor: config.bskyHandle });
  return `${res.data.handle} (${res.data.displayName ?? 'no display name'})`;
}

export async function postToBluesky(
  text: string,
  imagePath?: string,
): Promise<string> {
  const a = await getAgent();

  let embed: Parameters<typeof a.post>[0]['embed'] | undefined;

  if (imagePath) {
    const bytes = await readFile(imagePath);
    const encoding = imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png';
    const upload = await a.uploadBlob(bytes, { encoding });
    embed = {
      $type: 'app.bsky.embed.images',
      images: [{ image: upload.data.blob, alt: 'Spot Metropolis' }],
    };
  }

  const res = await a.post({ text, embed });
  return res.uri;
}
