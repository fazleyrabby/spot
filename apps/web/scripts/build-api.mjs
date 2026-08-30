#!/usr/bin/env node
// Bundle the Express server into a single ESM file for Vercel serverless functions.
// Workspace packages (@spot/shared, @spot/world) are inlined; npm packages stay external.
import { build } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, '../../server/src/app.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: resolve(__dirname, '../api/_server-bundle.mjs'),
  // Only externalize npm packages — workspace packages get inlined
  external: [
    'express', 'cors', 'cookie-parser', 'dotenv', 'pg', 'zod',
  ],
  sourcemap: false,
  minify: false,
  target: 'node20',
});

console.log('✓ Server bundle built → api/_server-bundle.mjs');
