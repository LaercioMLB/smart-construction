import Link from 'next/link';
import type { Product } from '@/shared/types/product';
import { Photo } from '@/shared/components/photo';
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={'/catalogo/' + product.slug}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-48 overflow-hidden">
        <Photo
          src={product.image}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 max-w-[90%] rounded-full border border-gray-100 bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-widest text-gray-700 uppercase">
          {product.category.replaceAll('-', ' ')}
        </span>
      </div>
      <div className="flex grow flex-col p-4">
        {product.brand && <span className="mb-1 text-xs text-gray-400">{product.brand}</span>}
        <h2 className="mb-2 line-clamp-2 text-sm font-bold text-brand-500 group-hover:text-accent-600">
          {product.title}
        </h2>
        <p className="mb-3 line-clamp-2 grow text-xs leading-relaxed text-gray-500">
          {product.description}
        </p>
        {product.price !== undefined && (
          <div className="mt-auto">
            <strong className="text-lg text-brand-500">
              {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
            <span className="ml-1 text-xs text-gray-400">{product.priceUnit}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
