import { startTestcontainers } from './helpers/testcontainers-bootstrap';

export default async function globalSetup(): Promise<void> {
  const handles = await startTestcontainers();
  process.env.DATABASE_URL = handles.databaseUrl;
  process.env.REDIS_HOST = handles.redisHost;
  process.env.REDIS_PORT = String(handles.redisPort);

  // Persistir os endpoints num arquivo pra os testes lerem (Jest globalSetup roda em outro process)
  const fs = await import('fs');
  const path = await import('path');
  fs.writeFileSync(
    path.join(__dirname, '.testcontainers.json'),
    JSON.stringify({
      databaseUrl: handles.databaseUrl,
      redisHost: handles.redisHost,
      redisPort: handles.redisPort,
    }),
  );
}
