export type ProjectWorkType = 'classic' | 'before-after';

export type ProjectCategory = 'construcoes' | 'reformas' | 'piscinas' | 'acabamentos';

export interface ProjectWork {
  id: number;
  type: ProjectWorkType;
  category: ProjectCategory;
  imageUrl: string;
  beforeImageUrl?: string;
  aspectRatio?: string;
  tag?: string;
  title?: string;
  author?: string;
}

export interface ProjectDetail extends ProjectWork {
  description: string;
  gallery: string[];
  location: string;
  duration: string;
  year: number;
  services: string[];
}
