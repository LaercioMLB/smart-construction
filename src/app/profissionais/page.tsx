import { Suspense } from 'react';
import { publishedProfessionals } from '@/infrastructure/public-server';
import { PublishedProfessionalList } from '@/features/professionals/published-list';
import { Container, Breadcrumb } from '@/shared/components/ui';
import { listQuery, type SearchParams } from '@/shared/query';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';
export const metadata = { title: 'Profissionais de Construção e Reforma em Foz do Iguaçu' };
export const dynamic = 'force-dynamic';
export default async function Professionals({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initial = await publishedProfessionals().list({
    ...listQuery(params),
    city: typeof params.city === 'string' ? params.city : '',
    uf: typeof params.uf === 'string' ? params.uf : '',
    limit: 9,
  });
  return (
    <div className="bg-[#f8f9fa] pt-8 pb-20">
      <Container>
        <Breadcrumb items={[{ label: 'Profissionais' }]} />
        <h1 className="title-section">Nossos Profissionais Especializados</h1>
        <p className="mb-10 text-lg leading-relaxed text-slate-500">
          Conte com a Smart Construction para encontrar o profissional adequado para a sua obra.
        </p>
        {initial.data.length || params.search || params.specialty || params.city || params.uf ? (
          <Suspense>
            <PublishedProfessionalList initial={initial} />
          </Suspense>
        ) : (
          <section className="panel space-y-5">
            <h2 className="text-xl font-bold text-brand-500">
              Encontre o profissional para sua obra
            </h2>
            <p className="text-gray-600">
              Os perfis da nossa rede serão disponibilizados em breve. Enquanto isso, fale com a
              nossa equipe para receber atendimento e solicitar um orçamento.
            </p>
            <WhatsAppLink className="btn">Falar com a Smart Construction</WhatsAppLink>
          </section>
        )}
      </Container>
    </div>
  );
}
