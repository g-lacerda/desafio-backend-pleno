import * as fs from 'fs';
import * as path from 'path';

export function loadTestcontainersEnv(): void {
  const file = path.join(__dirname, '..', '.testcontainers.json');
  if (!fs.existsSync(file)) {
    throw new Error('Testcontainers manifest not found. Did global-setup run?');
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    databaseUrl: string;
    redisHost: string;
    redisPort: number;
  };

  process.env.DATABASE_URL = data.databaseUrl;
  process.env.REDIS_HOST = data.redisHost;
  process.env.REDIS_PORT = String(data.redisPort);
}
