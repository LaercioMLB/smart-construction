import Link from 'next/link';
import { notFound } from 'next/navigation';
import { postRepository } from '@/infrastructure/repositories';
import { Container, Breadcrumb, HelpCard } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
export async function generateStaticParams() {
  const { data } = await postRepository.list({ limit: 500 });
  return data.map((row) => ({ slug: row.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = await postRepository.get((await params).slug);
  return { title: post?.title, description: post?.description };
}
export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const post = await postRepository.get((await params).slug);
  if (!post) notFound();
  const related = await postRepository.list({ exclude: post.slug, limit: 3 });
  return (
    <div className="bg-gray-50/30 pt-8 pb-20">
      <Container>
        <Breadcrumb items={[{ label: 'Blog', href: '/blog' }, { label: post.title }]} />
        <div className="grid gap-10 lg:grid-cols-12">
          <article className="min-w-0 lg:col-span-8">
            <header className="mb-10 space-y-5">
              <h1 className="title-section">{post.title}</h1>
              <p className="text-lg leading-relaxed text-slate-500">{post.description}</p>
              <p className="flex flex-wrap gap-5 text-sm text-slate-500">
                <span>{post.date}</span>
                <span>Leitura de {post.readingTime}</span>
                <span>{post.author}</span>
              </p>
            </header>
            <Photo
              src={post.coverImage}
              alt={post.title}
              className="mb-12 h-[400px] w-full rounded-2xl object-cover"
              priority
            />
            <div id="artigo" className="scroll-mt-24 space-y-12">
              {post.content.map((section, index) => (
                <section key={index} className="space-y-6">
                  {section.title && (
                    <h2 className="title-section text-3xl md:text-4xl">{section.title}</h2>
                  )}
                  {section.paragraphs.map((paragraph, n) => (
                    <p className="text-lg leading-relaxed text-slate-500" key={n}>
                      {paragraph}
                    </p>
                  ))}
                  {section.image && (
                    <Photo
                      src={section.image}
                      alt={section.title ?? 'Imagem do artigo'}
                      className="h-96 w-full rounded-2xl object-cover"
                    />
                  )}
                  {section.quote && (
                    <blockquote className="my-8 rounded-2xl border-l-4 border-accent-500 bg-brand-50 p-8 text-center text-xl leading-tight font-medium text-brand-500 italic">
                      {section.quote}
                    </blockquote>
                  )}
                  {section.paragraphsAfterQuote?.map((paragraph, n) => (
                    <p className="text-lg leading-relaxed text-slate-500" key={n}>
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
          <aside className="space-y-8 lg:col-span-4">
            <div className="panel">
              <h2 className="mb-4 text-xl font-bold text-brand-500">Resumo do artigo</h2>
              <p className="mb-6 text-sm leading-relaxed text-gray-600">{post.summary}</p>
              <a href="#artigo" className="text-sm font-semibold text-accent-500">
                Ler conteúdo completo ↓
              </a>
            </div>
            <div className="panel">
              <h2 className="mb-6 text-xl font-bold text-brand-500">Posts relacionados</h2>
              <div className="space-y-6">
                {related.data.map((row) => (
                  <Link className="flex gap-4" key={row.slug} href={'/blog/' + row.slug}>
                    <Photo
                      src={row.coverImage}
                      alt={row.title}
                      className="size-24 shrink-0 rounded-lg object-cover"
                      width={100}
                      height={100}
                    />
                    <div>
                      <h3 className="line-clamp-2 text-sm font-semibold text-brand-500">
                        {row.title}
                      </h3>
                      <span className="mt-2 text-xs text-gray-500">
                        Leitura de {row.readingTime}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="panel">
              <h2 className="mb-6 text-xl font-bold text-brand-500">Categorias</h2>
              <div className="flex flex-wrap gap-2">
                {post.categories.map((category) => (
                  <Link
                    href={'/blog?categoria=' + category.slug}
                    key={category.slug}
                    className="pill"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
            <HelpCard />
          </aside>
        </div>
      </Container>
    </div>
  );
}
