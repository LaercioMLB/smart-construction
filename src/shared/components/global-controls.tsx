'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return visible ? (
    <button
      className="fixed right-6 bottom-6 z-40 rounded-full bg-accent-500 p-3 text-white shadow-lg"
      aria-label="Voltar ao topo"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        })
      }
    >
      <ArrowUp />
    </button>
  ) : null;
}
