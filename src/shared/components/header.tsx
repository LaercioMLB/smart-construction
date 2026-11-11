'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { WhatsAppLink } from './whatsapp-link';
export const navigation = [
  ['Sobre Nós', '/sobre'],
  ['Serviços', '/servicos'],
  ['Profissionais', '/profissionais'],
  ['Portfólio', '/portfolio'],
  ['Catálogo', '/catalogo'],
  ['Blog', '/blog'],
] as const;
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Smart Construction — início"
          className="shrink-0"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/logo.svg"
            alt="Smart Construction"
            width={160}
            height={50}
            className="h-auto w-24 min-[375px]:w-32 xl:w-40"
            preload
          />
        </Link>
        <nav className="hidden items-center gap-4 xl:flex" aria-label="Navegação principal">
          {navigation.map(([label, href]) => (
            <Link
              href={href}
              key={href}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
              className="nav-link"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/admin/login"
            className="admin-link"
            aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Painel de admin
          </Link>
          <div className="hidden items-center gap-3 xl:flex">
            <Link href="/faca-parte" className="btn btn-outline compact whitespace-nowrap">
              Faça Parte
            </Link>
            <WhatsAppLink className="btn compact whitespace-nowrap">
              Solicitar Orçamento
            </WhatsAppLink>
          </div>
          <button
            className="p-2 text-brand-500 xl:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Navegação móvel"
          className="border-t border-gray-100 bg-white p-5 xl:hidden"
        >
          {navigation.map(([label, href]) => (
            <Link
              href={href}
              key={href}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className="block py-3 text-center font-medium text-brand-500"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/faca-parte"
            onClick={() => setOpen(false)}
            className="btn btn-outline my-3 w-full"
          >
            Faça Parte
          </Link>
          <WhatsAppLink className="btn w-full">Solicitar Orçamento</WhatsAppLink>
        </nav>
      )}
    </header>
  );
}
