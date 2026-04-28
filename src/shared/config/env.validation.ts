import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),

  DEFAULT_LANGUAGE: Joi.string().valid('en', 'pt-BR', 'es').default('en'),

  // Throttler — limite de requisições por janela no webhook público.
  WEBHOOK_THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(10),
  WEBHOOK_THROTTLE_LIMIT: Joi.number().integer().min(1).default(20),

  // Idempotência — janela durante a qual a mesma chave é considerada duplicada.
  IDEMPOTENCY_TTL_HOURS: Joi.number().integer().min(1).default(24),

  // AwesomeAPI — fonte de cotação para enriquecimento.
  AWESOMEAPI_BASE_URL: Joi.string()
    .uri()
    .default('https://economia.awesomeapi.com.br'),
  AWESOMEAPI_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
  AWESOMEAPI_TOKEN: Joi.string().allow('').optional(),

  // Enrichment worker — política de retry para o worker da fila.
  ENRICHMENT_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  ENRICHMENT_BACKOFF_BASE_MS: Joi.number().integer().min(10).default(1000),

  // Prefix do BullMQ — usado em testes pra isolar filas entre suites.
  BULL_PREFIX: Joi.string().optional(),
});
