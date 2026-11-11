import { z } from 'zod';
import type {
  EnrollmentInput,
  EnrollmentRepository,
  EnrollmentConfiguration,
} from '@/features/enrollment/contracts';
import { publicRequest } from './public-client';

const configuration = z.object({
  habilitado: z.boolean(),
  versao_termos: z.string().nullable(),
  versao_privacidade: z.string().nullable(),
});
const professions = z.object({
  data: z.array(z.object({ id: z.uuid(), nome: z.string(), slug: z.string() })),
  meta: z.object({ total_pages: z.number().int().nonnegative() }),
});
const receipt = z.object({
  protocolo: z.string().min(20).max(100),
  status: z.literal('pendente'),
  recebido_em: z.iso.datetime({ offset: true }),
});
export function enrollmentBody(input: EnrollmentInput, config: EnrollmentConfiguration): FormData {
  const body = new FormData();
  body.set(
    'dados',
    JSON.stringify({
      ...input.dados,
      aceites: {
        maior_de_idade: true,
        termos_aceitos: true,
        versao_termos: config.versao_termos,
        privacidade_aceita: true,
        versao_privacidade: config.versao_privacidade,
        ...(input.tipo === 'profissional' ? { autorizacao_publicacao: true } : {}),
      },
    }),
  );
  if (input.tipo === 'profissional') {
    if (input.foto_perfil) body.set('foto_perfil', input.foto_perfil);
    input.fotos_trabalhos.forEach((file) => body.append('fotos_trabalhos', file));
  } else if (input.logo) body.set('logo', input.logo);
  return body;
}
export function createEnrollmentRepository(base: string): EnrollmentRepository {
  return {
    configuration: () => publicRequest(`${base}/cadastros/configuracao`, configuration),
    async professions() {
      const result: { id: string; nome: string; slug: string }[] = [];
      let page = 1;
      let pages = 1;
      do {
        const response = await publicRequest(
          `${base}/profissoes?limit=100&page=${page}`,
          professions,
        );
        result.push(...response.data);
        pages = response.meta.total_pages;
        page++;
      } while (page <= pages);
      return result;
    },
    submit: (kind, body, key) =>
      publicRequest(
        `${base}/cadastros/${kind === 'profissional' ? 'profissionais' : 'empresas'}`,
        receipt,
        { method: 'POST', body, headers: { 'Idempotency-Key': key } },
      ),
  };
}
