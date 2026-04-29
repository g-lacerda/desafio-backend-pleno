/**
 * Cria 3 usuários demo (1 por idioma) e imprime as API keys geradas no console.
 * Útil para popular o ambiente local logo após `prisma migrate dev`.
 *
 * Uso: `npm run seed:users`
 *
 * Se perder as chaves impressas, faça `POST /auth/login` com email + senha
 * pra rotacionar (a senha demo está fixa em DEMO_PASSWORD abaixo).
 */
import { config as loadEnv } from 'dotenv';
import axios, { AxiosError } from 'axios';

loadEnv();

interface SeedUser {
  email: string;
  name: string;
  password: string;
  preferredLanguage: 'PT_BR' | 'EN' | 'ES';
}

const DEMO_PASSWORD = 'demo-pass-1234';

const USERS: SeedUser[] = [
  {
    email: 'demo-pt@inbazz.com',
    name: 'Demo PT-BR',
    password: DEMO_PASSWORD,
    preferredLanguage: 'PT_BR',
  },
  {
    email: 'demo-en@inbazz.com',
    name: 'Demo EN',
    password: DEMO_PASSWORD,
    preferredLanguage: 'EN',
  },
  {
    email: 'demo-es@inbazz.com',
    name: 'Demo ES',
    password: DEMO_PASSWORD,
    preferredLanguage: 'ES',
  },
];

const baseUrl = process.env.SEED_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const adminKey = process.env.ADMIN_API_KEY;

if (!adminKey) {
  console.error('✗  ADMIN_API_KEY não está definida no ambiente. Verifique o .env.');
  process.exit(1);
}

async function createUser(user: SeedUser): Promise<{ email: string; apiKey: string } | null> {
  try {
    const res = await axios.post(`${baseUrl}/users`, user, {
      headers: { 'X-Admin-Key': adminKey },
    });
    return { email: res.data.email, apiKey: res.data.api_key };
  } catch (error) {
    const err = error as AxiosError<{ message?: string }>;
    if (err.response?.status === 401) {
      console.error(`✗  Admin key inválida — confira ADMIN_API_KEY no .env`);
      return null;
    }
    if (err.response?.status === 409) {
      console.log(
        `⚠  ${user.email} já existe — use POST /auth/login para rotacionar a chave (senha: ${DEMO_PASSWORD})`,
      );
      return null;
    }
    console.error(`✗  Falha ao criar ${user.email}:`, err.response?.data ?? err.message);
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`\n→ Seedando 3 usuários demo em ${baseUrl}\n`);

  const results = await Promise.all(USERS.map(createUser));
  const created = results.filter((r): r is { email: string; apiKey: string } => r !== null);

  if (created.length === 0) {
    console.log('Nenhum usuário criado nesta execução.\n');
    process.exit(0);
  }

  console.log('\n┌──────────────────────┬─────────────────────────────────────────────────────────┐');
  console.log('│ Email                │ API Key (use em Authorization: Bearer <chave>)         │');
  console.log('├──────────────────────┼─────────────────────────────────────────────────────────┤');
  for (const { email, apiKey } of created) {
    console.log(`│ ${email.padEnd(20)} │ ${apiKey.padEnd(55)} │`);
  }
  console.log('└──────────────────────┴─────────────────────────────────────────────────────────┘');
  console.log(
    `\n💡 Guarde estas chaves — só aparecem aqui (banco guarda só o hash SHA-256).\n` +
      `🔑 Senha demo de todos: "${DEMO_PASSWORD}". Use POST /auth/login se perder a chave.\n`,
  );
}

main().catch((err) => {
  console.error('Seed falhou:', err);
  process.exit(1);
});
