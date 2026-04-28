import { execSync } from 'child_process';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

export interface TestcontainersHandles {
  postgres: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
}

let handles: TestcontainersHandles | null = null;

export async function startTestcontainers(): Promise<TestcontainersHandles> {
  if (handles) return handles;

  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('orchestrator_test')
    .withUsername('orchestrator')
    .withPassword('orchestrator')
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();

  const redis = await new RedisContainer('redis:7-alpine').start();

  const databaseUrl = postgres.getConnectionUri();
  const redisHost = redis.getHost();
  const redisPort = redis.getMappedPort(6379);

  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_HOST = redisHost;
  process.env.REDIS_PORT = String(redisPort);

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  handles = { postgres, redis, databaseUrl, redisHost, redisPort };
  return handles;
}

export async function stopTestcontainers(): Promise<void> {
  if (!handles) return;
  await Promise.all([handles.postgres.stop(), handles.redis.stop()]);
  handles = null;
}

export function getHandles(): TestcontainersHandles {
  if (!handles) {
    throw new Error('Testcontainers not started. Call startTestcontainers first.');
  }
  return handles;
}

// Avoid unused-import warnings for re-exports below
export type { GenericContainer, StartedTestContainer };
