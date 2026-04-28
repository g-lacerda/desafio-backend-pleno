import { ArgumentsHost, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { HttpExceptionFilter } from './http-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

interface MockRequest {
  url: string;
  method: string;
}

const buildHost = (req: MockRequest, res: MockResponse): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getRequest: <T = unknown>(): T => req as unknown as T,
      getResponse: <T = unknown>(): T => res as unknown as T,
    }),
  }) as unknown as ArgumentsHost;

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let i18n: jest.Mocked<I18nService>;
  let res: MockResponse;
  let req: MockRequest;

  const translations: Record<string, Record<string, string>> = {
    en: {
      'errors.common.notFound': 'Resource not found',
      'errors.common.internalServerError': 'Internal server error',
      'errors.order.notFound': 'Order with id {id} not found',
    },
    'pt-BR': {
      'errors.common.notFound': 'Recurso não encontrado',
      'errors.common.internalServerError': 'Erro interno do servidor',
      'errors.order.notFound': 'Pedido com id {id} não encontrado',
    },
    es: {
      'errors.common.notFound': 'Recurso no encontrado',
      'errors.common.internalServerError': 'Error interno del servidor',
      'errors.order.notFound': 'Pedido con id {id} no encontrado',
    },
  };

  const mockTranslate = (
    key: string,
    options?: { lang?: string; args?: Record<string, unknown> },
  ): string => {
    const lang = options?.lang ?? 'en';
    const template = translations[lang]?.[key];
    if (!template) return key;
    if (!options?.args) return template;
    return Object.entries(options.args).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      template,
    );
  };

  beforeEach(() => {
    i18n = {
      translate: jest.fn().mockImplementation(mockTranslate),
    } as unknown as jest.Mocked<I18nService>;
    filter = new HttpExceptionFilter(i18n);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    req = { url: '/test', method: 'GET' };
  });

  const withLang = (lang: string | undefined, fn: () => void): void => {
    const ctx = lang === undefined ? undefined : ({ lang } as unknown as I18nContext<unknown>);
    jest.spyOn(I18nContext, 'current').mockReturnValue(ctx);
    try {
      fn();
    } finally {
      jest.restoreAllMocks();
    }
  };

  it('traduz NotFoundException com mensagem string genérica em EN', () => {
    withLang('en', () => {
      filter.catch(new NotFoundException(), buildHost(req, res));
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Resource not found');
      expect(body.statusCode).toBe(404);
    });
  });

  it('traduz NotFoundException em pt-BR', () => {
    withLang('pt-BR', () => {
      filter.catch(new NotFoundException(), buildHost(req, res));
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Recurso não encontrado');
    });
  });

  it('traduz NotFoundException em ES', () => {
    withLang('es', () => {
      filter.catch(new NotFoundException(), buildHost(req, res));
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Recurso no encontrado');
    });
  });

  it('traduz exception com chave i18n e args', () => {
    withLang('pt-BR', () => {
      const exception = new HttpException(
        { key: 'errors.order.notFound', args: { id: 'abc-123' } },
        HttpStatus.NOT_FOUND,
      );
      filter.catch(exception, buildHost(req, res));
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Pedido com id abc-123 não encontrado');
    });
  });

  it('mantém mensagem string que não parece chave i18n', () => {
    withLang('en', () => {
      const exception = new HttpException('Plain message', HttpStatus.BAD_REQUEST);
      filter.catch(exception, buildHost(req, res));
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Plain message');
    });
  });

  it('preserva array de mensagens (validation pipe)', () => {
    withLang('en', () => {
      const exception = new HttpException(
        { message: ['campo X é obrigatório', 'campo Y inválido'] },
        HttpStatus.BAD_REQUEST,
      );
      filter.catch(exception, buildHost(req, res));
      const body = res.json.mock.calls[0][0];
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message).toHaveLength(2);
    });
  });

  it('responde 500 com mensagem traduzida quando exception não é HttpException', () => {
    withLang('en', () => {
      filter.catch(new Error('boom'), buildHost(req, res));
      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = res.json.mock.calls[0][0];
      expect(body.message).toBe('Internal server error');
    });
  });

  it('inclui path e timestamp na resposta', () => {
    withLang('en', () => {
      filter.catch(new NotFoundException(), buildHost({ ...req, url: '/orders/xyz' }, res));
      const body = res.json.mock.calls[0][0];
      expect(body.path).toBe('/orders/xyz');
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
