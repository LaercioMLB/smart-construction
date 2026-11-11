import type { ListQuery } from './contracts';
export type SearchParams = Record<string, string | string[] | undefined>;
export function listQuery(params: SearchParams): ListQuery {
  const array = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value : value ? [value] : [];
  };
  const text = (key: string) => array(key)[0];
  return {
    search: text('search'),
    category: array('category'),
    brand: array('brand'),
    specialty: array('specialty'),
    minRating: Number(text('minRating') ?? 0),
    sortBy: text('sortBy'),
    page: Number(text('page') ?? 1),
  };
}
