import { Container, ButtonLink } from '@/shared/components/ui';
export const metadata = { title: 'Atendimento simulado' };
export default function Contact() {
  return (
    <Container className="max-w-3xl py-16">
      <h1 className="title-section">Atendimento simulado</h1>
      <p className="mb-6 text-lg leading-relaxed text-gray-600">
        A Smart Construction é uma empresa fictícia. Este canal representa a etapa de contato do
        cliente; nenhuma mensagem, orçamento ou contratação é enviada. Não há integração com
        WhatsApp, e-mail ou telefone.
      </p>
      <p className="mb-8 text-gray-600">
        Para explorar o fluxo persistente do laboratório, envie um cadastro com dados sintéticos e
        acompanhe a análise na área administrativa.
      </p>
      <div className="flex flex-wrap gap-4">
        <ButtonLink href="/faca-parte">Explorar cadastros</ButtonLink>
        <ButtonLink href="/servicos" outline>
          Voltar aos serviços
        </ButtonLink>
      </div>
    </Container>
  );
}
