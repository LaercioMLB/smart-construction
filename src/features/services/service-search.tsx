'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X, ArrowRight } from 'lucide-react';
import { serviceRepository } from '@/infrastructure/repositories';
import type { Service } from '@/shared/types/service';
import { QUICK_SEARCHES } from './search-examples';
export function ServiceSearch({ quick = false, all = true }: { quick?: boolean; all?: boolean }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let current = true;
    const timeout = setTimeout(async () => {
      setPending(true);
      try {
        const found = await serviceRepository.search(query);
        if (current) {
          setResults(found);
          setError('');
          setActive(-1);
        }
      } catch {
        if (current) setError('Não foi possível buscar. Tente novamente.');
      } finally {
        if (current) setPending(false);
      }
    }, 150);
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [query]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const go = (service?: Service) => {
    setOpen(false);
    router.push(service ? '/servicos/' + service.slug : '/servicos');
  };
  return (
    <div className="relative w-full" ref={wrapper}>
      <form
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          go(results[Math.max(0, active)]);
        }}
      >
        <Search size={20} className="ml-2 shrink-0 text-gray-400" />
        <input
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-label="Buscar serviço"
          aria-expanded={open && Boolean(query)}
          aria-controls={id}
          aria-activedescendant={active >= 0 && open ? `${id}-${active}` : undefined}
          placeholder="Ex: meu cano estourou, preciso de uma caçamba…"
          value={query}
          className="min-w-0 grow py-3 text-sm text-gray-700 outline-none"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((old) => Math.min(old + 1, results.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((old) => Math.max(0, old - 1));
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar busca de serviço"
            className="p-1 text-gray-400"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
        <button type="submit" className="btn compact">
          Buscar
        </button>
      </form>
      {open && Boolean(query.trim()) && (
        <div className="absolute top-full z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left text-gray-700 shadow-xl">
          <ul id={id} role="listbox" aria-label="Serviços encontrados">
            {results.map((service, index) => (
              <li
                role="option"
                id={`${id}-${index}`}
                aria-selected={active === index}
                key={service.slug}
                className={active === index ? 'bg-accent-50' : ''}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-accent-50"
                  onClick={() => go(service)}
                >
                  <span>
                    <strong className="block text-sm text-brand-500">{service.name}</strong>
                    <span className="line-clamp-1 text-xs text-gray-500">
                      {service.description}
                    </span>
                  </span>
                  <ArrowRight className="shrink-0 text-accent-500" size={18} />
                </button>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p role="status" className="px-5 py-4 text-sm">
              {pending ? 'Buscando…' : error || 'Nenhum serviço encontrado. Tente outro termo.'}
            </p>
          )}
          {all && (
            <Link
              href="/servicos"
              className="block border-t border-gray-100 px-5 py-3 text-sm font-semibold text-accent-600"
              onClick={() => setOpen(false)}
            >
              Ver todos os serviços →
            </Link>
          )}
        </div>
      )}
      {quick && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
          <span className="text-brand-100/70">Buscas rápidas:</span>
          {QUICK_SEARCHES.map((text) => (
            <button
              type="button"
              key={text}
              className="rounded-full border border-white/20 px-3 py-1.5 text-white hover:bg-white/10"
              onClick={() => {
                setQuery(text);
                setOpen(true);
                input.current?.focus();
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
