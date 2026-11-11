'use client';
import { useState } from 'react';
import { Stars } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
import { Icon } from '@/shared/components/icon';
import type { Review } from '@/shared/types/review';
export type { Review } from '@/shared/types/review';
export function Reviews({ reviews, rating }: { reviews: Review[]; rating: number }) {
  const [visible, setVisible] = useState(3);
  return (
    <section className="panel">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-brand-500">
        <Icon name="comment-quote-outline" size={20} className="text-accent-400" />
        Avaliações de Clientes
      </h2>
      <div className="mb-8 flex items-center gap-4 sm:gap-8">
        <div className="shrink-0 text-center">
          <p className="text-5xl leading-none font-bold text-brand-500 sm:text-6xl">
            {rating.toFixed(1)}
          </p>
          <div className="my-2">
            <Stars rating={rating} />
          </div>
          <p className="text-xs text-slate-400">Baseado em {reviews.length} avaliações</p>
        </div>
        <div className="grow space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const pct = reviews.length
              ? Math.round(
                  (reviews.filter((r) => r.rating === stars).length / reviews.length) * 100,
                )
              : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs text-slate-500 sm:gap-3">
                <span className="w-12 shrink-0 text-right">{stars} estrelas</span>
                <div
                  role="meter"
                  aria-label={`${stars} estrelas`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 min-w-4 grow overflow-hidden rounded-full bg-gray-100"
                >
                  <div className="h-full rounded-full bg-accent-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-7 shrink-0 text-slate-400">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-4">
        {reviews.slice(0, visible).map((review) => (
          <div className="rounded-xl border border-gray-100 p-4" key={review.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Photo
                  src={review.avatar}
                  alt={review.name}
                  width={40}
                  height={40}
                  className="size-10 rounded-full border border-gray-100 object-cover"
                />
                <div>
                  <p className="text-sm font-bold text-brand-500">{review.name}</p>
                  <p className="text-xs text-slate-400">{review.timeAgo}</p>
                </div>
              </div>
              <Stars rating={review.rating} />
            </div>
            <p className="text-sm leading-relaxed text-slate-600 italic">{review.text}</p>
          </div>
        ))}
      </div>
      {visible < reviews.length && (
        <button
          className="mt-5 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-brand-900 hover:border-accent-400 hover:text-accent-500"
          onClick={() => setVisible((n) => n + 3)}
        >
          Carregar mais avaliações
        </button>
      )}
    </section>
  );
}
