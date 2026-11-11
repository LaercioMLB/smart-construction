import type {
  BaseSection,
  WorkGallerySection,
  ProcessSection,
  FinalCtaSection,
  FAQSection,
  WhyChooseUsSection,
  Tag,
} from './sections';
import type { Meta } from './meta';
import type { Service } from './service';

interface Cta {
  link: string;
  text: string;
  icon?: string;
}
interface Feature {
  text: string;
  icon: string;
}
export interface ServiceHeroSection extends BaseSection {
  image?: string; // explícito (ex.: /sobre); nas páginas de serviço é derivado do slug
  primaryCta?: Cta;
  secondaryCta?: Cta;
  features?: Feature[];
}

export interface OverviewStat {
  icon: string;
  value: string;
  label: string;
}

export interface OverviewSection extends BaseSection {
  imageAlt?: string;
  paragraphs: string[];
  stats?: OverviewStat[];
}

export interface PartnerSection extends BaseSection {
  partnerName: string;
  logo: string;
  description: string;
  tags: Tag[];
  cta: Cta;
  footerInfo: {
    usage: string;
    guarantee: string;
  };
  coverImage: string;
}

export interface ServicePartnerSection extends BaseSection {
  partnerName: string;
  logo: string;
  tags: string[];
  cta: string;
  footerInfo: { usage: string; guarantee: string };
}

// Lista o que a mesma obra também exige: quem contrata pintor vai precisar de andaime. Serviço
// parecido (pintor → textura) compete com a página em vez de somar, e por isso a lista é escrita
// à mão em vez de sair de similaridade de keyword.
export interface RelatedServicesSection extends BaseSection {
  services: string[]; // slugs
  items?: Service[]; // resolvido no servidor; não escrever no JSON
}

// Locação não tem equipe própria nem obra para fotografar, então `professionals` e `workGallery`
// ficam de fora dessas páginas.
export interface ServiceSections {
  hero: ServiceHeroSection;
  overview?: OverviewSection;
  partner?: PartnerSection;
  workGallery?: WorkGallerySection;
  process: ProcessSection;
  professionals?: BaseSection;
  whyChooseUs?: WhyChooseUsSection;
  faq?: FAQSection;
  testimonials?: BaseSection;
  related?: RelatedServicesSection;
  finalCta?: FinalCtaSection;
}

export interface ServicePage {
  meta: Meta;
  sections: ServiceSections;
}

export type SectionKey = keyof ServiceSections;

export type { Service } from './service';
