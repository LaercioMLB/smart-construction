import { Container, FeatureList, ButtonLink, Breadcrumb } from '@/shared/components/ui';
import { Photo } from '@/shared/components/photo';
import { WhatsAppLink } from '@/shared/components/whatsapp-link';
import type {
  ServiceHeroSection,
  OverviewSection,
  PartnerSection,
} from '@/shared/types/servicePage';
import { ShieldCheck } from 'lucide-react';
import { Icon } from '@/shared/components/icon';
export function ServiceHero({
  section,
  label,
  image,
  about = false,
}: {
  section: ServiceHeroSection;
  label: string;
  image?: string;
  about?: boolean;
}) {
  return (
    <section className="relative flex min-h-[600px] items-center overflow-hidden bg-white">
      {image && (
        <div className="absolute inset-0 hidden justify-end md:flex">
          <Photo
            src={image}
            alt={label}
            priority
            className="h-full w-3/4 object-cover object-right lg:w-2/3"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white to-white/50 md:to-transparent xl:from-20% xl:via-50% xl:to-70%" />
        </div>
      )}
      <Container className="relative z-10 px-4! py-6">
        <div className="flex max-w-3xl flex-col items-start gap-6 [&_nav]:mb-0">
          <Breadcrumb
            items={
              about ? [{ label: 'Sobre' }] : [{ label: 'Serviços', href: '/servicos' }, { label }]
            }
          />
          <h1 className="text-[2.5rem] leading-[1.1] font-extrabold tracking-tight text-brand-500 sm:text-6xl">
            {section.title?.split(/(Dor de Cabeça)/i).map((text, index) => (
              <span
                key={index}
                className={text.toLowerCase() === 'dor de cabeça' ? 'text-accent-500' : ''}
              >
                {text}
              </span>
            ))}
          </h1>
          <p className="mb-2 max-w-lg text-lg text-gray-600">{section.description}</p>
          {image && (
            <Photo
              src={image}
              alt={label}
              priority
              className="h-[250px] w-full rounded-xl object-cover md:hidden"
            />
          )}
          <FeatureList
            features={
              section.features ?? [
                { text: 'Profissionais certificados' },
                { text: 'Garantia integral' },
                { text: 'Sem taxa escondida' },
              ]
            }
          />
          <div className="mt-4 flex w-full flex-col gap-4 sm:flex-row">
            <WhatsAppLink className="btn">
              {section.primaryCta?.text ?? 'Solicitar Orçamento'}
            </WhatsAppLink>
            <ButtonLink
              href={
                about
                  ? '/servicos'
                  : section.secondaryCta?.link?.startsWith('/')
                    ? section.secondaryCta.link
                    : '/profissionais'
              }
              className="bg-transparent text-accent-500 hover:bg-accent-50"
            >
              {section.secondaryCta?.text ?? 'Ver profissionais disponíveis'} →
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
export function Overview({ section }: { section: OverviewSection }) {
  return (
    <section className="py-16">
      <Container>
        <div className="grid items-stretch gap-2 lg:grid-cols-3 lg:gap-12">
          <div>
            <Photo
              src="/images/about/cover-2.jpg"
              alt={section.imageAlt ?? section.title ?? 'Smart Construction'}
              className="hidden h-[560px] w-full rounded-2xl object-cover shadow-sm lg:block"
            />
          </div>
          <div className="flex flex-col justify-center lg:col-span-2">
            {section.kicker && <p className="kicker mb-4">{section.kicker}</p>}
            <h2 className="title-section">{section.title}</h2>
            <Photo
              src="/images/about/cover-2.jpg"
              alt={section.imageAlt ?? section.title ?? 'Smart Construction'}
              className="my-3 h-[250px] w-full rounded-2xl object-cover shadow-sm lg:hidden"
            />
            <div className="mb-8 space-y-4 text-gray-600 leading-relaxed">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {section.stats && (
              <div className="grid gap-4 sm:grid-cols-3">
                {section.stats.map((stat) => (
                  <div
                    key={stat.value}
                    className="flex flex-col items-start gap-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4"
                  >
                    <div className="flex size-12 items-center justify-center rounded-lg bg-accent-100/50">
                      <Icon name={stat.icon} className="text-accent-500" />
                    </div>
                    <div>
                      <strong className="text-2xl text-brand-500">{stat.value}</strong>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
export function PartnerShowcase({ section }: { section: PartnerSection }) {
  return (
    <section className="py-16">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Photo
            src={section.coverImage}
            alt={'Fachada do parceiro ' + section.partnerName}
            className="h-[500px] w-full rounded-2xl object-cover shadow-lg lg:h-[600px]"
          />
          <div>
            <p className="kicker">Parceria Oficial</p>
            <h2 className="title-section mb-6">
              Os Melhores Materiais <br className="hidden lg:block" />
              <span className="text-accent-500">Direto da Fábrica</span>
            </h2>
            <p className="mb-8 text-lg text-gray-600 leading-relaxed">{section.description}</p>
            <ul className="mb-8 space-y-4">
              {section.tags.map((tag) => (
                <li key={tag.text} className="flex items-start gap-3 font-medium text-brand-600">
                  <Icon name={tag.icon} size={20} className="mt-1 text-accent-500" />
                  {tag.text}
                </li>
              ))}
            </ul>
            <WhatsAppLink className="btn btn-outline w-full">{section.cta.text} →</WhatsAppLink>
            <div className="mt-8 flex flex-col items-start gap-4 text-sm text-gray-600 sm:flex-row sm:items-center">
              <span className="flex gap-2">
                <ShieldCheck size={20} className="shrink-0 text-accent-500" />
                {section.footerInfo.usage}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-semibold">
                {section.footerInfo.guarantee}
              </span>
            </div>
            <div className="mt-8 flex items-center gap-4 border-t border-gray-100 pt-6">
              <Photo
                src={section.logo}
                alt={'Logo ' + section.partnerName}
                className="h-12 w-auto object-contain"
                width={180}
                height={80}
              />
              <div>
                <p className="text-lg font-bold text-brand-500">{section.partnerName}</p>
                <p className="mt-0.5 text-xs tracking-widest text-gray-600 uppercase">
                  Parceiro Oficial
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
