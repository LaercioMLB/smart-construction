'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Photo } from './photo';
import { Modal } from './modal';
import { useHydrated } from '@/shared/hooks/use-hydrated';
export function Gallery({
  images,
  title = 'Galeria de trabalhos',
  thumbnailClass = 'h-24 w-full rounded-lg object-cover',
  carousel = false,
  expandable = false,
}: {
  images: string[];
  title?: string;
  thumbnailClass?: string;
  carousel?: boolean;
  expandable?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (
      !carousel ||
      open ||
      images.length < 2 ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = setInterval(() => setSelected((index) => (index + 1) % images.length), 5000);
    return () => clearInterval(timer);
  }, [carousel, open, images.length]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft')
        setSelected((index) => (index - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight') setSelected((index) => (index + 1) % images.length);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, images.length]);
  if (!images.length) return null;
  return (
    <div>
      {carousel && (
        <div className="relative mb-5 overflow-hidden rounded-2xl">
          <button
            className="block w-full"
            aria-label="Ampliar imagem principal"
            onClick={() => setOpen(true)}
          >
            <Photo
              src={images[selected]}
              alt={`${title} — imagem ${selected + 1}`}
              className="aspect-video w-full object-cover"
            />
          </button>
          {images.length > 1 && (
            <>
              <button
                aria-label="Imagem anterior"
                className="absolute top-1/2 left-3 rounded-full bg-white/90 p-2"
                onClick={() => setSelected((selected - 1 + images.length) % images.length)}
              >
                <ChevronLeft />
              </button>
              <button
                aria-label="Próxima imagem"
                className="absolute top-1/2 right-3 rounded-full bg-white/90 p-2"
                onClick={() => setSelected((selected + 1) % images.length)}
              >
                <ChevronRight />
              </button>
            </>
          )}
        </div>
      )}
      <div
        className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : carousel ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3'}`}
      >
        {images.slice(0, carousel || showAll ? images.length : 6).map((src, index) => (
          <button
            key={`${src}-${index}`}
            aria-label={`Ver imagem ${index + 1} de ${title}`}
            onClick={() => {
              setSelected(index);
              if (!carousel) setOpen(true);
            }}
            className={`overflow-hidden rounded-lg ${carousel && selected !== index ? 'opacity-40 hover:opacity-100' : ''}`}
          >
            <Photo
              src={src}
              alt={`${title} — imagem ${index + 1}`}
              className={thumbnailClass}
              width={300}
              height={200}
            />
          </button>
        ))}
      </div>
      {expandable && images.length > 6 && (
        <button className="btn btn-outline mt-4 w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Mostrar menos' : `Ver todas as ${images.length} fotos`}
        </button>
      )}
      <Modal title={title} open={open} onClose={() => setOpen(false)} fullscreen>
        <Photo
          src={images[selected]}
          alt={`${title} — imagem ${selected + 1}`}
          className="max-h-[95dvh] max-w-full object-contain p-6 md:p-12"
        />
        {images.length > 1 && (
          <>
            <button
              aria-label="Imagem anterior ampliada"
              className="absolute left-2 rounded-full bg-black/40 p-3 sm:left-6"
              onClick={() => setSelected((selected - 1 + images.length) % images.length)}
            >
              <ChevronLeft size={36} />
            </button>
            <button
              aria-label="Próxima imagem ampliada"
              className="absolute right-2 rounded-full bg-black/40 p-3 sm:right-6"
              onClick={() => setSelected((selected + 1) % images.length)}
            >
              <ChevronRight size={36} />
            </button>
            <p className="absolute bottom-3 text-sm text-white/70">
              {selected + 1} / {images.length}
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
export function BeforeAfter({
  before,
  after,
  title,
  aspectRatio = '2/3',
}: {
  before: string;
  after: string;
  title: string;
  aspectRatio?: string;
}) {
  const hydrated = useHydrated();
  const [position, setPosition] = useState(50);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio }}>
      <Photo
        src={before}
        alt={`${title} antes`}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        <Photo src={after} alt={`${title} depois`} className="h-full w-full object-cover" />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 -left-4 flex size-8 items-center justify-center rounded-full border-2 border-white bg-accent-500 text-white">
          ↔
        </span>
      </div>
      <span className="absolute bottom-3 left-3 rounded bg-black/70 px-2 text-xs text-white">
        Antes
      </span>
      <span className="absolute right-3 bottom-3 rounded bg-black/70 px-2 text-xs text-white">
        Depois
      </span>
      <input
        type="range"
        disabled={!hydrated}
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label={`Comparar antes e depois — ${title}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
