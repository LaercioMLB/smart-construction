'use client';
import { useState } from 'react';
import type { PageResult } from '@/shared/contracts';
import type { ProjectDetail } from '@/shared/types/portfolio';
import { projectRepository } from '@/infrastructure/repositories';
import { useList } from '@/shared/hooks/use-list';
import { Pagination, EmptyState, ListError } from '@/shared/components/list-controls';
import { ProjectCard } from './components';
import { HelpCard } from '@/shared/components/ui';
import type { HomePublishedValues } from '@/shared/types/home';
export function PortfolioList({
  initial,
  highlights,
}: {
  initial: PageResult<ProjectDetail>;
  highlights: HomePublishedValues['portfolio'];
}) {
  const [category, setCategory] = useState('todos');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, retry } = useList(
    projectRepository,
    { category: category === 'todos' ? [] : [category], page, limit: 6 },
    initial,
  );
  return (
    <>
      <div className="mb-8 flex gap-3 overflow-x-auto py-2">
        {[
          ['todos', 'Todos os Projetos'],
          ['construcoes', 'Construções'],
          ['reformas', 'Reformas'],
          ['piscinas', 'Piscinas'],
          ['acabamentos', 'Acabamentos'],
        ].map(([slug, name]) => (
          <button
            key={slug}
            className="pill"
            aria-pressed={category === slug}
            onClick={() => {
              setCategory(slug);
              setPage(1);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8" aria-busy={loading}>
          {error ? (
            <ListError message={error} retry={retry} />
          ) : !data.length ? (
            <EmptyState reset={() => setCategory('todos')} />
          ) : (
            <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-3">
              {data.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
        </div>
        <aside className="space-y-8 lg:col-span-4">
          <div className="panel space-y-3 text-sm font-bold text-brand-500">
            <p>★ {highlights.ratingLabel}</p>
            <p>✓ {highlights.projectsLabel}</p>
          </div>
          <HelpCard />
        </aside>
      </div>
    </>
  );
}
