'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FAQSection } from '@/shared/types/sections';
export function Faq({ section }: { section: FAQSection }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="title-section mb-10 text-center">{section.title}</h2>
        <div className="space-y-4">
          {section.questions.map((faq, index) => (
            <div
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              key={faq.question}
            >
              <h3>
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold text-brand-700"
                  aria-expanded={open === index}
                  aria-controls={`faq-${index}`}
                  onClick={() => setOpen(open === index ? null : index)}
                >
                  {faq.question}
                  <ChevronDown
                    className={`shrink-0 transition-transform ${open === index ? 'rotate-180' : ''}`}
                  />
                </button>
              </h3>
              <div
                id={`faq-${index}`}
                hidden={open !== index}
                className="px-6 pb-6 leading-relaxed text-gray-600"
              >
                {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
