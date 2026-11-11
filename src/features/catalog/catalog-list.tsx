'use client';
import { productRepository } from '@/infrastructure/repositories';
import type { PageResult } from '@/shared/contracts';
import type { Product } from '@/shared/types/product';
import { useQuery } from '@/shared/hooks/use-query';
import { useList } from '@/shared/hooks/use-list';
import {
  SearchField,
  CheckFilters,
  Pagination,
  EmptyState,
  ListError,
} from '@/shared/components/list-controls';
import { ProductCard } from './components';
export function CatalogList({ initial }: { initial: PageResult<Product> }) {
  const { params, set, toggle, clear } = useQuery();
  const requestedSort = params.get('sortBy');
  const query = {
    search: params.get('search') ?? '',
    category: params.getAll('category'),
    brand: params.getAll('brand'),
    sortBy: requestedSort === 'rating' ? 'relevance' : (requestedSort ?? 'relevance'),
    page: Number(params.get('page') ?? 1),
    limit: 9,
  };
  const { data, meta, loading, error, retry } = useList(productRepository, query, initial);
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <SearchField
          value={query.search}
          onChange={(search) => set({ search })}
          placeholder="Procure por nome, marca, categoria..."
        />
        <select
          aria-label="Ordenar por"
          className="field sm:max-w-52"
          value={query.sortBy}
          onChange={(event) => set({ sortBy: event.target.value })}
        >
          <option value="relevance">Relevância</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
        </select>
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="space-y-8 pr-2 lg:col-span-3">
          {(query.search || query.category.length > 0 || query.brand.length > 0) && (
            <button onClick={clear} className="font-semibold text-accent-600">
              Limpar Todos os Filtros
            </button>
          )}
          <CheckFilters
            title="Categoria"
            items={meta.facets.categories ?? []}
            selected={query.category}
            onChange={(value) => toggle('category', value)}
          />
          {Boolean(meta.facets.brands?.length) && (
            <CheckFilters
              title="Marcas"
              items={meta.facets.brands}
              selected={query.brand}
              onChange={(value) => toggle('brand', value)}
            />
          )}
        </aside>
        <div className="lg:col-span-9" aria-busy={loading}>
          <p role="status" className="mb-8 text-sm text-gray-500">
            {loading ? 'Carregando materiais…' : `${meta.total} produtos encontrados`}
          </p>
          {error ? (
            <ListError message={error} retry={retry} />
          ) : !data.length ? (
            <EmptyState reset={clear} />
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              {data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onChange={(page) => set({ page: String(page) }, false)}
          />
        </div>
      </div>
    </>
  );
}
