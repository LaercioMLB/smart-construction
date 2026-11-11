import { editorialRepository } from './repository';
import { Breadcrumb } from '@/shared/components/ui';
import type { LegalSlug } from './contracts';
export async function LegalPage({ slug, title }: { slug: LegalSlug; title: string }) {
  const content = await editorialRepository.legal(slug);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-20">
      <Breadcrumb items={[{ label: title }]} />
      <header className="mb-10">
        <h1 className="text-3xl leading-[1.1] font-extrabold tracking-tight text-brand-500 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-slate-500">
          Última atualização:{' '}
          <time dateTime={content.updatedAt}>
            {new Intl.DateTimeFormat('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(content.updatedAt + 'T00:00:00Z'))}
          </time>
          {' · '}Versão {content.version}
        </p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label={'Sumário — ' + title} className="rounded-2xl border border-gray-100 p-5">
            <h2 className="mb-4 text-sm font-bold tracking-[.12em] text-brand-500 uppercase">
              Nesta página
            </h2>
            <ul>
              {content.toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={'#' + item.id}
                    className="block py-1 text-sm text-slate-600 hover:text-accent-600"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <article
          className="legal-copy flex max-w-2xl flex-col gap-10"
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      </div>
    </div>
  );
}
