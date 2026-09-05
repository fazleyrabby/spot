import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.claimyourspot.lol',
  integrations: [sitemap()],
  server: {
    port: 4321,
    host: true
  }
});
