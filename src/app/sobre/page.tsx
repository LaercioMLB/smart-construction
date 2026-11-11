import { Container, ButtonLink } from '@/shared/components/ui';
export const metadata = { title: 'Sobre a Smart Construction' };
export default function About() {
  return (
    <Container className="max-w-4xl py-16">
      <p className="kicker">QUEM SOMOS</p>
      <h1 className="title-section">Construir começa com uma boa conexão.</h1>
      <div className="space-y-6 text-lg leading-relaxed text-gray-600">
        <p>
          A Smart Construction é uma empresa fictícia do setor da construção civil que quer reunir
          serviços, materiais e profissionais em uma plataforma digital.
        </p>
        <p>
          O catálogo permite conhecer soluções de execução, projetos, locação e fornecimento de
          materiais. Profissionais e empresas podem solicitar participação na rede, com análise pela
          equipe administrativa.
        </p>
        <p>
          Esta aplicação faz parte do laboratório de Engenharia de Software do professor Laercio,
          dedicado à implantação e à operação em nuvem. Todos os cadastros devem usar dados
          sintéticos. Não há contratação, pagamento ou atendimento comercial real.
        </p>
        <ButtonLink href="/servicos">Conheça as soluções</ButtonLink>
      </div>
    </Container>
  );
}
