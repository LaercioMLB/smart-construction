import type { PageResult, ReadRepository } from '@/shared/contracts';

export interface PublishedProfessional {
  id: string;
  name: string;
  bio: string;
  city: string;
  uf: string;
  professions: { id: string; name: string; slug: string; primary: boolean }[];
  courses: { name: string; institution: string | null; start: number | null; end: number | null }[];
  avatar: string | null;
  images: string[];
}
export type PublishedProfessionals = PageResult<PublishedProfessional>;
export type PublicProfessionalRepository = ReadRepository<PublishedProfessional>;
