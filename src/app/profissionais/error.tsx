'use client';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';

export default function ProfessionalError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto my-12 max-w-3xl space-y-5 px-4">
      <h1 className="title-section">Profissionais</h1>
      <p role="alert">Não foi possível carregar os profissionais. Tente novamente.</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={reset}>
          Tentar novamente
        </button>
        <WhatsAppLink className="btn btn-outline">Falar com a Smart Construction</WhatsAppLink>
      </div>
    </section>
  );
}
