'use client';
import { publicProfessionalRepository } from '@/infrastructure/public';
import { useQuery } from '@/shared/hooks/use-query';
import { useList } from '@/shared/hooks/use-list';
import {
  SearchField,
  CheckFilters,
  Pagination,
  EmptyState,
  ListError,
} from '@/shared/components/list-controls';
import type { PublishedProfessionals } from './contracts';
import { PublishedProfessionalCard } from './published-card';

export function PublishedProfessionalList({ initial }: { initial: PublishedProfessionals }) {
  const { params, set, toggle, clear } = useQuery();
  const query = {
    search: params.get('search') ?? '',
    specialty: params.getAll('specialty'),
    city: params.get('city') ?? '',
    uf: params.get('uf') ?? '',
    sortBy: params.get('sortBy') === 'name' ? 'name' : 'relevance',
    page: Number(params.get('page') ?? 1),
    limit: 9,
  };
  const { data, meta, loading, error, retry } = useList(
    publicProfessionalRepository,
    query,
    initial,
  );
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
          <option value="name">Nome</option>
        </select>
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-3">
          <button className="font-semibold text-accent-600" onClick={clear}>
            Limpar Todos os Filtros
          </button>
          <CheckFilters
            title="Especialidade"
            items={meta.facets.specialties ?? []}
            selected={query.specialty}
            onChange={(value) => toggle('specialty', value)}
          />
          <label className="block text-sm text-gray-600">
            Cidade
            <input
              className="field mt-2"
              value={query.city}
              maxLength={120}
              onChange={(event) => set({ city: event.target.value })}
            />
          </label>
          <label className="block text-sm text-gray-600">
            UF
            <select
              className="field mt-2"
              value={query.uf}
              onChange={(event) => set({ uf: event.target.value })}
            >
              <option value="">Todas</option>
              {[
                'AC',
                'AL',
                'AP',
                'AM',
                'BA',
                'CE',
                'DF',
                'ES',
                'GO',
                'MA',
                'MT',
                'MS',
                'MG',
                'PA',
                'PB',
                'PR',
                'PE',
                'PI',
                'RJ',
                'RN',
                'RS',
                'RO',
                'RR',
                'SC',
                'SP',
                'SE',
                'TO',
              ].map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </label>
        </aside>
        <div className="lg:col-span-9" aria-busy={loading}>
          <p role="status" className="mb-6 text-sm text-gray-500">
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
              {data.map((person) => (
                <PublishedProfessionalCard key={person.id} professional={person} />
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
