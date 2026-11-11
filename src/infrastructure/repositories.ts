import Fuse from 'fuse.js';
import type { Facet, ListQuery, PageResult, ReadRepository } from '@/shared/contracts';
import type { Service, Category } from '@/shared/types/service';
import type { ServicePage } from '@/shared/types/servicePage';
import type { Product } from '@/shared/types/product';
import type { Professional } from '@/shared/types/profissional';
import type { ProjectDetail } from '@/shared/types/portfolio';
import type { BlogPost } from '@/shared/types/Blog';
import type { Partner } from '@/shared/types/partner';
import type { Review } from '@/shared/types/review';
import servicesData from './fixtures/services.json';
import categoriesData from './fixtures/categories.json';
import productsData from './fixtures/products.json';
import projectsData from './fixtures/projects.json';
import postsData from './fixtures/posts.json';
import partnersData from './fixtures/partners.json';
import servicePagesData from './fixtures/servicePages.json';
import mediaData from './fixtures/media.json';
import homeValuesData from './fixtures/home-values.json';
import { professionalPreview } from './fixtures/professional-preview';
import type { HomePublishedValues } from '@/shared/types/home';
import { createServiceSearch } from '@/features/services/search';
import { demoConfig } from './config';
import { professionalId } from '@/features/professionals/legacy-routes';

export const categoryNames: Record<string, string> = {
  revestimentos: 'Revestimentos',
  paver: 'Paver',
  areia: 'Areia',
  pedras: 'Pedras',
  'pre-moldados': 'Pré Moldados',
  'pedras-decorativas': 'Pedras Decorativas',
  serralheria: 'Serralheria',
  terra: 'Terra',
  portas: 'Portas',
  telhas: 'Telhas',
  forros: 'Forros',
  paisagismo: 'Paisagismo',
  lajes: 'Lajes',
  argamassas: 'Argamassas',
  playground: 'Playground',
  concretos: 'Concretos',
  madeiras: 'Madeiras',
  'materiais-eletricos': 'Materiais Elétricos',
  tijolos: 'Tijolos',
  'placas-cimenticias': 'Placas Cimentícias',
};
function facets(values: string[], names: Record<string, string> = {}): Facet[] {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts]
    .map(([slug, count]) => ({ slug, name: names[slug] ?? slug, count }))
    .sort((a, b) => b.count - a.count);
}
function paginate<T>(
  data: T[],
  query: ListQuery,
  filters: Record<string, Facet[]> = {},
): PageResult<T> {
  const limit = Math.min(500, Math.max(1, Math.trunc(query.limit ?? 9) || 9));
  const totalPages = Math.max(1, Math.ceil(data.length / limit));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(query.page ?? 1) || 1));
  return {
    data: structuredClone(data.slice((page - 1) * limit, page * limit)),
    meta: { total: data.length, page, limit, totalPages, facets: filters },
  };
}
export class MockReadRepository<T> implements ReadRepository<T> {
  constructor(
    private readonly rows: T[],
    private readonly id: (row: T) => string,
    private readonly queryRows: (rows: T[], query: ListQuery) => PageResult<T>,
  ) {}
  async list(query: ListQuery = {}) {
    await demoConfig.beforeOperation();
    return this.queryRows(
      this.rows.filter((row) => this.id(row) !== query.exclude),
      query,
    );
  }
  async get(id: string) {
    await demoConfig.beforeOperation();
    const row = this.rows.find((item) => this.id(item) === id);
    return row ? structuredClone(row) : null;
  }
}
const services: Service[] = servicesData as Service[];
const searchServices = createServiceSearch(services);
export interface ServiceRepository extends ReadRepository<Service> {
  content(slug: string): Promise<ServicePage | null>;
  categories(): Promise<Category[]>;
  counts(): Promise<Record<string, number>>;
  search(query: string): Promise<Service[]>;
}
class MockServiceRepository extends MockReadRepository<Service> implements ServiceRepository {
  async content(slug: string) {
    await demoConfig.beforeOperation();
    return structuredClone((servicePagesData as Record<string, ServicePage>)[slug] ?? null);
  }
  async categories() {
    return structuredClone(categoriesData);
  }
  async counts() {
    return Object.fromEntries(
      facets(services.map((row) => row.type)).map((item) => [item.slug, item.count]),
    );
  }
  async search(query: string) {
    await demoConfig.beforeOperation();
    return structuredClone(searchServices(query).slice(0, 6));
  }
}
export const serviceRepository: ServiceRepository = new MockServiceRepository(
  services,
  (row) => row.slug,
  (rows, query) => {
    let filtered = query.search
      ? searchServices(query.search)
      : [...rows].sort((a, b) => b.popularity - a.popularity);
    filtered = filtered.filter(
      (row) =>
        (!query.type || row.type === query.type) &&
        (!query.category?.length || query.category.includes(row.category)),
    );
    return paginate(filtered, query);
  },
);
const productKeys = [
  { name: 'title', weight: 0.5 },
  { name: 'description', weight: 0.2 },
  { name: 'brand', weight: 0.2 },
  { name: 'category', weight: 0.1 },
];
export const productRepository: ReadRepository<Product> = new MockReadRepository(
  productsData as Product[],
  (row) => row.slug,
  (rows, query) => {
    const searched = query.search
      ? new Fuse(rows, {
          keys: productKeys,
          threshold: 0.3,
          ignoreLocation: true,
          ignoreDiacritics: true,
        })
          .search(query.search)
          .map((hit) => hit.item)
      : [...rows];
    const withCategory = searched.filter(
      (row) => !query.category?.length || query.category.includes(row.category),
    );
    const withBrand = searched.filter(
      (row) => !query.brand?.length || query.brand.includes(row.brandSlug ?? ''),
    );
    const filtered = withCategory.filter(
      (row) => !query.brand?.length || query.brand.includes(row.brandSlug ?? ''),
    );
    if (query.sortBy === 'price-asc')
      filtered.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (query.sortBy === 'price-desc')
      filtered.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if (query.sortBy === 'rating') filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if ((!query.sortBy || query.sortBy === 'relevance') && !query.search)
      filtered.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false));
    const brands = Object.fromEntries(
      rows
        .filter((row) => row.brandSlug && row.brand)
        .map((row) => [row.brandSlug ?? '', row.brand ?? '']),
    );
    return paginate(filtered, query, {
      categories: facets(
        withBrand.map((row) => row.category),
        categoryNames,
      ),
      brands: facets(
        withCategory.flatMap((row) => (row.brandSlug ? [row.brandSlug] : [])),
        brands,
      ),
    });
  },
);
function createProfessionalRepository(rows: Professional[]): ReadRepository<Professional> {
  const repository = new MockReadRepository(
    rows,
    (row) => row.id,
    (rows, query) => {
      const searched = query.search
        ? new Fuse(rows, {
            keys: [
              { name: 'name', weight: 0.4 },
              { name: 'title', weight: 0.3 },
              { name: 'specialties', weight: 0.2 },
              { name: 'bio', weight: 0.1 },
            ],
            threshold: 0.3,
            ignoreDiacritics: true,
            ignoreLocation: true,
            minMatchCharLength: 2,
          })
            .search(query.search)
            .map((hit) => hit.item)
        : [...rows];
      const filtered = searched.filter(
        (row) =>
          row.rating >= (query.minRating ?? 0) &&
          (!query.specialty?.length ||
            row.specialties.some((value) => query.specialty?.includes(value))),
      );
      if (query.sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);
      if (query.sortBy === 'jobs') filtered.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
      if (query.sortBy === 'experience')
        filtered.sort((a, b) => b.yearsExperience - a.yearsExperience);
      if ((!query.sortBy || query.sortBy === 'relevance') && !query.search)
        filtered.sort((a, b) => Number(b.isTopRated) - Number(a.isTopRated));
      return paginate(filtered, query, {
        specialties: facets(searched.flatMap((row) => row.specialties)),
      });
    },
  );
  return {
    list: (query) => repository.list(query),
    get: (id) => repository.get(professionalId(id)),
  };
}
// As seções públicas continuam sem perfis até existirem dados reais aprovados.
export const professionalRepository = createProfessionalRepository([]);
// Prévia solicitada pelo usuário, restrita às telas de profissionais em next dev.
export const professionalPageRepository =
  process.env.NODE_ENV === 'development'
    ? createProfessionalRepository([professionalPreview])
    : professionalRepository;
