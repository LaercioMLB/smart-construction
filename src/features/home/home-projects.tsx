'use client';
import { useState } from 'react';
import type { ProjectDetail } from '@/shared/types/portfolio';
import type { WorkGallerySection } from '@/shared/types/sections';
import type { HomePublishedValues } from '@/shared/types/home';
import { Carousel } from '@/shared/components/carousel';
import { ProjectCard } from '@/features/portfolio/components';
import { ButtonLink } from '@/shared/components/ui';
export function HomeProjects({
  projects,
  section,
  highlights,
}: {
  projects: ProjectDetail[];
  section?: WorkGallerySection;
  highlights?: HomePublishedValues['portfolio'];
}) {
  const [category, setCategory] = useState('todos');
  const filtered = projects.filter(
    (project) => category === 'todos' || project.category === category,
  );
  const filters = section?.filters ?? [
    { slug: 'todos', label: 'Todos os Projetos' },
    { slug: 'construcoes', label: 'Construções' },
    { slug: 'reformas', label: 'Reformas' },
    { slug: 'acabamentos', label: 'Acabamentos' },
  ];
  const split = Math.ceil(filtered.length / 2);
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-4">
        <h2 className="mb-6 text-4xl leading-tight font-bold tracking-tight text-brand-500 lg:text-5xl">
          {section?.title ?? 'Confira Nossos Trabalhos'}
        </h2>
        <p className="mb-8 text-lg leading-relaxed text-gray-600">
          {section?.description ??
            'Centenas de projetos transformados em Foz do Iguaçu. Qualidade, dedicação e resultado que fala por si.'}
        </p>
        <div className="mb-8 space-y-3">
          {filters.map(({ slug, label }) => (
            <button
              key={slug}
              aria-pressed={category === slug}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-6 py-4 text-sm font-bold ${category === slug ? 'border-accent-500 bg-accent-500 text-white' : 'border-gray-100 bg-white text-gray-600'}`}
              onClick={() => setCategory(slug)}
            >
              {label}
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-accent-600">
                {slug === 'todos'
                  ? projects.length
                  : projects.filter((p) => p.category === slug).length}
              </span>
            </button>
          ))}
        </div>
        {highlights && (
          <div className="mb-8 space-y-3 text-sm font-semibold text-brand-500">
            <p>{highlights.ratingLabel}</p>
            <p>{highlights.projectsLabel}</p>
          </div>
        )}
        <ButtonLink href="/portfolio" outline className="w-full">
          Ver nosso Portfólio →
        </ButtonLink>
      </div>
      <div className="min-w-0 space-y-5 lg:col-span-8">
        {filtered.length ? (
          [filtered.slice(0, split), filtered.slice(split)].map((row, index) => (
            <Carousel
              key={`${category}-${index}`}
              label={`Projetos — linha ${index + 1}`}
              delay={index === 0 ? 4400 : 3500}
              className="[&>*]:basis-3/5 sm:[&>*]:basis-[calc((100%-2.5rem)/3)]"
            >
              {row.map((project) => (
                <ProjectCard project={project} key={project.id} />
              ))}
            </Carousel>
          ))
        ) : (
          <p className="py-12 text-center text-gray-500">
            Nenhum projeto encontrado nesta categoria.
          </p>
        )}
      </div>
    </div>
  );
}
