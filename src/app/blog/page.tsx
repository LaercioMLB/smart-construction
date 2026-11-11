import { Suspense } from 'react';
import { postRepository } from '@/infrastructure/repositories';
import { BlogList } from '@/features/blog/blog-list';
import { Container, Breadcrumb } from '@/shared/components/ui';
import type { SearchParams } from '@/shared/query';
export const metadata = { title: 'Blog | Dicas de Construção e Reforma' };
export default async function Blog({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const initial = await postRepository.list({
    search: typeof params.busca === 'string' ? params.busca : '',
    category: typeof params.categoria === 'string' ? [params.categoria] : [],
    page: Number(params.page ?? 1),
    limit: 6,
  });
  return (
    <div className="bg-gray-50/30 pt-8 pb-20">
      <Container>
        <Breadcrumb items={[{ label: 'Blog' }]} />
        <Suspense>
          <BlogList initial={initial} />
        </Suspense>
      </Container>
    </div>
  );
}
