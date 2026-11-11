import Link from 'next/link';
import type { BlogPost } from '@/shared/types/Blog';
import { Photo } from '@/shared/components/photo';
export function BlogCard({ post, compact = false }: { post: BlogPost; compact?: boolean }) {
  return (
    <Link
      href={'/blog/' + post.slug}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md"
    >
      <Photo src={post.coverImage} alt={post.title} className="h-56 w-full object-cover" />
      <div className="flex grow flex-col p-6">
        <p className="kicker">{post.categories[0]?.name}</p>
        <h2 className="mb-3 text-lg leading-snug font-bold text-brand-500 group-hover:text-accent-600">
          {post.title}
        </h2>
        {!compact && (
          <>
            <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-500">
              {post.summary}
            </p>
            <p className="mt-auto text-xs text-gray-400">
              {post.date} · {post.readingTime}
            </p>
          </>
        )}
        <span className="mt-4 text-sm font-semibold text-accent-500">Leia Mais →</span>
      </div>
    </Link>
  );
}
