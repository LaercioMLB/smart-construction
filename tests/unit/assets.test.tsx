import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { assetUrl } from '@/shared/assets';
import { ServiceCard } from '@/features/services/service-card';
import type { Service } from '@/shared/types/service';

const service: Service = {
  id: 1,
  name: 'Eletricista',
  slug: 'eletricista',
  type: 'execucao',
  category: 'eletrica',
  icon: 'mdi-flash',
  description: 'Instalações elétricas.',
  keywords: [],
  popularity: 10,
};

describe('imagens de serviços e storage', () => {
  it('resolve caminhos locais e o prefixo do bucket sem alterar URLs externas ou previews', () => {
    expect(assetUrl('/images/services/eletricista/cover.jpg', '')).toBe(
      '/images/services/eletricista/cover.jpg',
    );
    expect(assetUrl('/images/services/eletricista/cover.jpg', '/assets/')).toBe(
      '/assets/services/eletricista/cover.jpg',
    );
    expect(assetUrl('/images/about/cover-2.jpg', 'https://assets.example/bucket')).toBe(
      'https://assets.example/bucket/about/cover-2.jpg',
    );
    expect(assetUrl('blob:preview', '/assets')).toBe('blob:preview');
    expect(assetUrl('https://example/image.jpg', '/assets')).toBe('https://example/image.jpg');
  });

  it('exibe a capa conhecida e recupera o card quando a imagem falha', () => {
    render(<ServiceCard service={service} />);
    const image = screen.getByRole('img', { name: service.name });
    expect(new URL(image.getAttribute('src') ?? '', 'http://localhost').pathname).toBe(
      '/images/services/eletricista/cover.jpg',
    );
    fireEvent.error(image);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: service.name })).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/servicos/eletricista');
  });

  it('mantém ícone e texto para um serviço sem capa, sem requisitar um arquivo ausente', () => {
    render(<ServiceCard service={{ ...service, slug: 'servico-sem-capa' }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: service.name })).toBeVisible();
  });
});
