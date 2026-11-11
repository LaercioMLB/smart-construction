import Link from 'next/link';
import { UserRound, MapPin } from 'lucide-react';
import { Gallery } from '@/shared/components/gallery';
import type { PublishedProfessional } from './contracts';

export function PublishedAvatar({ professional: person }: { professional: PublishedProfessional }) {
  return (
    <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-accent-500 bg-gray-50">
      {person.avatar ? (
        <div className="w-full">
          <Gallery
            images={[person.avatar]}
            title={person.name}
            thumbnailClass="aspect-square w-full rounded-full object-cover"
          />
        </div>
      ) : (
        <UserRound size={40} className="text-brand-500" aria-label="Perfil sem foto" />
      )}
    </div>
  );
}
export function PublishedProfessionalCard({
  professional: person,
}: {
  professional: PublishedProfessional;
}) {
  return (
    <article className="panel grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
      <PublishedAvatar professional={person} />
      <div className="min-w-0 space-y-3">
        <h2 className="break-words text-xl font-bold text-brand-700">{person.name}</h2>
        <p className="font-medium text-gray-600">
          {person.professions.find((item) => item.primary)?.name}
        </p>
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin size={16} />
          {person.city} / {person.uf}
        </p>
        <p className="break-words text-sm leading-relaxed text-gray-600">{person.bio}</p>
        <div className="flex flex-wrap gap-2">
          {person.professions.map((item) => (
            <span
              key={item.id}
              className="rounded-lg border border-accent-100 bg-accent-50 px-3 py-1 text-xs text-accent-700"
            >
              {item.name}
            </span>
          ))}
        </div>
        <Link className="btn" href={`/profissionais/${person.id}`} prefetch={false}>
          Ver Perfil Completo →
        </Link>
      </div>
    </article>
  );
}
