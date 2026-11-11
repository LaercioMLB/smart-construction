import { Gallery } from '@/shared/components/gallery';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';
import type { PublishedProfessional } from './contracts';
import { PublishedAvatar } from './published-card';

export function PublishedProfessionalDetail({
  professional: person,
}: {
  professional: PublishedProfessional;
}) {
  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <aside className="panel w-full shrink-0 space-y-5 lg:sticky lg:top-24 lg:w-72">
        <PublishedAvatar professional={person} />
        <h1 className="break-words text-xl font-bold text-brand-500">{person.name}</h1>
        <p className="text-sm text-slate-500">
          {person.professions.find((item) => item.primary)?.name}
        </p>
        <p className="text-sm text-gray-600">
          {person.city} / {person.uf}
        </p>
        <WhatsAppLink className="btn w-full">Solicitar Orçamento</WhatsAppLink>
      </aside>
      <div className="min-w-0 w-full flex-1 space-y-6">
        <section className="panel">
          <h2 className="mb-5 text-lg font-bold text-brand-500">Sobre mim</h2>
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {person.bio}
          </p>
        </section>
        <section className="panel">
          <h2 className="mb-5 text-lg font-bold text-brand-500">Especialidades</h2>
          <div className="flex flex-wrap gap-2">
            {person.professions.map((item) => (
              <span
                key={item.id}
                className="rounded-xl border border-accent-100 bg-accent-50 px-4 py-2 text-sm text-accent-700"
              >
                {item.name}
              </span>
            ))}
          </div>
        </section>
        {person.courses.length > 0 && (
          <section className="panel">
            <h2 className="mb-5 text-lg font-bold text-brand-500">Cursos e Certificações</h2>
            <ul className="space-y-5">
              {person.courses.map((course, index) => (
                <li key={index} className="border-l border-accent-100 pl-5">
                  <p className="font-semibold text-brand-500">{course.name}</p>
                  {(course.institution || course.start || course.end) && (
                    <p className="mt-1 text-sm text-gray-500">
                      {[
                        course.institution,
                        course.start && course.end
                          ? `${course.start}–${course.end}`
                          : (course.end ?? course.start),
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {person.images.length > 0 && (
          <section className="panel">
            <h2 className="mb-5 text-lg font-bold text-brand-500">Galeria de trabalhos</h2>
            <Gallery
              images={person.images}
              title={`Trabalhos de ${person.name}`}
              expandable
              thumbnailClass="aspect-square h-auto w-full rounded-lg object-cover"
            />
          </section>
        )}
      </div>
    </div>
  );
}
