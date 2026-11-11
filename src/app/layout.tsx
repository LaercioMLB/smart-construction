import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/public-sans';
import './globals.css';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';
import { site } from '@/shared/site';
import { BackToTop } from '@/shared/components/global-controls';
import { AssetProvider } from '@/shared/components/asset-provider';
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: 'Smart Construction | Construção e reforma',
    template: '%s | Smart Construction',
  },
  description:
    'Plataforma fictícia de serviços, materiais e profissionais da construção para o laboratório de deploy em nuvem.',
  robots: { index: false, follow: false },
  openGraph: {
    siteName: 'Smart Construction',
    locale: 'pt_BR',
    type: 'website',
    images: ['/logo.svg'],
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para conteúdo
        </a>
        <AssetProvider>
          <div className="bg-brand-50 px-4 py-2 text-center text-xs font-medium text-brand-500">
            Ambiente fictício de laboratório. Use somente dados sintéticos nos cadastros.
          </div>
          <Header />
          <main id="conteudo">{children}</main>
          <Footer />
          <BackToTop />
        </AssetProvider>
      </body>
    </html>
  );
}
