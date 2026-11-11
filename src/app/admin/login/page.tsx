import type { Metadata } from 'next';
import { AdminLoginForm } from '@/features/admin/login-form';

export const metadata: Metadata = {
  title: 'Entrar na administração',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <section className="bg-gray-50 px-4 py-14">
      <AdminLoginForm />
    </section>
  );
}
