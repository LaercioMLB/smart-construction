'use client';
import { postRepository } from '@/infrastructure/repositories';
import type { PageResult } from '@/shared/contracts';
import type { BlogPost } from '@/shared/types/Blog';
import { useQuery } from '@/shared/hooks/use-query';
import { useList } from '@/shared/hooks/use-list';
import { SearchField, Pagination, EmptyState, ListError } from '@/shared/components/list-controls';
import { BlogCard } from './components';
import { HelpCard } from '@/shared/components/ui';
export function BlogList({ initial }: { initial: PageResult<BlogPost> }) {
  const { params, set, clear } = useQuery();
  const category = params.get('categoria') ?? 'todos';
  const query = {
    search: params.get('busca') ?? '',
    category: category === 'todos' ? [] : [category],
    page: Number(params.get('page') ?? 1),
    limit: 6,
  };
  const { data, meta, loading, error, retry } = useList(postRepository, query, initial);
  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="md:max-w-[60%]">
          <h1 className="title-section">Guias e Dicas Práticas Para Sua Obra</h1>
          <p className="text-lg text-slate-500">
            Acompanhe conteúdos sobre construção, reforma, acabamento, planejamento, materiais e
            manutenção.
          </p>
        </div>
        <div className="w-full md:max-w-md">
          <SearchField
            placeholder="Buscar artigos..."
            value={query.search}
            onChange={(busca) => set({ busca })}
          />
        </div>
      </div>
      <div className="mb-8 flex gap-3 overflow-x-auto py-2">
        {[
          ['todos', 'Todos'],
          ['construcao', 'Construção'],
          ['reformas', 'Reformas'],
          ['acabamento', 'Acabamento'],
          ['materiais', 'Materiais'],
          ['planejamento', 'Planejamento'],
        ].map(([slug, name]) => (
          <button
            key={slug}
            className="pill"
            aria-pressed={category === slug}
            onClick={() => set({ categoria: slug === 'todos' ? undefined : slug })}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8" aria-busy={loading}>
          {loading && <p role="status">Carregando artigos…</p>}
          {error ? (
            <ListError message={error} retry={retry} />
          ) : !data.length ? (
            <EmptyState reset={clear} />
          ) : (
            <div className="grid gap-8 md:grid-cols-2">
              {data.map((post) => (
                <BlogCard post={post} key={post.slug} />
              ))}
            </div>
          )}
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onChange={(page) => set({ page: String(page) }, false)}
          />
        </div>
        <aside className="lg:col-span-4">
          <HelpCard />
        </aside>
      </div>
    </>
  );
}
