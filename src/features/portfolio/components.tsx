import Link from 'next/link';
import type { ProjectDetail } from '@/shared/types/portfolio';
import { Photo } from '@/shared/components/photo';
import { BeforeAfter } from '@/shared/components/gallery';
export function ProjectCard({ project }: { project: ProjectDetail }) {
  return (
    <div className="group relative">
      {project.type === 'before-after' && project.beforeImageUrl ? (
        <BeforeAfter
          before={project.beforeImageUrl}
          after={project.imageUrl}
          title={project.title ?? 'Projeto'}
          aspectRatio={project.aspectRatio}
        />
      ) : (
        <Link href={'/portfolio/' + project.id} className="block overflow-hidden rounded-2xl">
          <Photo
            src={project.imageUrl}
            alt={project.title ?? 'Projeto'}
            className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
      )}
      <Link
        href={'/portfolio/' + project.id}
        className="absolute top-3 right-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      >
        Ver projeto ↗
      </Link>
    </div>
  );
}
