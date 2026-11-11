'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Icon } from '@/shared/components/icon';
import { useAssetExists } from '@/shared/components/asset-provider';
import { assetUrl, serviceCoverPath } from '@/shared/assets';
import type { Service } from '@/shared/types/service';

export function ServiceCard({ service, large = false }: { service: Service; large?: boolean }) {
  const src = assetUrl(serviceCoverPath(service.slug));
  const available = useAssetExists(serviceCoverPath(service.slug));
  const [failed, setFailed] = useState('');
  const showImage = available && failed !== src;
  return (
    <Link
      href={'/servicos/' + service.slug}
      className={`group relative flex min-h-[280px] flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-gray-300 bg-gradient-to-br from-brand-50 via-white to-accent-50/60 p-6 transition-shadow hover:shadow-md md:min-h-[240px] ${large ? 'md:col-span-2' : ''}`}
    >
      {showImage ? (
        <>
          <Image
            src={src}
            alt={service.name}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setFailed(src)}
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/10" />
        </>
      ) : (
        <Icon
          name={service.icon}
          className="absolute -right-5 -bottom-5 size-36 text-brand-500/[.06]"
        />
      )}
      <div
        className={`relative flex size-12 items-center justify-center rounded-xl text-accent-500 ${showImage ? 'bg-white/95' : 'bg-accent-50'}`}
      >
        <Icon name={service.icon} size={24} />
      </div>
      <div className="relative">
        <h3
          className={`mb-3 text-xl font-bold lg:text-2xl ${showImage ? 'text-white' : 'text-brand-500'}`}
        >
          {service.name}
        </h3>
        <p
          className={`text-sm leading-relaxed ${showImage ? 'text-white/80' : 'text-brand-500/60'}`}
        >
          {service.description}
        </p>
        <span
          className={`mt-2 flex items-center gap-1 text-sm font-semibold ${showImage ? 'text-white' : 'text-accent-600'}`}
        >
          Saiba Mais <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}
