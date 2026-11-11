import Link from 'next/link';

export function AdminNavigation() {
  return (
    <nav
      aria-label="Administração"
      className="mb-6 flex flex-wrap gap-4 text-sm font-semibold text-brand-500"
    >
      <Link href="/admin/cadastros">Cadastros</Link>
      <Link href="/admin/profissoes">Profissões</Link>
    </nav>
  );
}
