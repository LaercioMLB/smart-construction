'use client';
import { professionalPageRepository as professionalRepository } from '@/infrastructure/repositories';
import type { PageResult } from '@/shared/contracts';
import type { Professional } from '@/shared/types/profissional';
import { useQuery } from '@/shared/hooks/use-query';
import { useList } from '@/shared/hooks/use-list';
import {
  SearchField,
  CheckFilters,
  Pagination,
  EmptyState,
  ListError,
} from '@/shared/components/list-controls';
import { ProfessionalCard } from './components';
export function ProfessionalList({ initial }: { initial: PageResult<Professional> }) {
  const { params, set, toggle, clear } = useQuery();
  const query = {
    search: params.get('search') ?? '',
    specialty: params.getAll('specialty'),
    minRating: Number(params.get('minRating') ?? 0),
    sortBy: params.get('sortBy') ?? 'relevance',
    page: Number(params.get('page') ?? 1),
    limit: 9,
  };
  const { data, meta, loading, error, retry } = useList(professionalRepository, query, initial);
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <SearchField
          value={query.search}
          onChange={(search) => set({ search })}
          placeholder="Buscar profissional ou serviço"
        />
        <select
          className="field sm:max-w-52"
          aria-label="Ordenar profissionais"
          value={query.sortBy}
          onChange={(event) => set({ sortBy: event.target.value })}
        >
          <option value="relevance">Relevância</option>
          <option value="rating">Maior avaliação</option>
          <option value="jobs">Mais obras realizadas</option>
          <option value="experience">Mais experientes</option>
        </select>
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="space-y-8 lg:col-span-3">
          {(query.search || query.specialty.length > 0 || query.minRating > 0) && (
            <button className="font-semibold text-accent-600" onClick={clear}>
              Limpar Todos os Filtros
            </button>
          )}
          <CheckFilters
            title="Especialidade"
            items={meta.facets.specialties.slice(0, 10)}
            selected={query.specialty}
            onChange={(value) => toggle('specialty', value)}
          />
          <fieldset className="space-y-3 border-t border-gray-100 pt-6">
            <legend className="text-lg font-bold text-brand-500">Avaliação Mínima</legend>
            {[
              [0, 'Qualquer'],
              [4, '4.0 ou mais'],
              [3, '3.0 ou mais'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={query.minRating === Number(value)}
                  onChange={() => set({ minRating: String(value) })}
                  className="accent-accent-500"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </aside>
        <div className="lg:col-span-9" aria-busy={loading}>
          <p role="status" className="mb-8 text-sm text-gray-500">
            {loading
              ? 'Carregando profissionais…'
              : `${meta.total} ${meta.total === 1 ? 'profissional encontrado' : 'profissionais encontrados'}`}
          </p>
          {error ? (
            <ListError message={error} retry={retry} />
          ) : !data.length ? (
            <EmptyState reset={clear} />
          ) : (
            <div className="space-y-6">
              {data.map((professional) => (
                <ProfessionalCard professional={professional} key={professional.id} />
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
