import type { Professional } from '@/shared/types/profissional';
import { Gallery } from '@/shared/components/gallery';
import { Stars, Verified } from '@/shared/components/ui';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';
import { MapPin, Clock, CalendarCheck } from 'lucide-react';
export function ProfessionalSidebar({ professional: p }: { professional: Professional }) {
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
      <div className="panel">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="size-28 overflow-hidden rounded-full border-4 border-accent-500">
              <Gallery
                images={[p.avatarUrl]}
                title={p.name}
                thumbnailClass="aspect-square w-full rounded-full object-cover"
              />
            </div>
            {p.isTopRated && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-accent-500 px-3 py-0.5 text-[10px] font-bold whitespace-nowrap text-white">
                MAIS BEM AVALIADO
              </span>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold text-brand-500">{p.name}</h1>
          <p className="mb-2 text-sm text-slate-500">{p.title}</p>
          <p className="text-sm">
            <Stars rating={p.rating} />{' '}
            <strong className="text-brand-500">{p.rating.toFixed(1)}</strong>{' '}
            <span className="text-xs text-gray-400">({p.reviewCount} avaliações)</span>
          </p>
        </div>
        <ul className="mb-5 space-y-2 text-sm font-medium text-brand-500">
          {p.verifications.map((item) => (
            <li key={item.text}>
              <Verified>{item.text}</Verified>
            </li>
          ))}
        </ul>
        <div className="mb-5 space-y-2 border-t border-gray-100 pt-4 text-sm text-slate-500">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="shrink-0 text-accent-400" />
            {p.locationText}
          </p>
          <p className="flex items-center gap-2">
            <Clock size={16} className="shrink-0 text-accent-400" />
            {p.responseTimeText}
          </p>
          <p className="flex items-center gap-2">
            <CalendarCheck size={16} className="shrink-0 text-accent-400" />
            {p.availabilityText}
          </p>
        </div>
        <WhatsAppLink className="btn mb-3 w-full">Solicitar Orçamento</WhatsAppLink>
      </div>
    </aside>
  );
}
