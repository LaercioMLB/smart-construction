import { serviceRepository, productRepository } from '@/infrastructure/repositories';
import { Container, ButtonLink } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
import { ServiceSearch } from '@/features/services/service-search';
import { ServiceCard } from '@/features/services/components';
import { ProfessionalsSection } from '@/features/home/sections';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [services, products] = await Promise.all([
    serviceRepository.list({ limit: 6 }),
    productRepository.list({ limit: 6 }),
  ]);
  return (
    <>
      <section className="bg-section-bg-1 py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="kicker">SMART CONSTRUCTION</p>
              <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-brand-500 sm:text-6xl">
                Sua Obra Perfeita <span className="text-accent-500">Começa Aqui</span>
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-gray-600">
                Encontre serviços, explore materiais e conheça os profissionais da nossa rede de
                construção e reforma.
              </p>
              <ServiceSearch />
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/catalogo">Explorar materiais</ButtonLink>
                <ButtonLink href="/faca-parte" outline>
                  Faça parte da rede
                </ButtonLink>
              </div>
            </div>
            <Photo
              src="/images/services/arquiteto/cover-generated.jpg"
              alt="Ilustração de planejamento de uma obra"
              className="h-[360px] w-full rounded-3xl object-cover"
              priority
            />
          </div>
        </Container>
      </section>
      <section className="border-y border-gray-100 py-8">
        <Container className="flex flex-wrap justify-around gap-8 text-center">
          <p>
            <strong className="block text-3xl text-accent-500">{services.meta.total}</strong>
            Serviços e soluções
          </p>
          <p>
            <strong className="block text-3xl text-accent-500">{products.meta.total}</strong>
            Materiais no catálogo
          </p>
          <p>
            <strong className="block text-3xl text-accent-500">4</strong>Áreas: serviços, projetos,
            materiais e locação
          </p>
        </Container>
      </section>
      <section className="py-16">
        <Container>
          <h2 className="title-section">Soluções para cada etapa</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {services.data.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
          <ButtonLink href="/servicos" outline className="mt-8">
            Ver todos os serviços
          </ButtonLink>
        </Container>
      </section>
      <ProfessionalsSection />
      <section className="bg-section-bg-1 py-16">
        <Container>
          <h2 className="title-section">Materiais para o seu projeto</h2>
          <p className="mb-8 text-gray-600">
            Catálogo ilustrativo. Os valores são referências didáticas, sem compra ou pagamento
            real.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.map((product) => (
              <div className="panel" key={product.slug}>
                <Photo
                  src={product.image}
                  alt={product.title}
                  className="mb-4 h-48 w-full rounded-xl object-cover"
                />
                <h3 className="mb-4 font-bold text-brand-500">{product.title}</h3>
                <ButtonLink href={'/catalogo/' + product.slug} outline>
                  Ver material
                </ButtonLink>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
