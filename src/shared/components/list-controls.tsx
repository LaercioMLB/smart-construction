'use client';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Facet } from '@/shared/contracts';
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute top-3 left-3 text-gray-400" size={18} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field pr-10 pl-10"
      />
      {value && (
        <button
          aria-label="Limpar busca"
          onClick={() => onChange('')}
          className="absolute top-2 right-2 p-1 text-accent-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
export function CheckFilters({
  title,
  items,
  selected,
  onChange,
}: {
  title: string;
  items: Facet[];
  selected: string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 text-lg font-bold text-brand-500">{title}</legend>
      {items.map((item) => (
        <label
          className="flex cursor-pointer items-center gap-3 text-sm text-gray-600"
          key={item.slug}
        >
          <input
            type="checkbox"
            checked={selected.includes(item.slug)}
            onChange={() => onChange(item.slug)}
            className="size-4 accent-accent-500"
          />
          <span className="grow">{item.name}</span>
          <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
            {item.count}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-6"
    >
      <p className="text-sm text-gray-500">
        Página {page} de {totalPages}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="rounded p-2 disabled:opacity-30"
            disabled={page <= 1}
            aria-label="Página anterior"
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter((n) => Math.abs(n - page) < 2 || n === 1 || n === totalPages)
            .map((n, index, numbers) => (
              <span key={n} className="flex items-center">
                {index > 0 && numbers[index - 1] !== n - 1 && <span className="px-1">…</span>}
                <button
                  className={`size-8 rounded-md text-sm ${n === page ? 'bg-accent-500 text-white' : 'hover:bg-gray-100'}`}
                  aria-label={`Página ${n}`}
                  aria-current={n === page ? 'page' : undefined}
                  onClick={() => onChange(n)}
                >
                  {n}
                </button>
              </span>
            ))}
          <button
            className="rounded p-2 disabled:opacity-30"
            disabled={page >= totalPages}
            aria-label="Próxima página"
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </nav>
  );
}
export function EmptyState({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center py-16 text-center">
      <Search size={48} className="mb-4 text-gray-300" />
      <h2 className="mb-2 text-xl font-medium text-brand-500">Nenhum resultado encontrado</h2>
      <p className="mb-5 text-gray-500">Tente outra busca ou remova os filtros.</p>
      <button className="btn btn-outline" onClick={reset}>
        Limpar filtros
      </button>
    </div>
  );
}
export function ListError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="panel text-center">
      <p className="mb-4">{message}</p>
      <button className="btn" onClick={retry}>
        Tentar novamente
      </button>
    </div>
  );
}
