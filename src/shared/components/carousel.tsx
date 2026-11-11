'use client';
import { useEffect, useRef, type ReactNode } from 'react';
export function Carousel({
  children,
  label,
  className = '',
  delay = 4400,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const timer = setInterval(() => {
      const element = ref.current;
      if (!element || element.contains(document.activeElement)) return;
      const item = element.firstElementChild;
      if (!item) return;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const width = item.getBoundingClientRect().width + gap;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      element.scrollTo({ left: end ? 0 : element.scrollLeft + width, behavior: 'smooth' });
    }, delay);
    return () => clearInterval(timer);
  }, [delay]);
  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription="carrossel"
      aria-label={label}
      tabIndex={0}
      className={`flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&>*]:shrink-0 [&>*]:snap-start ${className}`}
    >
      {children}
    </div>
  );
}
