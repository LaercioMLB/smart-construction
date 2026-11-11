'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Category, Service, ServiceType } from '@/shared/types/service';
import type { PageResult } from '@/shared/contracts';
import { serviceRepository } from '@/infrastructure/repositories';
import { useList } from '@/shared/hooks/use-list';
import { Container, Breadcrumb, FinalCta } from '@/shared/components/ui';
import { ListError } from '@/shared/components/list-controls';
import { ServiceSearch } from './service-search';
import { ServiceCard } from './components';
const tracks = [
  {
    type: 'execucao',
    label: 'Mão de Obra',
    href: '/servicos',
    title: 'Mão de Obra',
    subtitle: 'Encontre o profissional certo para cada etapa da sua obra.',
  },
  {
    type: 'locacao',
    label: 'Locação',
    href: '/servicos/locacao',
    title: 'Serviços de Locação',
    subtitle: 'O equipamento certo, pelo tempo certo da sua obra.',
  },
  {
    type: 'material',
    label: 'Materiais',
    href: '/servicos/materiais',
    title: 'Materiais',
    subtitle: 'Materiais direto da fábrica para a sua obra.',
  },
  {
    type: 'projeto',
    label: 'Projetos',
    href: '/servicos/projetos',
    title: 'Projetos',
    subtitle: 'Do projeto técnico à aprovação, com quem entende.',
  },
];
export function ServiceHub({
  type,
  initial,
  categories,
  counts,
}: {
  type: ServiceType;
  initial: PageResult<Service>;
  categories: Category[];
  counts: Record<string, number>;
}) {
  const [category, setCategory] = useState('todos');
  const [limit, setLimit] = useState(9);
  const trigger = useRef<HTMLDivElement>(null);
  const query = { type, category: category === 'todos' ? [] : [category], limit };
  const { data, meta, loading, error, retry } = useList(serviceRepository, query, initial);
  const track = tracks.find((item) => item.type === type)!;
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && limit < meta.total) setLimit((n) => n + 9);
      },
      { rootMargin: '150px' },
    );
    const element = trigger.current;
    if (element) observer.observe(element);
    return () => observer.disconnect();
  }, [loading, limit, meta.total]);
  return (
    <>
      <section className="bg-brand-500 pt-8 pb-16 text-center sm:pb-24">
        <Container>
          <div className="text-left [&_nav]:text-brand-100/60">
            <Breadcrumb
              items={
                type === 'execucao'
                  ? [{ label: 'Serviços' }]
                  : [{ label: 'Serviços', href: '/servicos' }, { label: track.label }]
              }
            />
          </div>
          <h1 className="mb-6 text-3xl font-extrabold text-white sm:text-6xl">
            O que a sua casa
            <br />
            <span className="mt-2 inline-block whitespace-nowrap text-accent-500">
              está precisando hoje?
            </span>
          </h1>
          <p className="mb-8 text-sm text-brand-100/80 sm:mb-10 sm:text-xl">
            Conte do seu jeito que a gente encontra quem faz
          </p>
          <div className="mx-auto max-w-4xl">
            <ServiceSearch quick all={false} />
          </div>
        </Container>
      </section>
      <div className="border-b border-gray-200">
        <Container>
          <nav className="flex gap-6 overflow-x-auto pt-4" aria-label="Trilhos de serviço">
            {tracks
              .filter((item) => counts[item.type] > 0)
              .map((item) => (
                <Link
                  key={item.type}
                  href={item.href}
                  aria-current={item.type === type ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-3 text-sm ${item.type === type ? 'border-accent-500 font-semibold text-brand-950' : 'border-transparent text-gray-500'}`}
                >
                  {item.label}
                  <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs text-accent-600">
                    {counts[item.type]}
                  </span>
                </Link>
              ))}
          </nav>
        </Container>
      </div>
      <Container>
        <div className="min-h-96 py-10">
          <h2 className="title-section max-sm:text-2xl">{track.title}</h2>
          <p className="mb-6 text-lg text-gray-600">{track.subtitle}</p>
          {type === 'execucao' && (
            <div className="mb-6 flex gap-3 overflow-x-auto py-2">
              {[{ name: 'Todos', slug: 'todos' }, ...categories].map((item) => (
                <button
                  key={item.slug}
                  className="pill"
                  aria-pressed={category === item.slug}
                  onClick={() => {
                    setCategory(item.slug);
                    setLimit(9);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          {error ? (
            <ListError message={error} retry={retry} />
          ) : data.length ? (
            <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy={loading}>
              {data.map((service) => (
                <ServiceCard key={service.slug} service={service} />
              ))}
            </div>
          ) : (
            <p className="py-20 text-center text-gray-500">Ainda não há serviços neste trilho.</p>
          )}
          <div ref={trigger} className="py-4">
            {loading && (
              <p role="status" className="text-center text-gray-500">
                Carregando serviços…
              </p>
            )}
            {limit < meta.total && (
              <button
                className="btn btn-outline mx-auto flex"
                onClick={() => setLimit((n) => n + 9)}
              >
                Carregar mais serviços
              </button>
            )}
          </div>
        </div>
      </Container>
      <FinalCta
        title="Não Encontrou o Serviço que Procura?"
        description="Temos ainda mais soluções customizadas! Entre em contato para conhecer todas as nossas opções disponíveis."
      />
    </>
  );
}
