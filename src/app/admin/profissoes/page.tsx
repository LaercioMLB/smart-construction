import type { Metadata } from 'next';
import { ProfessionsPanel } from '@/features/admin/professions-panel';
import { AdminNavigation } from '@/features/admin/admin-navigation';

export const metadata: Metadata = {
  title: 'Administrar profissões',
  robots: { index: false, follow: false },
};

export default function AdminProfessionsPage() {
  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation />
        <ProfessionsPanel />
      </div>
    </section>
  );
}
