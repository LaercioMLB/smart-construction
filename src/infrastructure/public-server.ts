import 'server-only';
import type { EnrollmentConfiguration } from '@/features/enrollment/contracts';
import type { PublicProfessionalRepository } from '@/features/professionals/contracts';
import { createPublicProfessionalRepository } from './http/public-professionals';
import { createEnrollmentRepository } from './http/enrollment-repository';
import { editorialRepository } from '@/features/editorial/repository';
import { legalVersionsMatch } from '@/features/enrollment/legal-configuration';

function apiBase() {
  const base =
    process.env.API_INTERNAL_URL ??
    process.env.API_PROXY_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '');
  return base ? `${base.replace(/\/$/, '')}/api/v1` : '';
}
const empty: PublicProfessionalRepository = {
  async list(query = {}) {
    return {
      data: [],
      meta: {
        total: 0,
        page: query.page ?? 1,
        limit: query.limit ?? 9,
        totalPages: 1,
        facets: { specialties: [] },
      },
    };
  },
  async get() {
    return null;
  },
};
export function publishedProfessionals(): PublicProfessionalRepository {
  const base = apiBase();
  return base ? createPublicProfessionalRepository(base) : empty;
}
export async function enrollmentConfiguration(): Promise<EnrollmentConfiguration | null> {
  if (process.env.REGISTRATIONS_UI_ENABLED !== 'true' || !apiBase()) return null;
  try {
    const config = await createEnrollmentRepository(apiBase()).configuration();
    const [terms, privacy] = await Promise.all([
      editorialRepository.legal('termos-de-uso'),
      editorialRepository.legal('politica-de-privacidade'),
    ]);
    return legalVersionsMatch(config, { terms: terms.version, privacy: privacy.version })
      ? config
      : null;
  } catch {
    return null;
  }
}
