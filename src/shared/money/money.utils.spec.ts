import { convertCents, fromCents, toCents, toRateMicros } from './money.utils';

describe('money.utils', () => {
  describe('toCents', () => {
    it('converte valores básicos', () => {
      expect(toCents(0)).toBe(0);
      expect(toCents(1)).toBe(100);
      expect(toCents(59.9)).toBe(5990);
      expect(toCents(59.99)).toBe(5999);
      expect(toCents(1234.56)).toBe(123456);
    });

    it('arredonda corretamente o erro de ponto flutuante de 0.1 + 0.2', () => {
      // Sem Math.round, este caso retornaria 30 em vez do 30 esperado
      // (o problema clássico de IEEE 754 onde 0.1 + 0.2 === 0.30000000000000004).
      expect(toCents(0.1 + 0.2)).toBe(30);
    });

    it('arredonda 59.9 corretamente (caso clássico de FP)', () => {
      // 59.9 * 100 === 5989.999999999999 em IEEE 754. Math.round corrige.
      expect(toCents(59.9)).toBe(5990);
    });

    it('aceita valor zero', () => {
      expect(toCents(0)).toBe(0);
    });

    it('arredonda meio centavo pra cima (banker rounding NÃO usado)', () => {
      expect(toCents(0.005)).toBe(1);
      expect(toCents(0.015)).toBe(2);
    });
  });

  describe('fromCents', () => {
    it('formata centavos com 2 casas decimais', () => {
      expect(fromCents(0)).toBe('0.00');
      expect(fromCents(100)).toBe('1.00');
      expect(fromCents(5990)).toBe('59.90');
      expect(fromCents(5999)).toBe('59.99');
      expect(fromCents(123456)).toBe('1234.56');
    });

    it('mantém zeros à direita', () => {
      expect(fromCents(5900)).toBe('59.00');
      expect(fromCents(10)).toBe('0.10');
    });
  });

  describe('toCents/fromCents round-trip', () => {
    it('preserva valor através da conversão ida-e-volta', () => {
      const cases = [0, 0.01, 0.1, 1, 59.9, 59.99, 100, 1234.56, 999999.99];
      for (const value of cases) {
        expect(fromCents(toCents(value))).toBe(value.toFixed(2));
      }
    });
  });

  describe('toRateMicros', () => {
    it('converte taxa em micros (10⁶)', () => {
      expect(toRateMicros(1)).toBe(1_000_000);
      expect(toRateMicros(5.123456)).toBe(5_123_456);
      expect(toRateMicros(0.5)).toBe(500_000);
    });

    it('arredonda taxas com mais de 6 casas decimais', () => {
      expect(toRateMicros(5.1234567)).toBe(5_123_457);
    });
  });

  describe('convertCents', () => {
    it('aplica taxa correta em valor pequeno', () => {
      // 1 USD a R$5,00 → 100 cents × 5_000_000 micros / 1_000_000 = 500 cents
      expect(convertCents(100, 5_000_000)).toBe(500);
    });

    it('aplica taxa fracionária preservando precisão', () => {
      // 59,90 USD a R$5,123456 → arredonda pra baixo (BigInt division)
      // 5990 × 5_123_456 = 30_689_501_440 / 1_000_000 = 30689 (truncado)
      expect(convertCents(5990, 5_123_456)).toBe(30689);
    });

    it('não dá overflow com valores grandes (BigInt interno)', () => {
      // 100M USD em cents (10^10) × taxa de 5 (5×10^6 micros) seria 5×10^16 — perto do limite
      // de safe integer (2^53 ≈ 9×10^15). Sem BigInt, daria perda de precisão.
      const oneHundredMillionInCents = 100_000_000_00;
      const rateMicros = 5_000_000;
      expect(convertCents(oneHundredMillionInCents, rateMicros)).toBe(500_000_000_00);
    });

    it('retorna zero quando o valor original é zero', () => {
      expect(convertCents(0, 5_000_000)).toBe(0);
    });

    it('retorna zero quando a taxa é zero', () => {
      expect(convertCents(5990, 0)).toBe(0);
    });
  });
});
