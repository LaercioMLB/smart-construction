import type { Metadata } from 'next';
import { AdminNavigation } from '@/features/admin/admin-navigation';
import { RegistrationsPanel } from '@/features/admin/registrations-panel';

export const metadata: Metadata = {
  title: 'Analisar cadastros',
  robots: { index: false, follow: false },
};

export default function RegistrationsPage() {
  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />
        <RegistrationsPanel />
      </div>
    </section>
  );
}
