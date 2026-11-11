import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicProfessionalRepository,
  publicProfessionalQuery,
} from '@/infrastructure/http/public-professionals';
import {
  createEnrollmentRepository,
  enrollmentBody,
} from '@/infrastructure/http/enrollment-repository';
import { PublicApiError } from '@/infrastructure/http/public-client';
import { professionalSchema, validateFiles } from '@/features/enrollment/api-validation';

const id = '028fbd30-f4dc-4a8e-b000-000000000001';
const config = { habilitado: true, versao_termos: 'teste-v1', versao_privacidade: 'teste-v1' };
const data = {
  nome: 'Pessoa Sintética',
  cpf: '12345678909',
  nascimento: null,
  whatsapp: '+5545991234567',
  email: null,
  endereco: {
    cidade: 'Cidade Sintética',
    uf: 'PR',
    cep: null,
    rua: null,
    numero: null,
    complemento: null,
    bairro: null,
  },
  biografia: 'Apresentação sintética de teste para o cadastro.',
  profissoes: [{ profissao_id: id, principal: true }],
  cursos: [],
};
afterEach(() => vi.unstubAllGlobals());

describe('integração pública', () => {
  it('mapeia apenas dados públicos, sem inventar foto ou métricas', async () => {
    const row = {
      id,
      nome: 'Nome Sintético',
      biografia: data.biografia,
      localizacao: { cidade: 'Cidade', uf: 'PR' },
      profissoes: [{ id, nome: 'Pintor', slug: 'pintor', principal: true }],
      cursos: [],
      foto_perfil: null,
      fotos_trabalhos: [],
      cpf: 'privado',
      whatsapp: 'privado',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(row))),
    );
    const result = await createPublicProfessionalRepository('/api/v1').get(id);
    expect(result).toMatchObject({ name: 'Nome Sintético', avatar: null, courses: [], images: [] });
    for (const field of ['cpf', 'whatsapp', 'rating', 'yearsExperience', 'isTopRated'])
      expect(result).not.toHaveProperty(field);
  });
  it('diferencia 404 de indisponibilidade', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'DEPENDENCY_UNAVAILABLE', message: 'Tente novamente.' }),
          { status: 503 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const repository = createPublicProfessionalRepository('/api/v1');
    expect(await repository.get('preview')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(await repository.get(id)).toBeNull();
    await expect(repository.get(id)).rejects.toMatchObject({ status: 503 });
  });
  it('converte filtros e limita a consulta ao contrato, sem ordenar por avaliações', () => {
    const query = publicProfessionalQuery({
      limit: 500,
      page: -1,
      specialty: [id, id, 'pedreiro'],
      sortBy: 'rating',
      city: ' Cidade ',
      uf: 'PR',
      minRating: 4,
    });
    expect(query.get('limit')).toBe('100');
    expect(query.get('page')).toBe('1');
    expect(query.getAll('profissao_id')).toEqual([id]);
    expect(query.get('sort_by')).toBe('relevancia');
    expect(query.get('cidade')).toBe('Cidade');
    expect(query.has('minRating')).toBe(false);
  });
  it('reenvia o mesmo corpo/chave após resultado incerto, mantendo finalidades de imagens', async () => {
    const receipt = {
      protocolo: 'protocolo-sintetico-para-teste',
      status: 'pendente',
      recebido_em: '2026-10-23T12:00:00Z',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('conexão perdida'))
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt)));
    vi.stubGlobal('fetch', fetcher);
    const image = new File(['sintético'], 'foto.png', { type: 'image/png' });
    const body = enrollmentBody(
      { tipo: 'profissional', dados: data, foto_perfil: image, fotos_trabalhos: [image] },
      config,
    );
    const repository = createEnrollmentRepository('/api/v1');
    await expect(repository.submit('profissional', body, id)).rejects.toMatchObject({ status: 0 });
    expect(await repository.submit('profissional', body, id)).toEqual(receipt);
    for (const call of fetcher.mock.calls) {
      expect(call[1]?.body).toBe(body);
      expect(call[1]?.headers).toEqual({ 'Idempotency-Key': id });
      expect(call[1]?.credentials).toBe('omit');
    }
    expect(body.getAll('fotos_trabalhos')).toHaveLength(1);
    expect(body.get('foto_perfil')).toBeInstanceOf(File);
    expect(body.has('logo')).toBe(false);
    expect(JSON.parse(String(body.get('dados'))).aceites).toMatchObject({
      autorizacao_publicacao: true,
      maior_de_idade: true,
      versao_termos: 'teste-v1',
    });
    expect(new PublicApiError(503, 'Indisponível').retryable).toBe(true);
    expect(new PublicApiError(422, 'Inválido').retryable).toBe(false);
  });
  it('aceita nascimento ausente, rejeita menor e valida principal, cursos e arquivos', () => {
    expect(professionalSchema.safeParse(data).success).toBe(true);
    expect(professionalSchema.safeParse({ ...data, nascimento: '2020-01-01' }).success).toBe(false);
    expect(
      professionalSchema.safeParse({
        ...data,
        profissoes: [{ profissao_id: id, principal: false }],
      }).success,
    ).toBe(false);
    expect(
      professionalSchema.safeParse({
        ...data,
        cursos: [{ nome: 'Curso', instituicao: null, inicio: 2024, conclusao: 2020 }],
      }).success,
    ).toBe(false);
    const image = new File(['sintético'], 'foto.png', { type: 'image/png' });
    expect(validateFiles(undefined, [], undefined)).toBeNull();
    expect(
      validateFiles(
        undefined,
        Array.from({ length: 7 }, () => image),
        undefined,
      ),
    ).not.toBeNull();
    expect(
      validateFiles(new File(['x'], 'arquivo.svg', { type: 'image/svg+xml' }), [], undefined),
    ).not.toBeNull();
  });
});
