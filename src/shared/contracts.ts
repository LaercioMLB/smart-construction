export interface Facet {
  name: string;
  slug: string;
  count: number;
}
export interface ListQuery {
  search?: string;
  page?: number;
  limit?: number;
  category?: string[];
  brand?: string[];
  specialty?: string[];
  minRating?: number;
  sortBy?: string;
  type?: string;
  city?: string;
  uf?: string;
  exclude?: string;
}
export interface PageResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    facets: Record<string, Facet[]>;
  };
}
export interface ReadRepository<T> {
  list(query?: ListQuery): Promise<PageResult<T>>;
  get(id: string): Promise<T | null>;
}
export class DemoError extends Error {
  constructor(message = 'Não foi possível carregar. Tente novamente.') {
    super(message);
    this.name = 'DemoError';
  }
}
