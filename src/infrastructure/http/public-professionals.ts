import { z } from 'zod';
import type {
  PublicProfessionalRepository,
  PublishedProfessional,
} from '@/features/professionals/contracts';
import type { ListQuery } from '@/shared/contracts';
import { publicRequest, PublicApiError } from './public-client';

const image = z.object({
  id: z.uuid(),
  url: z.string().regex(/^\/api\/v1\/profissionais\/[0-9a-f-]{36}\/imagens\/[0-9a-f-]{36}$/),
  ordem: z.number().int().nonnegative(),
});
const profession = z.object({
  id: z.uuid(),
  nome: z.string(),
  slug: z.string(),
  principal: z.boolean(),
});
export const publishedSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  biografia: z.string(),
  localizacao: z.object({ cidade: z.string(), uf: z.string() }),
  profissoes: z.array(profession).min(1).max(5),
  cursos: z.array(
    z.object({
      nome: z.string(),
      instituicao: z.string().nullable(),
      inicio: z.number().int().nullable(),
      conclusao: z.number().int().nullable(),
    }),
  ),
  foto_perfil: image.nullable(),
  fotos_trabalhos: z.array(image).max(6),
});
const pageSchema = z.object({
  data: z.array(publishedSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    facets: z.object({
      profissoes: z.array(
        z.object({
          id: z.uuid(),
          nome: z.string(),
          slug: z.string(),
          count: z.number().int().nonnegative(),
        }),
      ),
    }),
  }),
});
function map(row: z.infer<typeof publishedSchema>): PublishedProfessional {
  return {
    id: row.id,
    name: row.nome,
    bio: row.biografia,
    city: row.localizacao.cidade,
    uf: row.localizacao.uf,
    professions: row.profissoes.map((item) => ({
      id: item.id,
      name: item.nome,
      slug: item.slug,
      primary: item.principal,
    })),
    courses: row.cursos.map((item) => ({
      name: item.nome,
      institution: item.instituicao,
      start: item.inicio,
      end: item.conclusao,
    })),
    avatar: row.foto_perfil?.url ?? null,
    images: row.fotos_trabalhos.map((item) => item.url),
  };
}
export function publicProfessionalQuery(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(Math.max(1, Math.trunc(query.page ?? 1) || 1)),
    limit: String(Math.min(100, Math.max(1, Math.trunc(query.limit ?? 9) || 9))),
    sort_by: query.sortBy === 'name' ? 'nome' : 'relevancia',
  });
  if (query.search?.trim()) params.set('search', query.search.trim().slice(0, 120));
  if (query.city?.trim()) params.set('cidade', query.city.trim().slice(0, 120));
  if (query.uf && /^[A-Z]{2}$/.test(query.uf)) params.set('uf', query.uf);
  for (const id of [...new Set(query.specialty)]
    .filter((id) => z.uuid().safeParse(id).success)
    .slice(0, 5))
    params.append('profissao_id', id);
  return params;
}
export function createPublicProfessionalRepository(base: string): PublicProfessionalRepository {
  return {
    async list(query = {}) {
      const result = await publicRequest(
        `${base}/profissionais?${publicProfessionalQuery(query)}`,
        pageSchema,
      );
      return {
        data: result.data.map(map),
        meta: {
          total: result.meta.total,
          page: result.meta.page,
          limit: result.meta.limit,
          totalPages: Math.max(1, result.meta.total_pages),
          facets: {
            specialties: result.meta.facets.profissoes.map((item) => ({
              slug: item.id,
              name: item.nome,
              count: item.count,
            })),
          },
        },
      };
    },
    async get(id) {
      if (!z.uuid().safeParse(id).success) return null;
      try {
        return map(
          await publicRequest(`${base}/profissionais/${encodeURIComponent(id)}`, publishedSchema),
        );
      } catch (error) {
        if (error instanceof PublicApiError && error.status === 404) return null;
        throw error;
      }
    },
  };
}
