import type { Category } from './service';

export interface BlogPost {
  title: string;
  slug: string;
  description: string;
  summary: string;
  date: string;
  readingTime: string;
  author: string;
  coverImage: string;
  categories: Category[];
  content: BlogContentSection[];
}

export interface BlogContentSection {
  title?: string;
  paragraphs: string[];
  image?: string;
  quote?: string;
  paragraphsAfterQuote?: string[];
}

export interface RelatedPost {
  title: string;
  slug: string;
  readingTime: string;
  image: string;
}
export type BlogPostCard = Pick<
  BlogPost,
  'slug' | 'title' | 'summary' | 'coverImage' | 'categories' | 'date' | 'readingTime'
>;
