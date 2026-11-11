import { notFound } from 'next/navigation';
import { serviceRepository, projectRepository } from '@/infrastructure/repositories';
import { ServiceHero, Overview, PartnerShowcase } from '@/features/services/detail-sections';
import { Process, Reasons, ServiceCard } from '@/features/services/components';
import { ProfessionalsSection, TestimonialsSection } from '@/features/home/sections';
import { HomeProjects } from '@/features/home/home-projects';
import { Faq } from '@/features/services/faq';
import { Container, Heading, FinalCta } from '@/shared/components/ui';
import { serviceCoverPath } from '@/shared/assets';
export async function generateStaticParams() {
  const { data } = await serviceRepository.list({ limit: 500 });
  return data.map((row) => ({ slug: row.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await serviceRepository.content(slug);
  return { title: content?.meta.title, description: content?.meta.description };
}
export default async function ServiceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [service, content, projects] = await Promise.all([
    serviceRepository.get(slug),
    serviceRepository.content(slug),
    projectRepository.list({ limit: 50 }),
  ]);
  if (!service || !content) notFound();
  const s = content.sections;
  const related = s.related
    ? await Promise.all(s.related.services.map((id) => serviceRepository.get(id)))
    : [];
  return (
    <>
      <ServiceHero section={s.hero} label={service.name} image={serviceCoverPath(service.slug)} />
      {s.overview && <Overview section={s.overview} />}
      {s.partner && <PartnerShowcase section={s.partner} />}
      <Process section={s.process} />
      {s.professionals && <ProfessionalsSection section={s.professionals} />}
      {s.testimonials && <TestimonialsSection section={s.testimonials} />}
      {s.workGallery && (
        <section className="py-16">
          <Container>
            <HomeProjects projects={projects.data} section={s.workGallery} />
          </Container>
        </section>
      )}
      {s.whyChooseUs && <Reasons section={s.whyChooseUs} />}
      {s.faq && <Faq section={s.faq} />}
      {s.related && (
        <section className="py-16">
          <Container>
            <Heading
              title={s.related.title ?? 'Serviços relacionados'}
              description={s.related.description}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((row) => row && <ServiceCard key={row.slug} service={row} />)}
            </div>
          </Container>
        </section>
      )}
      <FinalCta {...s.finalCta} />
    </>
  );
}
