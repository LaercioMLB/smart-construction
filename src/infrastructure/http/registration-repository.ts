import { z } from 'zod';
import type { RegistrationRepository } from '@/features/admin/registration-contracts';
import { json, parse, request } from './admin-client';

const date = z.iso.datetime({ offset: true });
const administrator = z.object({ id: z.uuid(), nome: z.string(), login: z.string() });
const meta = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
});
const base = z.object({
  id: z.uuid(),
  protocolo: z.string(),
  status: z.enum(['pendente', 'aprovado', 'reprovado']),
  versao: z.number().int().positive(),
  criado_em: date,
  atualizado_em: date,
});
const address = z.object({
  cidade: z.string(),
  uf: z.string(),
  cep: z.string().nullable(),
  rua: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
});
const choice = z.union([
  z.object({ profissao_id: z.uuid(), principal: z.boolean() }),
  z.object({ sugestao: z.string(), principal: z.boolean() }),
]);
const course = z.object({
  nome: z.string(),
  instituicao: z.string().nullable(),
  inicio: z.number().int().nullable(),
  conclusao: z.number().int().nullable(),
});
const professional = z.object({
  nome: z.string(),
  cpf: z.string(),
  nascimento: z.string().nullable(),
  whatsapp: z.string(),
  email: z.string().nullable(),
  endereco: address,
  biografia: z.string(),
  profissoes: z.array(choice),
  cursos: z.array(course),
});
const company = z.object({
  razao_social: z.string(),
  nome_fantasia: z.string().nullable(),
  cnpj: z.string(),
  responsavel: z.string(),
  whatsapp: z.string(),
  email: z.string().nullable(),
  segmento: z.string(),
  endereco: address,
  descricao: z.string().nullable(),
});
const file = z.object({
  id: z.uuid(),
  finalidade: z.enum(['foto_perfil', 'foto_trabalho', 'logo']),
  content_type: z.enum(['image/jpeg', 'image/png']),
  tamanho_bytes: z.number().int(),
  estado: z.enum(['pronto', 'processando', 'erro']),
  ordem: z.number().int(),
  criado_em: date,
  acesso_path: z.string().regex(/^\/api\/v1\/admin\/arquivos\/[0-9a-f-]{36}$/),
});
const common = base.extend({
  arquivos: z.array(file),
  motivo_reprovacao: z.string().nullable(),
  aceites: z.array(
    z.object({
      tipo: z.enum(['termos', 'privacidade', 'publicacao', 'maioridade']),
      versao: z.string(),
      aceito_em: date,
    }),
  ),
});
export const registrationSchema = z.discriminatedUnion('tipo', [
  common.extend({
    tipo: z.literal('profissional'),
    profissional_id: z.uuid(),
    dados: professional,
    publicacao: z.object({
      publicado: z.boolean(),
      revisao: z.number().int(),
      atualizado_em: date.nullable(),
    }),
  }),
  common.extend({ tipo: z.literal('empresa'), empresa_id: z.uuid(), dados: company }),
]);
const page = z.object({
  data: z.array(
    base.extend({ tipo: z.enum(['profissional', 'empresa']), nome_exibicao: z.string() }),
  ),
  meta,
});
const history = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      acao: z.string(),
      administrador: administrator.nullable(),
      ocorrido_em: date,
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
  meta,
});

export const registrationRepository: RegistrationRepository = {
  async uploadRegistrationFile(record, image, purpose, csrf) {
    const body = new FormData();
    body.set('arquivo', image);
    body.set('finalidade', purpose);
    await parse(
      await request(`/admin/cadastros/${record.id}/arquivos`, {
        method: 'POST',
        body,
        headers: { 'X-CSRF-Token': csrf, 'If-Match': `"${record.versao}"` },
      }),
      z.object({ arquivo: file, versao_cadastro: z.number().int().positive() }),
    );
  },
  async removeRegistrationFile(record, image, csrf) {
    await parse(
      await request(`/admin/cadastros/${record.id}/arquivos/${image.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf, 'If-Match': `"${record.versao}"` },
      }),
      z.object({ arquivo_id: z.uuid(), versao_cadastro: z.number().int().positive() }),
    );
  },
  async registrations(filters) {
    const query = new URLSearchParams({ page: String(filters.page), limit: '20' });
    for (const key of ['tipo', 'status', 'search'] as const)
      if (filters[key].trim()) query.set(key, filters[key].trim());
    return parse(await request(`/admin/cadastros?${query}`), page);
  },
  async registration(id) {
    return parse(await request(`/admin/cadastros/${encodeURIComponent(id)}`), registrationSchema);
  },
  async registrationHistory(id, page) {
    return parse(
      await request(`/admin/cadastros/${encodeURIComponent(id)}/historico?page=${page}&limit=10`),
      history,
    );
  },
  async updateRegistration(record, changes, csrf) {
    return parse(
      await request(`/admin/cadastros/${record.id}`, json('PATCH', changes, csrf, record.versao)),
      registrationSchema,
    );
  },
  async decideRegistration(record, action, csrf, reason) {
    const path =
      action === 'publicar' || action === 'despublicar'
        ? record.tipo === 'profissional'
          ? `/admin/profissionais/${record.profissional_id}/${action}`
          : ''
        : `/admin/cadastros/${record.id}/${action}`;
    if (!path) throw new Error('Empresas permanecem privadas.');
    return parse(
      await request(
        path,
        json('POST', action === 'reprovar' ? { motivo: reason } : undefined, csrf, record.versao),
      ),
      registrationSchema,
    );
  },
};
