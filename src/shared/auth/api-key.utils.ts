import { createHash, randomBytes } from 'crypto';

const API_KEY_PREFIX = 'sk_live_';
const RAW_BYTES = 32;

export interface GeneratedApiKey {
  /** Valor em texto puro. **Só é exposto uma vez** na criação do usuário. */
  plain: string;
  /** Hash SHA-256 (hex). Persistido no banco com índice único para lookup O(1). */
  hash: string;
}

/**
 * Gera uma nova API key. Formato: `sk_live_<base64url>` com 256 bits de entropia.
 * SHA-256 é suficiente porque a chave já tem entropia alta — bcrypt seria desnecessário.
 */
export const generateApiKey = (): GeneratedApiKey => {
  const random = randomBytes(RAW_BYTES).toString('base64url');
  const plain = `${API_KEY_PREFIX}${random}`;
  return { plain, hash: hashApiKey(plain) };
};

export const hashApiKey = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
