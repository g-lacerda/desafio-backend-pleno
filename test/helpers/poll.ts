/**
 * Repete `fn` até a Promise retornar um valor truthy ou estourar o timeout.
 * Usado em testes E2E de fila para aguardar o worker processar um job.
 */
export async function poll<T>(
  fn: () => Promise<T | null | undefined>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`poll: timeout after ${timeoutMs}ms`);
}
