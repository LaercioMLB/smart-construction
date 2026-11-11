import { z } from 'zod';

const problem = z.object({
  code: z.string(),
  message: z.string(),
  field_errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = '',
    public readonly fields: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
  get retryable() {
    return (
      this.status === 0 ||
      this.status >= 500 ||
      this.status === 408 ||
      this.status === 429 ||
      this.code === 'SUBMISSION_CONFLICT'
    );
  }
}
export async function publicRequest<T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(options?.method === 'POST' ? 90000 : 10000),
    });
  } catch {
    throw new PublicApiError(0, 'Não foi possível conectar. Tente novamente.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = problem.safeParse(body);
    throw new PublicApiError(
      response.status,
      error.success ? error.data.message : 'Não foi possível concluir. Tente novamente.',
      error.success ? error.data.code : '',
      error.success ? (error.data.field_errors ?? []) : [],
    );
  }
  const result = schema.safeParse(body);
  if (!result.success)
    throw new PublicApiError(0, 'Não foi possível confirmar a resposta. Tente novamente.');
  return result.data;
}
