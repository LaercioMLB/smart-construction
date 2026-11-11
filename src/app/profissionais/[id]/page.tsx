import { notFound } from 'next/navigation';
import { cache } from 'react';
import { publishedProfessionals } from '@/infrastructure/public-server';
import { Container, Breadcrumb } from '@/shared/components/ui';
import { PublishedProfessionalDetail } from '@/features/professionals/published-detail';

export const dynamic = 'force-dynamic';
const getProfessional = cache((id: string) => publishedProfessionals().get(id));
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const person = await getProfessional((await params).id);
  return {
    title: person
      ? `${person.name} — ${person.professions.find((item) => item.primary)?.name ?? 'Profissional'}`
      : 'Profissional',
    description: person?.bio,
  };
}
export default async function ProfessionalDetail({ params }: { params: Promise<{ id: string }> }) {
  const person = await getProfessional((await params).id);
  if (!person) notFound();
  return (
    <div className="bg-gray-50/40 pt-8 pb-20">
      <Container>
        <Breadcrumb
          items={[{ label: 'Profissionais', href: '/profissionais' }, { label: person.name }]}
        />
        <PublishedProfessionalDetail professional={person} />
      </Container>
    </div>
  );
}
