import { Suspense } from 'react';
import { productRepository } from '@/infrastructure/repositories';
import { CatalogList } from '@/features/catalog/catalog-list';
import { Container, Breadcrumb } from '@/shared/components/ui';
import { listQuery, type SearchParams } from '@/shared/query';
export const metadata = { title: 'Catálogo de Materiais' };
export default async function Catalog({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const initial = await productRepository.list({ ...listQuery(await searchParams), limit: 9 });
  return (
    <div className="bg-gray-50/30 pt-8 pb-20">
      <Container>
        <Breadcrumb items={[{ label: 'Catálogo' }]} />
        <h1 className="title-section mb-2">Materiais Para Sua Obra</h1>
        <p className="mb-8 text-lg text-slate-500">
          Trabalhamos com as principais marcas do mercado. Materiais direto da fábrica, preço justo
          e qualidade garantida para sua obra.
        </p>
        <Suspense>
          <CatalogList initial={initial} />
        </Suspense>
      </Container>
    </div>
  );
}
