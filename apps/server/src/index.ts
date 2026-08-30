import { app } from './app.js';
import { config } from './config.js';
import { checkDbConnection } from './db.js';

async function start() {
  console.log('--- Starting Spot Authoritative Backend ---');
  const dbConnected = await checkDbConnection();
  if (!dbConnected) {
    console.warn('[Warning] PostgreSQL is not reachable. Ensure DATABASE_URL is valid or Docker is running.');
  }

  app.listen(config.port, () => {
    console.log(`🚀 Spot API server listening on http://localhost:${config.port}`);
    console.log(`📦 Environment: ${config.nodeEnv}`);
  });
}

start();
