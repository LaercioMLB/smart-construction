import { json, parse, request } from './admin-client';
import { z } from 'zod';
import type { AdminRepository } from '@/features/admin/contracts';
import { registrationRepository } from './registration-repository';

const sessionSchema = z.object({
  administrador: z.object({ id: z.uuid(), nome: z.string(), login: z.string() }),
  expira_em: z.iso.datetime({ offset: true }),
  csrf_token: z.string().min(32),
});
const professionSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  slug: z.string(),
  ativo: z.boolean(),
  versao: z.number().int().positive(),
  criado_em: z.iso.datetime({ offset: true }),
  atualizado_em: z.iso.datetime({ offset: true }),
});
const pageSchema = z.object({
  data: z.array(professionSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    total_pages: z.number(),
  }),
});
const historySchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      acao: z.string(),
      administrador: sessionSchema.shape.administrador,
      ocorrido_em: z.iso.datetime({ offset: true }),
      motivo: z.string().nullable(),
      alteracoes: z.array(
        z.object({
          campo: z.string(),
          valor_anterior: z.string().nullable(),
          valor_atual: z.string().nullable(),
        }),
      ),
    }),
  ),
  meta: pageSchema.shape.meta,
});

export const httpAdminRepository: AdminRepository = {
  ...registrationRepository,
  async session() {
    return parse(await request('/admin/sessao'), sessionSchema);
  },
  async login(login, password) {
    return parse(
      await request('/admin/sessao', json('POST', { login, senha: password })),
      sessionSchema,
    );
  },
  async logout(csrf) {
    await request('/admin/sessao', { method: 'DELETE', headers: { 'X-CSRF-Token': csrf } });
  },
  async professions(filters) {
    const query = new URLSearchParams({ page: String(filters.page), limit: '20' });
    if (filters.search.trim()) query.set('search', filters.search.trim());
    if (filters.active) query.set('ativo', filters.active);
    return parse(await request(`/admin/profissoes?${query}`), pageSchema);
  },
  async createProfession(nome, ativo, csrf) {
    return parse(
      await request('/admin/profissoes', json('POST', { nome, ativo }, csrf)),
      professionSchema,
    );
  },
  async updateProfession(profession, changes, csrf) {
    return parse(
      await request(
        `/admin/profissoes/${profession.id}`,
        json('PATCH', changes, csrf, profession.versao),
      ),
      professionSchema,
    );
  },
  async professionHistory(id, page) {
    return parse(
      await request(`/admin/profissoes/${id}/historico?page=${page}&limit=10`),
      historySchema,
    );
  },
};
