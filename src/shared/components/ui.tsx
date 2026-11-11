import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { WhatsAppLink } from './whatsapp-link';

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span aria-hidden="true">›</span>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function ButtonLink({
  href,
  children,
  outline = false,
  className = '',
}: {
  href: string;
  children: ReactNode;
  outline?: boolean;
  className?: string;
}) {
  return (
    <Link className={`btn ${outline ? 'btn-outline' : ''} ${className}`} href={href}>
      {children}
    </Link>
  );
}
export function Heading({
  title,
  description,
  kicker,
  centered = true,
}: {
  title?: string;
  description?: string;
  kicker?: string;
  centered?: boolean;
}) {
  return (
    <div className={`mb-10 ${centered ? 'mx-auto text-center' : ''}`}>
      {kicker && <p className="kicker">{kicker}</p>}
      {title && <h2 className="title-section">{title}</h2>}
      {description && (
        <p className={`subtitle-section leading-relaxed ${centered ? 'mx-auto max-w-2xl' : ''}`}>
          {description}
        </p>
      )}
    </div>
  );
}
export function FinalCta({
  title = 'Se ficar com alguma dúvida',
  description = 'Entre em contato com nossa equipe',
  ctaText = 'Fale com a Smart Construction (WhatsApp)',
}: {
  title?: string;
  description?: string;
  ctaText?: string;
}) {
  return (
    <section className="bg-brand-500 py-16 text-center text-white">
      <Container>
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>
        <p className="mx-auto mb-8 max-w-3xl text-lg text-white/80">{description}</p>
        <WhatsAppLink className="btn">
          {ctaText}
          <ArrowRight size={20} />
        </WhatsAppLink>
      </Container>
    </section>
  );
}
export function HelpCard({ title = 'Precisa de ajuda com seu projeto?' }: { title?: string }) {
  return (
    <div className="panel">
      <h2 className="mb-3 text-xl font-bold text-brand-500">{title}</h2>
      <p className="mb-6 text-gray-600 leading-relaxed">
        Nossa equipe pode orientar sua obra do planejamento ao acabamento final.
      </p>
      <WhatsAppLink className="btn w-full">Falar com especialista</WhatsAppLink>
    </div>
  );
}
export function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex gap-0.5 text-accent-500"
      aria-label={`${rating.toFixed(1)} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= Math.round(rating) ? '' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}
export function FeatureList({ features }: { features: { text: string }[] }) {
  return (
    <ul className="space-y-3">
      {features.map((item) => (
        <li className="flex items-center gap-3 text-gray-600" key={item.text}>
          <Check size={20} className="shrink-0 text-accent-500" />
          {item.text}
        </li>
      ))}
    </ul>
  );
}
export function Verified({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <ShieldCheck className="shrink-0 text-green-600" size={18} />
      {children}
    </span>
  );
}