export const projectRepository: ReadRepository<ProjectDetail> = new MockReadRepository(
  projectsData as ProjectDetail[],
  (row) => String(row.id),
  (rows, query) =>
    paginate(
      rows.filter((row) => !query.category?.length || query.category.includes(row.category)),
      query,
    ),
);
export const postRepository: ReadRepository<BlogPost> = new MockReadRepository(
  postsData,
  (row) => row.slug,
  (rows, query) => {
    const searched = query.search
      ? new Fuse(rows, { keys: ['title', 'summary'], threshold: 0.3, ignoreDiacritics: true })
          .search(query.search)
          .map((hit) => hit.item)
      : rows;
    return paginate(
      searched.filter(
        (row) =>
          !query.category?.length ||
          row.categories.some((category) => query.category?.includes(category.slug)),
      ),
      query,
    );
  },
);
export interface ContentRepository {
  partners(): Promise<Partner[]>;
  reviews(id: string): Promise<Review[]>;
  media(): Promise<{ homeHero: string }>;
  stats(): Promise<HomePublishedValues>;
}
export const contentRepository: ContentRepository = {
  async partners() {
    return structuredClone(partnersData);
  },
  async reviews() {
    // Avaliações sintéticas não fazem parte do conteúdo publicado.
    return [];
  },
  async media() {
    return structuredClone(mediaData);
  },
  async stats() {
    return structuredClone(homeValuesData);
  },
};
