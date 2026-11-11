import Link from 'next/link';
import Image from 'next/image';
import { Container } from './ui';
export function Footer() {
  return (
    <footer className="bg-brand-500 py-12 text-white">
      <Container className="flex flex-wrap items-start justify-between gap-8">
        <div className="max-w-md">
          <Image src="/logo-footer.svg" alt="Smart Construction" width={240} height={60} />
          <p className="mt-4 text-sm text-white/80">
            Plataforma fictícia de construção e reforma. Catálogo, preços, projetos e imagens são
            materiais ilustrativos para o laboratório; não representam ofertas ou obras desta
            empresa.
          </p>
        </div>
        <nav aria-label="Links do rodapé" className="flex flex-col gap-3 text-sm">
          <Link href="/servicos">Serviços</Link>
          <Link href="/catalogo">Materiais</Link>
          <Link href="/faca-parte">Cadastros</Link>
          <Link href="/admin/login">Painel de admin</Link>
          <Link href="/contato">Atendimento simulado</Link>
          <Link href="/termos-de-uso">Termos de Uso</Link>
          <Link href="/politica-de-privacidade">Política de Privacidade</Link>
        </nav>
      </Container>
    </footer>
  );
}
