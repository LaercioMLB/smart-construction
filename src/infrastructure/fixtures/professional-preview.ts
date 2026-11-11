import type { Professional } from '@/shared/types/profissional';

export const professionalPreview: Professional = {
  id: 'preview',
  name: 'Profissional Exemplo',
  title: 'Pintura & Acabamento',
  bio: 'Perfil fictício para pré-visualização local. Especialista em pintura residencial, acabamento de paredes e aplicação de texturas, com atenção à organização e aos detalhes da obra.',
  avatarUrl: '/images/placeholder-avatar.png',
  locationText: 'Foz do Iguaçu, PR',
  responseTimeText: 'Responde em até 1 hora',
  availabilityText: 'Disponível esta semana',
  yearsExperience: 8,
  jobsCompleted: 150,
  satisfactionRate: 98,
  rating: 4.8,
  reviewCount: 0,
  isTopRated: false,
  verifications: [
    { text: 'Profissional Verificado Smart Construction', type: 'success' },
    { text: 'Garantia Integral da Obra', type: 'warning' },
  ],
  specialties: ['Pintura Interna', 'Pintura Externa', 'Texturas e Grafiato'],
  courses: [
    {
      name: 'Pintura e acabamentos',
      institution: 'Instituição Exemplo',
      year: '2024',
      icon: 'mdi:school-outline',
    },
  ],
  portfolioUrls: [
    '/images/services/pintor/cover.jpg',
    '/images/services/gesso-e-drywall/cover.jpg',
    '/images/services/ceramica-e-porcelanato/cover.jpg',
  ],
};
