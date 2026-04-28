import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { toRateMicros } from '@/shared/money/money.utils';
import { ExchangeRateUnavailableException } from './exceptions/exchange-rate-unavailable.exception';
import { InvalidCurrencyException } from './exceptions/invalid-currency.exception';

const TARGET_CURRENCY = 'BRL';
const IDENTITY_RATE_MICROS = 1_000_000;

interface AwesomeApiPair {
  bid?: string;
}

@Injectable()
export class ExchangeRateClient {
  private readonly logger = new Logger(ExchangeRateClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly token?: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('AWESOMEAPI_BASE_URL').replace(/\/$/, '');
    this.timeoutMs = config.getOrThrow<number>('AWESOMEAPI_TIMEOUT_MS');
    const token = config.get<string>('AWESOMEAPI_TOKEN');
    this.token = token && token.length > 0 ? token : undefined;
  }

  /**
   * Retorna a taxa de câmbio em micro-unidades (× 10⁶) da moeda informada para BRL.
   * Para BRL → BRL devolve a taxa identidade (1.000.000) sem chamada HTTP.
   */
  async getRateToBrlMicros(currency: string): Promise<number> {
    if (currency === TARGET_CURRENCY) return IDENTITY_RATE_MICROS;

    const pair = `${currency}-${TARGET_CURRENCY}`;
    const url = `${this.baseUrl}/json/last/${pair}`;
    const params = this.token ? { token: this.token } : undefined;

    try {
      const response = await firstValueFrom(
        this.http.get<Record<string, AwesomeApiPair>>(url, {
          timeout: this.timeoutMs,
          params,
        }),
      );

      const key = `${currency}${TARGET_CURRENCY}`;
      const bid = response.data?.[key]?.bid;
      const parsed = bid !== undefined ? Number(bid) : NaN;

      if (!Number.isFinite(parsed) || parsed <= 0) {
        this.logger.warn({ currency, response: response.data }, 'Malformed rate response');
        throw new ExchangeRateUnavailableException('Malformed rate response');
      }

      return toRateMicros(parsed);
    } catch (error) {
      if (this.isAxiosError(error)) {
        const status = error.response?.status;
        if (status !== undefined && status >= 400 && status < 500) {
          // 4xx → moeda inexistente / mal formada. Não retentar.
          throw new InvalidCurrencyException(currency);
        }
        // Timeout, 5xx, conexão recusada: erro transiente.
        throw new ExchangeRateUnavailableException(error.message);
      }
      if (error instanceof ExchangeRateUnavailableException || error instanceof InvalidCurrencyException) {
        throw error;
      }
      throw new ExchangeRateUnavailableException((error as Error).message);
    }
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      error instanceof Error &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }
}
