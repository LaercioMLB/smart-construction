// Tipos para os campos JSONB do Supabase
export interface ProfessionalCourse {
  name: string;
  institution: string;
  year: string;
  icon: string;
}

export interface ProfessionalVerification {
  text: string;
  type: 'success' | 'warning';
}

// Interface principal
export interface Professional {
  id: string;
  name: string;
  title: string; // Especialidade principal
  bio: string;
  avatarUrl: string;
  phoneNumber?: string;

  // Localização e Status
  locationText: string;
  responseTimeText: string;
  availabilityText: string;

  // Métricas (Números brutos)
  yearsExperience: number;
  jobsCompleted: number;
  satisfactionRate: number;
  rating: number;
  reviewCount: number;
  isTopRated: boolean;

  // Arrays e JSONs
  specialties: string[];
  portfolioUrls: string[];
  verifications: ProfessionalVerification[];
  courses: ProfessionalCourse[];
}

export type ProfessionalCard = Omit<Professional, 'bio' | 'phoneNumber' | 'courses'>;
