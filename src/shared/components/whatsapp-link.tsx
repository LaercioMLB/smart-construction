import Link from 'next/link';
import type { ReactNode } from 'react';

// Preserva a interface dos CTAs herdados; atendimento exclusivamente simulado.
export function WhatsAppLink({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href="/contato" className={className}>
      {children}
    </Link>
  );
}
