import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    DEFAULT_LANGUAGE: 'en',
    ADMIN_API_KEY: 'sufficient-length-admin-key',
    WEBHOOK_SECRET: 'sufficient-length-webhook-secret',
  };

  it('aceita configuração válida', () => {
    const { error } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('aplica defaults para campos opcionais', () => {
    const { error, value } = envValidationSchema.validate({
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_HOST: validEnv.REDIS_HOST,
      ADMIN_API_KEY: validEnv.ADMIN_API_KEY,
      WEBHOOK_SECRET: validEnv.WEBHOOK_SECRET,
    });
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.REDIS_PORT).toBe(6379);
    expect(value.DEFAULT_LANGUAGE).toBe('en');
  });

  it('rejeita ADMIN_API_KEY ausente', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      ADMIN_API_KEY: undefined,
    });
    expect(error?.message).toContain('ADMIN_API_KEY');
  });

  it('rejeita ADMIN_API_KEY com menos de 16 caracteres', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      ADMIN_API_KEY: 'short',
    });
    expect(error?.message).toContain('ADMIN_API_KEY');
  });

  it('rejeita WEBHOOK_SECRET ausente', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      WEBHOOK_SECRET: undefined,
    });
    expect(error?.message).toContain('WEBHOOK_SECRET');
  });

  it('rejeita WEBHOOK_SECRET com menos de 16 caracteres', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      WEBHOOK_SECRET: 'short',
    });
    expect(error?.message).toContain('WEBHOOK_SECRET');
  });

  it('rejeita ausência de DATABASE_URL', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: undefined,
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejeita DATABASE_URL com scheme inválido', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: 'mysql://user:pass@localhost/db',
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejeita ausência de REDIS_HOST', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      REDIS_HOST: undefined,
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('REDIS_HOST');
  });

  it('rejeita NODE_ENV inválido', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      NODE_ENV: 'staging',
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('NODE_ENV');
  });

  it('rejeita PORT fora do intervalo', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      PORT: 99999,
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('PORT');
  });

  it('rejeita DEFAULT_LANGUAGE não suportado', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DEFAULT_LANGUAGE: 'fr',
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('DEFAULT_LANGUAGE');
  });
});
