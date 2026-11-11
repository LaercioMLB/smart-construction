export type ProductCategory =
  | 'revestimentos'
  | 'paver'
  | 'areia'
  | 'pedras'
  | 'pre-moldados'
  | 'pedras-decorativas'
  | 'serralheria'
  | 'terra'
  | 'portas'
  | 'telhas'
  | 'forros'
  | 'paisagismo'
  | 'lajes'
  | 'argamassas'
  | 'playground'
  | 'concretos'
  | 'madeiras'
  | 'materiais-eletricos'
  | 'tijolos'
  | 'placas-cimenticias';

export interface ProductBrand {
  name: string;
  slug: string;
  count?: number;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: ProductCategory;
  brand?: string;
  brandSlug?: string;
  rating?: number;
  reviewCount: number;
  price?: number;
  priceUnit?: string;
  image: string;
  featured?: boolean;
}

export interface ProductCard {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: ProductCategory;
  brand?: string;
  rating?: number;
  reviewCount: number;
  price?: number;
  priceUnit?: string;
  image: string;
}
