/**
 * Exporta o spec OpenAPI para `docs/openapi.json` sem subir um servidor HTTP.
 * Útil para versionar o spec gerado automaticamente do Swagger no repositório.
 *
 * Uso: `npm run docs:export`
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

loadEnv();

async function main(): Promise<void> {
  // Defaults seguros pra rodar offline (sem Postgres/Redis exigidos pelo schema de env).
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://orchestrator:orchestrator@localhost:5432/orchestrator';
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';

  const { AppModule } = await import('../src/app.module');

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Order Orchestrator')
    .setDescription(
      'Webhook-driven order orchestrator with idempotency, async enrichment and DLQ.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'openapi.json');
  writeFileSync(outFile, JSON.stringify(document, null, 2));

  console.log(`✓ OpenAPI spec exportado para ${outFile}`);
  await app.close();
}

main().catch((err) => {
  console.error('Falha ao exportar OpenAPI:', err);
  process.exit(1);
});
