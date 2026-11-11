import { projectRepository, contentRepository } from '@/infrastructure/repositories';
import { PortfolioList } from '@/features/portfolio/portfolio-list';
import { Container, Breadcrumb } from '@/shared/components/ui';
export const metadata = { title: 'Portfólio | Nossos Projetos' };
export default async function Portfolio() {
  const initial = await projectRepository.list({ limit: 6 });
  const stats = await contentRepository.stats();
  return (
    <div className="bg-gray-50/30 pt-8 pb-20">
      <Container>
        <Breadcrumb items={[{ label: 'Portfolio' }]} />
        <h1 className="title-section">Confira Nossos Trabalhos</h1>
        <p className="mb-6 text-lg text-slate-500">
          Centenas de projetos transformados em Foz do Iguaçu. Qualidade, dedicação e resultado que
          fala por si.
        </p>
        <PortfolioList initial={initial} highlights={stats.portfolio} />
      </Container>
    </div>
  );
}
