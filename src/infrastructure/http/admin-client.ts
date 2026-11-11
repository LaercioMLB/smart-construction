import { z } from 'zod';
import { AdminError } from '@/features/admin/contracts';
const errorSchema = z.object({ message: z.string() });

export async function request(path: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AdminError(0, 'Não foi possível conectar. Confira sua conexão e tente novamente.');
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = errorSchema.safeParse(body);
    throw new AdminError(
      response.status,
      error.success ? error.data.message : 'Não foi possível concluir a operação. Tente novamente.',
    );
  }
  return response;
}

export async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success)
    throw new AdminError(0, 'O servidor retornou uma resposta inesperada. Tente novamente.');
  return result.data;
}

export function json(method: string, body: unknown, csrf?: string, version?: number): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(version ? { 'If-Match': `"${version}"` } : {}),
    },
  };
}
