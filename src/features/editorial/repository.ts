import data from '@/infrastructure/fixtures/editorial.json';
import type { LegalDocument, LegalSlug } from './contracts';
export interface EditorialRepository {
  about(): Promise<
    Pick<
      typeof data,
      'features' | 'historyStats' | 'missionStats' | 'historyParagraphs' | 'missionParagraphs'
    >
  >;
  legal(slug: LegalSlug): Promise<LegalDocument>;
}
export const editorialRepository: EditorialRepository = {
  async about() {
    return structuredClone(data);
  },
  async legal(slug) {
    return structuredClone(data[slug]);
  },
};
