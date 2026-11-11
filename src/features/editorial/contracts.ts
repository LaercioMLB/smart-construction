export type LegalSlug = 'termos-de-uso' | 'politica-de-privacidade';

export interface LegalDocument {
  version: string;
  updatedAt: string;
  toc: { id: string; title: string }[];
  html: string;
}
