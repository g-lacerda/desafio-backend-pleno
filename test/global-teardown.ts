import { stopTestcontainers } from './helpers/testcontainers-bootstrap';

export default async function globalTeardown(): Promise<void> {
  await stopTestcontainers();

  const fs = await import('fs');
  const path = await import('path');
  const file = path.join(__dirname, '.testcontainers.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
