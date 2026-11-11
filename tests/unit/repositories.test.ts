import { afterEach, describe, expect, it } from 'vitest';
import {
  productRepository,
  professionalRepository,
  serviceRepository,
  projectRepository,
  postRepository,
  contentRepository,
} from '@/infrastructure/repositories';
import { demoConfig } from '@/infrastructure/config';
import { QUICK_SEARCHES, TYPING_EXAMPLES } from '@/features/services/search-examples';
afterEach(() => demoConfig.configure({}));
describe('busca equivalente ao legado', () => {
  it.each([
    ['meu cano estourou', 'Encanador'],
    ['preciso tirar entulho', 'Locação de Caçamba'],
    ['quero pintar a casa', 'Pintor'],
    ['preciso de uma caçamba', 'Locação de Caçamba'],
    ['vazamento no telhado', 'Reforma de Telhado'],
    ['alugar máquina para obra', 'Locação de Equipamentos Pesados'],
    ['cano estourado', 'Encanador'],
    ['pia entupida', 'Encanador'],
    ['cacamba', 'Locação de Caçamba'],
  ])('consulta %s encontra %s primeiro', async (query, name) => {
    expect((await serviceRepository.search(query))[0]?.name).toBe(name);
  });
  it.each([...QUICK_SEARCHES, ...TYPING_EXAMPLES])(
    'texto ensinado %s retorna sugestões',
    async (text) => {
      expect((await serviceRepository.search(text)).length).toBeGreaterThan(0);
    },
  );
  it('consulta curta e vazia', async () => {
    expect(
      (await serviceRepository.search('ar')).some((item) => item.name === 'Ar-Condicionado'),
    ).toBe(true);
    expect(await serviceRepository.search('')).toEqual([]);
  });
});
describe('contratos de dados locais', () => {
  it('não publica perfis sintéticos e preserva ordenação/paginação do portfólio', async () => {
    expect(await professionalRepository.get('roberto-silva')).toEqual(
      await professionalRepository.get('1'),
    );
    expect(await contentRepository.reviews('roberto-silva')).toEqual(
      await contentRepository.reviews('1'),
    );
    expect(await professionalRepository.get('roberto-silva')).toBeNull();
    expect(await professionalRepository.get('1')).toBeNull();
    expect(await contentRepository.reviews('1')).toEqual([]);
    const projects = await projectRepository.list({ limit: 6 });
    expect(projects.data.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 7]);
    expect(projects.meta.totalPages).toBe(2);
  });
  it('catálogo filtra, ordena, pagina e não perde portas', async () => {
    const all = await productRepository.list({ limit: 500 });
    expect(all.meta.total).toBe(186);
    const doors = await productRepository.list({ category: ['portas'], limit: 500 });
    expect(doors.data.length).toBeGreaterThan(0);
    expect(doors.data.every((item) => item.category === 'portas')).toBe(true);
    const sorted = await productRepository.list({ sortBy: 'price-asc', limit: 500 });
    const prices = sorted.data.flatMap((row) => (row.price === undefined ? [] : [row.price]));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const first = await productRepository.list({ page: 1, limit: 9 });
    const second = await productRepository.list({ page: 2, limit: 9 });
    expect(first.data.some((row) => second.data.some((next) => next.id === row.id))).toBe(false);
    expect((await productRepository.list({ search: 'zzzzinexistenteqqq' })).data).toEqual([]);
  });
  it('filtros múltiplos, facets e fronteiras de paginação são coerentes', async () => {
    const result = await productRepository.list({ category: ['portas', 'areia'], limit: 500 });
    expect(result.data.every((row) => ['portas', 'areia'].includes(row.category))).toBe(true);
    expect(result.meta.facets.categories.reduce((sum, c) => sum + c.count, 0)).toBe(186);
    const resultNegative = await productRepository.list({ page: -4, limit: -1 });
    expect(resultNegative.meta.page).toBe(1);
    expect(resultNegative.meta.limit).toBe(1);
    const resultLarge = await productRepository.list({ page: 9999 });
    expect(resultLarge.meta.page).toBe(resultLarge.meta.totalPages);
  });
  it('mantém perfis e avaliações fora do catálogo publicado até receber dados reais', async () => {
    const all = await professionalRepository.list({ limit: 500 });
    expect(all.data).toEqual([]);
    expect(all.meta.total).toBe(0);
    const result = await professionalRepository.list({
      specialty: ['Pintura'],
      minRating: 4,
      sortBy: 'rating',
      limit: 500,
    });
    expect(result.data).toEqual([]);
    expect(await contentRepository.reviews('roberto-silva')).toEqual([]);
  });
  it('todos os serviços possuem conteúdo e mantêm segregação dos trilhos', async () => {
    const all = await serviceRepository.list({ limit: 500 });
    expect(all.data).toHaveLength(93);
    for (const row of all.data) expect(await serviceRepository.content(row.slug)).not.toBeNull();
    const rental = await serviceRepository.list({ type: 'locacao', limit: 500 });
    expect(rental.data.every((row) => row.type === 'locacao')).toBe(true);
    expect(await serviceRepository.get('nao-existe')).toBeNull();
    expect(await postRepository.get('nao-existe')).toBeNull();
  });
  it('operações não permitem mutar fixtures por referência', async () => {
    const first = await productRepository.list();
    const original = first.data[0].title;
    first.data[0].title = 'alterado';
    expect((await productRepository.get(first.data[0].slug))?.title).toBe(original);
    const content = await serviceRepository.content('eletricista');
    if (content) content.meta.title = 'alterado';
    expect((await serviceRepository.content('eletricista'))?.meta.title).not.toBe('alterado');
  });
  it('preserva os indicadores editoriais publicados sem expor perfis fictícios', async () => {
    const stats = await contentRepository.stats();
    expect(stats).toMatchObject({
      professionals: 120,
      professionalsDisplay: '120+',
      projects: 1500,
      projectsDisplay: '1.5k',
      rating: 4.8,
      satisfaction: 100,
    });
    stats.professionals = 0;
    expect((await contentRepository.stats()).professionals).toBe(120);
    expect((await professionalRepository.list()).meta.total).toBe(0);
    expect((await projectRepository.list()).meta.total).toBe(9);
    const p = await professionalRepository.get('1');
    expect(await contentRepository.reviews('1')).toHaveLength(p?.reviewCount ?? 0);
  });
  it('falha controlada não corrompe próxima leitura', async () => {
    demoConfig.configure({ failures: 1 });
    await expect(productRepository.list()).rejects.toThrow('Não foi possível carregar');
    await expect(productRepository.list()).resolves.toHaveProperty('meta.total', 186);
  });
});
