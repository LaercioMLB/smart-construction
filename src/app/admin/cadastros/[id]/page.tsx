import type { Metadata } from 'next';
import { AdminNavigation } from '@/features/admin/admin-navigation';
import { RegistrationDetail } from '@/features/admin/registration-detail';

export const metadata: Metadata = {
  title: 'Detalhe do cadastro',
  robots: { index: false, follow: false },
};

export default async function RegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />
        <RegistrationDetail id={id} />
      </div>
    </section>
  );
}
