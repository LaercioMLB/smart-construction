import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpAdminRepository } from '@/infrastructure/http/admin-repository';
import { AdminError, type Profession } from '@/features/admin/contracts';

const profession: Profession = {
  id: '028fbd30-f4dc-4a8e-b000-000000000001',
  nome: 'Pintor Teste',
  slug: 'pintor-teste',
  ativo: true,
  versao: 3,
  criado_em: '2026-10-23T12:00:00Z',
  atualizado_em: '2026-10-23T12:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('fronteira HTTP administrativa', () => {
  it('envia a versão lida e CSRF sem persistir credenciais no navegador', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ...profession, versao: 4 })));
    vi.stubGlobal('fetch', fetcher);
    const result = await httpAdminRepository.updateProfession(
      profession,
      { ativo: false },
      'csrf-sintetico',
    );
    expect(result.versao).toBe(4);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/admin/profissoes/${profession.id}`,
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{"ativo":false}',
        headers: expect.objectContaining({ 'If-Match': '"3"', 'X-CSRF-Token': 'csrf-sintetico' }),
      }),
    );
    expect(localStorage.length).toBe(0);
  });
  it('mantém o status do conflito para a UI exigir recarga', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'A profissão foi alterada.' }), { status: 412 }),
        ),
    );
    await expect(
      httpAdminRepository.updateProfession(profession, { nome: 'Outro Nome' }, 'csrf'),
    ).rejects.toMatchObject({ status: 412, message: 'A profissão foi alterada.' });
  });
  it('recusa respostas incompatíveis antes de usar dados no painel', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"administrador":{"senha":"privado"}}')),
    );
    await expect(httpAdminRepository.session()).rejects.toThrow(AdminError);
  });
  it('trata falhas de rede sem expor detalhes internos', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('detalhe-interno')));
    await expect(httpAdminRepository.session()).rejects.toMatchObject({
      status: 0,
      message: 'Não foi possível conectar. Confira sua conexão e tente novamente.',
    });
  });
});
