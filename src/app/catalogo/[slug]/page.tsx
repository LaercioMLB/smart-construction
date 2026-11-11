import { notFound } from 'next/navigation';
import { productRepository, categoryNames } from '@/infrastructure/repositories';
import { Container, Breadcrumb } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
import { ProductCard } from '@/features/catalog/components';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';
import Link from 'next/link';
export async function generateStaticParams() {
  const { data } = await productRepository.list({ limit: 500 });
  return data.map((row) => ({ slug: row.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = await productRepository.get((await params).slug);
  return { title: product?.title, description: product?.description };
}
export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const product = await productRepository.get((await params).slug);
  if (!product) notFound();
  const related = await productRepository.list({
    category: [product.category],
    exclude: product.slug,
    limit: 4,
  });
  return (
    <div className="bg-gray-50/30 pt-8 pb-20">
      <Container>
        <Breadcrumb
          items={[
            { label: 'Catálogo', href: '/catalogo' },
            {
              label: categoryNames[product.category],
              href: '/catalogo?category=' + product.category,
            },
            { label: product.title },
          ]}
        />
        <div className="mb-16 grid gap-10 lg:grid-cols-12">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white self-start lg:col-span-5">
            <Photo
              src={product.image}
              alt={product.title}
              className="aspect-square w-full object-cover"
              priority
            />
          </div>
          <div className="lg:col-span-7">
            <Link
              href={'/catalogo?category=' + product.category}
              className="mb-4 inline-block rounded-full bg-accent-50 px-3 py-1 text-xs font-bold tracking-wider text-accent-600 uppercase"
            >
              {categoryNames[product.category]}
            </Link>
            <h1 className="title-section leading-tight">{product.title}</h1>
            {product.brand && <p className="mb-4 text-gray-500">{product.brand}</p>}
            <p className="mb-8 text-lg leading-relaxed text-gray-500">{product.description}</p>
            {product.price !== undefined && (
              <p className="mb-8">
                <strong className="text-3xl font-bold text-brand-500">
                  {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
                <span className="ml-2 text-sm text-gray-400">{product.priceUnit}</span>
              </p>
            )}
            <WhatsAppLink className="btn mb-8 w-full">
              Solicitar orçamento via WhatsApp
            </WhatsAppLink>
            <div className="panel">
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt>Categoria</dt>
                  <dd className="font-semibold text-brand-500">
                    {categoryNames[product.category]}
                  </dd>
                </div>
                {product.brand && (
                  <div className="flex justify-between">
                    <dt>Marca</dt>
                    <dd>{product.brand}</dd>
                  </div>
                )}
                {product.priceUnit && (
                  <div className="flex justify-between">
                    <dt>Unidade</dt>
                    <dd>{product.priceUnit}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
        {related.data.length > 0 && (
          <>
            <h2 className="mb-6 text-2xl font-bold text-brand-500">Produtos relacionados</h2>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {related.data.map((row) => (
                <ProductCard key={row.id} product={row} />
              ))}
            </div>
          </>
        )}
      </Container>
    </div>
  );
}
