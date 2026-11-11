import { Container, ButtonLink } from '@/shared/components/ui';
export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="mb-4 text-6xl font-extrabold text-accent-500">404</p>
      <h1 className="title-section">Página não encontrada</h1>
      <p className="mb-8 text-gray-500">
        A página que você está procurando não existe ou foi removida.
      </p>
      <ButtonLink href="/">Voltar ao início</ButtonLink>
    </Container>
  );
}
