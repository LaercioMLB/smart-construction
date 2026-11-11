import { notFound } from 'next/navigation';
import { projectRepository } from '@/infrastructure/repositories';
import { Container, Breadcrumb, ButtonLink, HelpCard } from '@/shared/components/ui';
import { Gallery } from '@/shared/components/gallery';
import { Photo } from '@/shared/components/photo';
import { ProjectCard } from '@/features/portfolio/components';
export async function generateStaticParams() {
  const { data } = await projectRepository.list({ limit: 500 });
  return data.map((row) => ({ id: String(row.id) }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const row = await projectRepository.get((await params).id);
  return { title: row?.title, description: row?.description };
}
export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const project = await projectRepository.get((await params).id);
  if (!project) notFound();
  const related = await projectRepository.list({ exclude: String(project.id), limit: 3 });
  return (
    <div className="bg-gray-50/80 pt-8 pb-20">
      <Container>
        <Breadcrumb
          items={[
            { label: 'Portfolio', href: '/portfolio' },
            { label: project.title ?? 'Projeto' },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <div>
              <h1 className="title-section">{project.title}</h1>
              <p className="text-lg leading-relaxed text-slate-500">{project.description}</p>
            </div>
            <Gallery
              images={project.gallery}
              title={project.title}
              carousel
              thumbnailClass="aspect-square w-full rounded-lg object-cover"
            />
            {project.beforeImageUrl && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  [project.beforeImageUrl, 'ANTES'],
                  [project.imageUrl, 'DEPOIS'],
                ].map(([src, label]) => (
                  <div key={label} className="relative overflow-hidden rounded-2xl">
                    <Photo
                      src={src}
                      alt={`${project.title} ${label}`}
                      className="aspect-video w-full object-cover"
                    />
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <section>
              <h2 className="mb-4 text-xl font-bold text-brand-500">Serviços realizados</h2>
              <div className="flex flex-wrap gap-2">
                {project.services.map((service) => (
                  <span
                    className="rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-600"
                    key={service}
                  >
                    {service}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-6 text-xl font-bold text-brand-500">Outros projetos</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {related.data.map((row) => (
                  <ProjectCard key={row.id} project={row} />
                ))}
              </div>
            </section>
            <ButtonLink href="/portfolio" outline className="w-full">
              ← Ver todos os projetos
            </ButtonLink>
          </div>
          <aside className="space-y-6 lg:col-span-4">
            <div className="panel">
              <h2 className="mb-6 text-lg font-bold text-brand-500">Detalhes do projeto</h2>
              <dl className="space-y-4">
                {[
                  ['Localização', project.location],
                  ['Duração', project.duration],
                  ['Ano', String(project.year)],
                  ['Categoria', project.category],
                  ['Responsável', project.author ?? ''],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-sm">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="text-right font-semibold text-brand-500">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <HelpCard title="Quer um projeto assim?" />
          </aside>
        </div>
      </Container>
    </div>
  );
}
