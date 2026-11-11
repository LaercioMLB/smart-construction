import type { Partner } from './partner';
import type { Service } from './service';

export interface BaseSection {
  kicker?: string;
  title?: string;
  description?: string;
  bgSection?: string;
  ctaText?: string;
  ctaLink?: string;
}
export interface Tag {
  icon: string;
  text: string;
}

export interface FAQQuestion {
  question: string;
  answer: string;
}
export interface FAQSection extends BaseSection {
  questions: FAQQuestion[];
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}
export interface ProcessSection extends BaseSection {
  steps: ProcessStep[];
}

export interface ReasonCard {
  icon: string;
  title: string;
  description: string;
}
export interface WhyChooseUsSection extends BaseSection {
  stats?: { icon: string; text: string }[];
  reasons?: ReasonCard[];
}

export interface WorkGalleryFilter {
  label: string;
  slug: string;
  count?: number;
}
export interface WorkGallerySection extends BaseSection {
  filters: WorkGalleryFilter[];
}

export interface FinalCtaSection extends BaseSection {
  ctaIcon?: string;
}

export interface PartnersSection extends BaseSection {
  tags: Tag[];
  partners: Partner[];
}

// `type` aqui é a variante visual do card (não o trilho do serviço), por isso o Omit.
export interface ServiceCard extends Omit<Service, 'type'> {
  type: 'image' | 'standard';
  size?: 'large' | 'medium';
  link?: string;
}

export interface ServicesSection extends BaseSection {
  services?: ServiceCard[];
}

export interface HeroSectionProps {
  badgeText?: string;
  badgeAvatars?: string[];
  titleDark?: string;
  titleOrange?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  popularTags?: {
    name: string;
    slug: string;
  }[];
  mainImage?: string;
  floatingCard?: {
    rating: number;
    text: string;
    authorName: string;
    authorAvatar: string;
  };
  bgSection?: string;
}
