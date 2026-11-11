import { ArrowRight, CheckCircle } from 'lucide-react';
import { contentRepository } from '@/infrastructure/repositories';
import { publishedProfessionals } from '@/infrastructure/public-server';
import type { BaseSection } from '@/shared/types/sections';
import type { HomePublishedValues } from '@/shared/types/home';
import { PublishedProfessionalCard } from '@/features/professionals/published-card';
import { Container, Heading, ButtonLink, Stars } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
import { Carousel } from '@/shared/components/carousel';
export async function ProfessionalsSection({
  section,
  publishedValues,
}: {
  section?: BaseSection;
  publishedValues?: HomePublishedValues['professionalSection'];
}) {
  const result = await publishedProfessionals()
    .list({ limit: 2 })
    .catch(() => null);
  if (!result) return null;
  const { data, meta } = result;
  if (!data.length) return null;
  return (
    <section className="py-16">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="title-section">
              {section?.title ?? 'Nossos Profissionais Especializados'}
            </h2>
            <p className="mb-8 leading-relaxed text-gray-600">
              {section?.description ??
                publishedValues?.description ??
                'Conheça os profissionais da nossa rede para a sua obra.'}
            </p>
            <div className="panel mb-8 space-y-4 text-sm font-medium text-brand-700">
              <p className="flex items-center gap-3">
                <CheckCircle className="text-accent-500" size={22} />
                {publishedValues?.availability ?? `${meta.total} profissionais disponíveis`}
              </p>
            </div>
            <ButtonLink href="/profissionais" outline className="w-full">
              Explorar todos os profissionais <ArrowRight size={18} />
            </ButtonLink>
          </div>
          <div className="space-y-6 lg:col-span-8">
            {data.map((p) => (
              <PublishedProfessionalCard key={p.id} professional={p} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
export async function PartnersSection() {
  const partners = await contentRepository.partners();
  return (
    <section className="overflow-hidden py-16 md:py-24">
      <Container>
        <Heading
          kicker="PARCEIROS CONFIÁVEIS"
          title="Temos os Melhores Materiais"
          description="Trabalhamos com as principais marcas do mercado. Materiais direto da fábrica, preço justo e qualidade garantida para sua obra."
        />
        <div className="mb-10 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          {['Materiais premium', 'Entrega rastreável', 'Preço de fábrica'].map((text) => (
            <span key={text} className="flex items-center gap-2">
              <CheckCircle size={16} className="text-accent-500" />
              {text}
            </span>
          ))}
        </div>
        <div className="text-center">
          <ButtonLink href="/catalogo">
            Explorar Catálogo Completo <ArrowRight size={18} />
          </ButtonLink>
        </div>
        <Carousel
          label="Marcas parceiras"
          className="mt-16 [&>*]:basis-1/2 md:[&>*]:basis-1/3 lg:[&>*]:basis-[calc((100%-5rem)/5)]"
        >
          {partners.map((partner) => (
            <div
              key={partner.slug}
              className="flex h-32 w-[200px] shrink-0 items-center justify-center rounded-2xl border border-gray-50 bg-white p-6 shadow-sm"
            >
              <Photo
                src={partner.logo}
                alt={partner.name}
                className="max-h-full w-auto max-w-full object-contain"
                width={180}
                height={120}
              />
            </div>
          ))}
        </Carousel>
      </Container>
    </section>
  );
}
export async function TestimonialsSection({ section }: { section?: BaseSection }) {
  const reviews = await contentRepository.reviews('1');
  if (!reviews.length) return null;
  return (
    <section className="overflow-hidden bg-section-bg-1 py-16 md:py-10">
      <Container>
        <Heading
          kicker="RESULTADOS QUE FALAM POR SI"
          title={section?.title ?? 'Clientes do cenário fictício'}
        />
        <Carousel
          label="Depoimentos de clientes"
          className="[&>*]:basis-2/3 md:[&>*]:basis-[calc((100%-2.5rem)/3)]"
        >
          {[...reviews, reviews[0]].map((review, index) => (
            <div className="panel flex min-h-64 flex-col items-center p-8 text-center" key={index}>
              <Stars rating={review.rating} />
              <p className="my-5 grow text-sm leading-relaxed text-gray-600">{review.text}</p>
              <strong className="text-sm text-brand-500">{review.name}</strong>
            </div>
          ))}
        </Carousel>
      </Container>
    </section>
  );
}
