import { Building2, HardHat, CheckCircle } from 'lucide-react';
import { Container, Breadcrumb, ButtonLink, FinalCta } from '@/shared/components/ui';
export const metadata = {
  title: 'Trabalhe conosco na Smart Construction — faça parte da nossa rede',
};
export default function Join() {
  const paths = [
    {
      icon: Building2,
      overline: 'Para fornecedores e parceiros',
      title: 'Cadastro de empresa',
      description:
        'Forneça materiais, patrocine páginas de serviço e ganhe visibilidade com milhares de clientes em obras na região.',
      bullets: [
        'Fornecimento de materiais',
        'Patrocínio de páginas de serviço',
        'Visibilidade da sua marca',
      ],
      cta: 'Quero ser parceiro',
      href: '/faca-parte/empresa',
    },
    {
      icon: HardHat,
      overline: 'Para profissionais',
      title: 'Cadastro de profissional',
      description:
        'É pintor, eletricista, encanador ou de outra área da construção? Entre para a nossa rede de profissionais e atenda clientes que já confiam na gente.',
      bullets: [
        'Receba obras para executar',
        'Faça parte da rede de +100 parceiros',
        '+10 anos de marca consolidada',
      ],
      cta: 'Quero me cadastrar',
      href: '/faca-parte/profissional',
    },
  ];
  return (
    <>
      <Container className="pt-8">
        <Breadcrumb items={[{ label: 'Faça parte' }]} />
      </Container>
      <section className="px-4 pb-12 text-center md:pb-20">
        <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-brand-500 sm:text-5xl">
          Faça parte da Smart Construction
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
          Somos referência em construção e reforma em Foz do Iguaçu.
          <br />
          Conectamos clientes a uma rede de profissionais e fornecedores parceiros. Escolha como
          você quer fazer parte.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-600">
          <span>+10 anos de experiência</span>
          <span>+100 parceiros na rede</span>
          <span>+1000 obras realizadas</span>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 md:grid-cols-2 lg:gap-8">
        {paths.map((path) => (
          <div key={path.href} className="panel flex min-h-[32rem] flex-col p-6 md:p-8">
            <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-500">
              <path.icon />
            </div>
            <p className="mb-2 text-sm font-bold text-accent-500">{path.overline}</p>
            <h2 className="mb-4 text-2xl font-bold text-brand-500">{path.title}</h2>
            <p className="mb-6 leading-relaxed text-slate-600">{path.description}</p>
            <ul className="mb-8 space-y-3">
              {path.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-sm font-medium text-brand-500">
                  <CheckCircle size={20} className="shrink-0 text-accent-500" />
                  {bullet}
                </li>
              ))}
            </ul>
            <ButtonLink href={path.href} className="mt-auto w-full">
              {path.cta} →
            </ButtonLink>
          </div>
        ))}
      </section>
      <FinalCta
        title="Ficou com alguma dúvida?"
        description="Fale com a nossa equipe antes de se cadastrar. A gente te ajuda a escolher o melhor caminho."
      />
    </>
  );
}
