import { Container, Breadcrumb } from '@/shared/components/ui';
import { RegistrationContact } from '@/features/enrollment/registration-contact';
import { ApiEnrollmentForm } from '@/features/enrollment/api-form';
import { enrollmentConfiguration } from '@/infrastructure/public-server';
export const metadata = { title: 'Cadastro de empresa' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  const config = await enrollmentConfiguration();
  return (
    <Container className="max-w-3xl pt-8 pb-20">
      <Breadcrumb
        items={[{ label: 'Faça parte', href: '/faca-parte' }, { label: 'Cadastro de empresa' }]}
      />
      <h1 className="title-section">Cadastro de empresa</h1>
      <p className="mb-8 text-lg text-gray-500">
        Fornecedores e parceiros: faça parte da rede Smart Construction.
      </p>
      {config ? (
        <ApiEnrollmentForm kind="empresa" configuration={config} />
      ) : (
        <RegistrationContact />
      )}
    </Container>
  );
}
