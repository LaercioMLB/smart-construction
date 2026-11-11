import { ArrowRight } from 'lucide-react';
import { Icon } from '@/shared/components/icon';
import type { ProcessSection, WhyChooseUsSection } from '@/shared/types/sections';
import { Container, Heading, ButtonLink } from '@/shared/components/ui';
export { ServiceCard } from './service-card';
export const defaultProcess: ProcessSection = {
  title: 'Como funciona nosso processo',
  description:
    'Do primeiro contato até a entrega, nós gerenciamos cada detalhe para que você não precise se preocupar com nada.',
  steps: [
    {
      step: 1,
      title: 'Contato e Orçamento',
      description:
        'Descreva o que você precisa. Nossa plataforma conecta o seu projeto aos melhores profissionais da região.',
      icon: 'phone-in-talk-outline',
    },
    {
      step: 2,
      title: 'Escolha com Segurança',
      description:
        'Receba orçamentos e compare perfis. Todos os nossos profissionais são rigorosamente verificados e avaliados.',
      icon: 'shield-alert',
    },
    {
      step: 3,
      title: 'Execução Premium',
      description:
        'O profissional escolhido realiza o trabalho com qualidade, cumprindo os prazos e requisitos combinados.',
      icon: 'hammer-screwdriver',
    },
    {
      step: 4,
      title: 'Entrega e Garantia',
      description:
        'Obra limpa e finalizada! Você aprova o serviço e conta com a nossa garantia integral para sua tranquilidade.',
      icon: 'handshake',
    },
  ],
};
export function Process({ section = defaultProcess }: { section?: ProcessSection }) {
  return (
    <section className="py-16 md:py-10">
      <Container>
        <Heading
          kicker="DO INÍCIO AO FIM"
          title={section.title ?? defaultProcess.title}
          description={section.description ?? defaultProcess.description}
        />
        <div className="grid gap-12 md:grid-cols-4 md:gap-4">
          {section.steps.map((step) => (
            <div className="relative flex flex-col items-center text-center" key={step.step}>
              <div className="relative mb-6 flex size-20 items-center justify-center rounded-full border border-white bg-slate-100 text-brand-500 shadow-sm">
                <span className="absolute -top-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-accent-500 text-xs font-bold text-white">
                  {step.step}
                </span>
                <Icon name={step.icon} size={30} />
              </div>
              <h3 className="mb-3 text-lg font-bold text-brand-500">{step.title}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
export const defaultReasons: WhyChooseUsSection = {
  title: 'Sua Obra sem Dor de Cabeça',
  description:
    'Mais de 10 anos transformando casas em Foz do Iguaçu com qualidade, confiança e zero dor de cabeça.',
  stats: [
    { icon: 'calendar-blank-outline', text: '10+ anos' },
    { icon: 'home-outline', text: '1000+ obras' },
    { icon: 'star-outline', text: 'Avaliações de clientes' },
  ],
  reasons: [
    {
      icon: 'target',
      title: 'Gestão Centralizada',
      description:
        'Você lida apenas com a Smart Construction. Nós coordenamos todos os profissionais para você não se estressar.',
    },
    {
      icon: 'license',
      title: 'Profissionais Certificados',
      description: 'Equipe rigorosamente selecionada, testada na prática e de extrema confiança.',
    },
    {
      icon: 'shield-check-outline',
      title: 'Garantia Integral',
      description:
        'Cobertura total contra imprevistos. Se algo sair do combinado, nós resolvemos sem custos extras.',
    },
    {
      icon: 'handshake-outline',
      title: 'Suporte Pós-Obra',
      description:
        'Nossa responsabilidade não acaba na entrega. Estaremos à disposição para qualquer ajuste futuro.',
    },
  ],
};
export function Reasons({ section = defaultReasons }: { section?: WhyChooseUsSection }) {
  return (
    <section className="bg-section-bg-1 py-16 md:py-10">
      <Container>
        <Heading
          kicker="Por Que Escolher a Smart Construction"
          title={section.title}
          description={section.description}
        />
        {section.stats && (
          <div className="mb-12 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            {section.stats.map((stat) => (
              <span key={stat.text} className="flex items-center gap-2">
                <Icon name={stat.icon} size={18} className="text-accent-500" />
                {stat.text}
              </span>
            ))}
          </div>
        )}
        <div
          className={`mb-12 grid justify-center justify-items-center gap-6 sm:grid-cols-2 ${section.reasons?.length === 3 ? 'mx-auto max-w-5xl lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          {section.reasons?.map((reason) => (
            <div
              key={reason.title}
              className="panel flex max-w-72 flex-col items-center p-8 text-center"
            >
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                <Icon name={reason.icon} size={28} />
              </div>
              <h3 className="mb-3 text-lg font-bold text-brand-500">{reason.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{reason.description}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <ButtonLink href="/sobre">
            Conheça Nossa História <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
