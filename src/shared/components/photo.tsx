'use client';
import Image from 'next/image';
import { useState } from 'react';
import { assetUrl } from '@/shared/assets';
export function Photo({
  src,
  alt,
  className = '',
  priority = false,
  width = 1200,
  height = 800,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState('');
  if (failed === src && src.startsWith('/api/v1/profissionais/'))
    return (
      <div
        role="img"
        aria-label={`${alt}: imagem indisponível`}
        className={`flex items-center justify-center bg-gray-100 p-3 text-center text-sm text-gray-500 ${className}`}
      >
        Imagem indisponível
      </div>
    );
  return (
    <Image
      src={failed === src ? '/images/about/cover-2.jpg' : assetUrl(src)}
      alt={alt}
      width={width}
      height={height}
      className={className}
      preload={priority}
      onError={() => setFailed(src)}
      unoptimized
    />
  );
}
