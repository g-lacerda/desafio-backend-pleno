/**
 * Dispara webhooks contra a API local pra demonstrar todos os cenários:
 *
 *   --scenario=valid       (default) 1 pedido válido
 *   --scenario=duplicate   2 envios com mesma idempotency_key (replay)
 *   --scenario=hash        2 envios mesma key + payloads diferentes (422)
 *   --scenario=invalid     payload inválido (400)
 *   --scenario=load        N pedidos paralelos (use --count=N)
 *   --scenario=dlq         pedido com moeda inválida (vai pra DLQ)
 *   --scenario=all         executa todos os cenários acima
 *
 * Uso: `npm run seed:webhook -- --scenario=load --count=50`
 */
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'crypto';
import axios, { AxiosError } from 'axios';

loadEnv();

const baseUrl = process.env.SEED_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const webhookSecret = process.env.WEBHOOK_SECRET;

if (!webhookSecret) {
  console.error('✗  WEBHOOK_SECRET não está definida no ambiente. Verifique o .env.');
  process.exit(1);
}

const args = parseArgs();

interface OrderPayload {
  order_id: string;
  customer: { email: string; name: string };
  items: Array<{ sku: string; qty: number; unit_price: number }>;
  currency: string;
  idempotency_key: string;
}

const buildPayload = (overrides: Partial<OrderPayload> = {}): OrderPayload => ({
  order_id: overrides.order_id ?? `ext-${randomUUID().slice(0, 8)}`,
  customer: overrides.customer ?? { email: 'demo@inbazz.com', name: 'Demo Customer' },
  items: overrides.items ?? [{ sku: 'ABC123', qty: 2, unit_price: 59.9 }],
  currency: overrides.currency ?? 'USD',
  idempotency_key: overrides.idempotency_key ?? randomUUID(),
});

async function send(payload: OrderPayload, label: string): Promise<void> {
  try {
    const res = await axios.post(`${baseUrl}/webhooks/orders`, payload, {
      headers: { 'X-Webhook-Secret': webhookSecret },
    });
    console.log(`✓ [${label}] ${res.status} — order_id=${res.data.id}`);
  } catch (error) {
    const err = error as AxiosError<{ message?: string | string[] }>;
    const status = err.response?.status;
    const message = err.response?.data?.message;
    console.log(`✗ [${label}] ${status} — ${JSON.stringify(message)}`);
  }
}

async function scenarioValid(): Promise<void> {
  console.log('\n→ Cenário: pedido válido');
  await send(buildPayload(), 'valid');
}

async function scenarioDuplicate(): Promise<void> {
  console.log('\n→ Cenário: replay (mesma chave + mesmo payload duas vezes)');
  const payload = buildPayload();
  await send(payload, 'duplicate-1');
  await send(payload, 'duplicate-2');
}

async function scenarioHashDivergent(): Promise<void> {
  console.log('\n→ Cenário: hash divergente (mesma chave + payloads diferentes)');
  const key = randomUUID();
  await send(buildPayload({ idempotency_key: key }), 'hash-1');
  await send(
    buildPayload({
      idempotency_key: key,
      customer: { email: 'outro@inbazz.com', name: 'Outro' },
    }),
    'hash-2',
  );
}

async function scenarioInvalid(): Promise<void> {
  console.log('\n→ Cenário: payload inválido (email malformado)');
  const payload = buildPayload();
  payload.customer.email = 'not-an-email';
  await send(payload, 'invalid');
}

async function scenarioLoad(count: number): Promise<void> {
  console.log(`\n→ Cenário: carga com ${count} pedidos paralelos`);
  await Promise.all(
    Array.from({ length: count }, (_, i) => send(buildPayload(), `load-${i + 1}`)),
  );
}

async function scenarioDlq(): Promise<void> {
  console.log('\n→ Cenário: moeda válida ISO mas não suportada (AFN-BRL → 4xx → DLQ)');
  await send(buildPayload({ currency: 'AFN' }), 'dlq');
}

async function main(): Promise<void> {
  console.log(`Disparando contra ${baseUrl}`);
  const scenario = args.scenario ?? 'valid';
  const count = Number(args.count ?? 10);

  switch (scenario) {
    case 'valid':
      await scenarioValid();
      break;
    case 'duplicate':
      await scenarioDuplicate();
      break;
    case 'hash':
      await scenarioHashDivergent();
      break;
    case 'invalid':
      await scenarioInvalid();
      break;
    case 'load':
      await scenarioLoad(count);
      break;
    case 'dlq':
      await scenarioDlq();
      break;
    case 'all':
      await scenarioValid();
      await scenarioDuplicate();
      await scenarioHashDivergent();
      await scenarioInvalid();
      await scenarioDlq();
      break;
    default:
      console.error(`Cenário desconhecido: ${scenario}`);
      process.exit(1);
  }

  console.log('\nFinalizado.\n');
}

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      out[key] = value ?? 'true';
    }
  }
  return out;
}

main().catch((err) => {
  console.error('Seed falhou:', err);
  process.exit(1);
});
