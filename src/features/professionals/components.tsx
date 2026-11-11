import Link from 'next/link';
import type { Professional } from '@/shared/types/profissional';
import { Gallery } from '@/shared/components/gallery';
import { Stars, Verified } from '@/shared/components/ui';
import { Hammer, Smile } from 'lucide-react';
export function ProfessionalCard({ professional: p }: { professional: Professional }) {
  return (
    <div className="relative min-h-[250px] rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md">
      {p.isTopRated && (
        <span className="absolute -top-3 left-6 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold text-white">
          Mais bem avaliado
        </span>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between">
          <div className="mb-4 flex items-center gap-4">
            <div className="w-20 shrink-0 overflow-hidden rounded-full border-3 border-accent-500 p-1">
              <Gallery
                images={[p.avatarUrl]}
                title={p.name}
                thumbnailClass="aspect-square w-full rounded-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-700">{p.name}</h2>
              <p className="mb-1 text-xs text-gray-500">{p.yearsExperience} anos de experiência</p>
              <div className="text-sm">
                <Stars rating={p.rating} /> <strong>{p.rating.toFixed(1)}</strong>{' '}
                <span className="text-xs text-gray-500">({p.reviewCount})</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Hammer className="text-accent-500" size={18} />
              {p.jobsCompleted} obras realizadas
            </p>
            <p className="flex items-center gap-2">
              <Smile className="text-accent-500" size={18} />
              {p.satisfactionRate}% de satisfação
            </p>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <p className="mb-2 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
            Verificações
          </p>
          <ul className="mb-4 space-y-2 text-sm font-medium text-brand-700">
            {p.verifications.map((item) => (
              <li key={item.text}>
                <Verified>{item.text}</Verified>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
            Especialidades
          </p>
          <div className="flex flex-wrap gap-2">
            {p.specialties.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-gray-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <Gallery
            images={p.portfolioUrls}
            title={`Trabalhos de ${p.name}`}
            thumbnailClass="aspect-square h-auto w-full rounded-lg object-cover"
          />
          <Link href={'/profissionais/' + p.id} className="btn mt-auto w-full">
            Ver Perfil Completo →
          </Link>
        </div>
      </div>
    </div>
  );
}
