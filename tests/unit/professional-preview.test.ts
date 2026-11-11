import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('exibe exatamente um perfil nas telas de desenvolvimento sem preencher as seções públicas', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.resetModules();
  const { professionalPageRepository, professionalRepository, contentRepository } =
    await import('@/infrastructure/repositories');
  const result = await professionalPageRepository.list();
  expect(result.meta.total).toBe(1);
  expect(result.data.map((row) => row.id)).toEqual(['preview']);
  expect(await professionalPageRepository.get('preview')).toMatchObject({
    name: 'Profissional Exemplo',
  });
  expect((await professionalPageRepository.list({ search: 'zzzzinexistenteqqq' })).data).toEqual(
    [],
  );
  expect((await professionalRepository.list()).data).toEqual([]);
  expect(await contentRepository.reviews('preview')).toEqual([]);
});

it.each(['production', 'test'])('não disponibiliza o mock em %s', async (environment) => {
  vi.stubEnv('NODE_ENV', environment);
  vi.resetModules();
  const { professionalPageRepository } = await import('@/infrastructure/repositories');
  expect((await professionalPageRepository.list()).data).toEqual([]);
  expect(await professionalPageRepository.get('preview')).toBeNull();
});
