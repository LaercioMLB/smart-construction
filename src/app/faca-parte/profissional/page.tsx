import { Container, Breadcrumb } from '@/shared/components/ui';
import { RegistrationContact } from '@/features/enrollment/registration-contact';
import { ApiEnrollmentForm } from '@/features/enrollment/api-form';
import { enrollmentConfiguration } from '@/infrastructure/public-server';
export const metadata = { title: 'Cadastro de profissional' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  const config = await enrollmentConfiguration();
  return (
    <Container className="max-w-4xl pt-8 pb-20">
      <Breadcrumb
        items={[
          { label: 'Faça parte', href: '/faca-parte' },
          { label: 'Cadastro de profissional' },
        ]}
      />
      <h1 className="title-section">Cadastro de profissional</h1>
      <p className="mb-8 text-lg text-gray-500">
        Entre para nossa rede de profissionais e receba obras para executar.
      </p>
      {config ? (
        <ApiEnrollmentForm kind="profissional" configuration={config} />
      ) : (
        <RegistrationContact />
      )}
    </Container>
  );
}
