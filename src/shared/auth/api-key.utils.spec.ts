import { generateApiKey, hashApiKey } from './api-key.utils';

describe('api-key.utils', () => {
  describe('generateApiKey', () => {
    it('produz chave no formato sk_live_<base64url>', () => {
      const { plain, hash } = generateApiKey();
      expect(plain).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      // base64url(32 bytes) = 43 chars
      expect(plain.length).toBeGreaterThanOrEqual('sk_live_'.length + 40);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('gera valores diferentes a cada chamada', () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.plain).not.toBe(b.plain);
      expect(a.hash).not.toBe(b.hash);
    });

    it('hash da chave gerada bate com hashApiKey aplicado ao plain', () => {
      const { plain, hash } = generateApiKey();
      expect(hashApiKey(plain)).toBe(hash);
    });
  });

  describe('hashApiKey', () => {
    it('é determinístico para o mesmo input', () => {
      expect(hashApiKey('foo')).toBe(hashApiKey('foo'));
    });

    it('produz hashes diferentes para inputs diferentes', () => {
      expect(hashApiKey('foo')).not.toBe(hashApiKey('bar'));
    });

    it('produz string hex de 64 caracteres (SHA-256)', () => {
      expect(hashApiKey('whatever')).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
