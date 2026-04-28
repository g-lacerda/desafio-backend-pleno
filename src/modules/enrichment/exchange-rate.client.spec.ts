import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { ExchangeRateUnavailableException } from './exceptions/exchange-rate-unavailable.exception';
import { InvalidCurrencyException } from './exceptions/invalid-currency.exception';
import { ExchangeRateClient } from './exchange-rate.client';

describe('ExchangeRateClient', () => {
  let client: ExchangeRateClient;
  let http: { get: jest.Mock };

  const buildClient = (overrides: Record<string, unknown> = {}) => {
    http = { get: jest.fn() };
    const config = {
      getOrThrow: (key: string) => {
        const map: Record<string, unknown> = {
          AWESOMEAPI_BASE_URL: 'https://economia.awesomeapi.com.br',
          AWESOMEAPI_TIMEOUT_MS: 5000,
          ...overrides,
        };
        return map[key];
      },
      get: () => undefined,
    } as unknown as ConfigService;
    client = new ExchangeRateClient(http as unknown as HttpService, config);
  };

  beforeEach(() => buildClient());

  it('retorna 1.000.000 (taxa identidade) quando moeda já é BRL, sem chamar HTTP', async () => {
    const result = await client.getRateToBrlMicros('BRL');
    expect(result).toBe(1_000_000);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('parseia bid e converte pra micros', async () => {
    http.get.mockReturnValue(of({ data: { USDBRL: { bid: '5.123456' } } }));

    const result = await client.getRateToBrlMicros('USD');

    expect(result).toBe(5_123_456);
    expect(http.get).toHaveBeenCalledWith(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL',
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('lança ExchangeRateUnavailableException quando bid está ausente', async () => {
    http.get.mockReturnValue(of({ data: { USDBRL: {} } }));

    await expect(client.getRateToBrlMicros('USD')).rejects.toBeInstanceOf(
      ExchangeRateUnavailableException,
    );
  });

  it('lança ExchangeRateUnavailableException em 5xx', async () => {
    http.get.mockReturnValue(throwError(() => buildAxiosError(503)));

    const error = await client.getRateToBrlMicros('USD').catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeRateUnavailableException);
    expect((error as ExchangeRateUnavailableException).retryable).toBe(true);
  });

  it('lança ExchangeRateUnavailableException em timeout', async () => {
    http.get.mockReturnValue(throwError(() => buildAxiosError(undefined, 'timeout')));

    const error = await client.getRateToBrlMicros('USD').catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeRateUnavailableException);
  });

  it('lança InvalidCurrencyException em 4xx', async () => {
    http.get.mockReturnValue(throwError(() => buildAxiosError(404)));

    const error = await client.getRateToBrlMicros('XXX').catch((e) => e);
    expect(error).toBeInstanceOf(InvalidCurrencyException);
    expect((error as InvalidCurrencyException).retryable).toBe(false);
    expect((error as InvalidCurrencyException).args).toEqual({ currency: 'XXX' });
  });

  it('inclui token como query param quando configurado', async () => {
    buildClient({ AWESOMEAPI_TOKEN: 'my-token-xyz' });
    // Reconstrói com token customizado
    const config = {
      getOrThrow: (k: string) =>
        ({
          AWESOMEAPI_BASE_URL: 'https://economia.awesomeapi.com.br',
          AWESOMEAPI_TIMEOUT_MS: 5000,
        })[k],
      get: () => 'my-token-xyz',
    } as unknown as ConfigService;
    http = { get: jest.fn().mockReturnValue(of({ data: { USDBRL: { bid: '5.0' } } })) };
    client = new ExchangeRateClient(http as unknown as HttpService, config);

    await client.getRateToBrlMicros('USD');

    expect(http.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { token: 'my-token-xyz' } }),
    );
  });
});

function buildAxiosError(status?: number, code?: string): AxiosError {
  const error = new Error('axios error') as AxiosError;
  (error as unknown as { isAxiosError: boolean }).isAxiosError = true;
  if (status !== undefined) {
    error.response = { status } as AxiosError['response'];
  }
  if (code) error.code = code;
  return error;
}
