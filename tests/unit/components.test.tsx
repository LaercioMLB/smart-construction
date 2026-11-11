import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Faq } from '@/features/services/faq';
import { Pagination, CheckFilters } from '@/shared/components/list-controls';
import { Reviews } from '@/features/professionals/reviews';
describe('interações de componentes', () => {
  it('avaliações calculam distribuição e revelam mais três registros', async () => {
    const user = userEvent.setup();
    const reviews = Array.from({ length: 6 }, (_, index) => ({
      id: index,
      name: `Cliente ${index + 1}`,
      avatar: '/images/placeholder-avatar.png',
      rating: index < 3 ? 5 : 4,
      timeAgo: 'Há um mês',
      text: `Avaliação fictícia ${index + 1}`,
    }));
    render(<Reviews reviews={reviews} rating={4.5} />);
    expect(screen.getByRole('meter', { name: '5 estrelas' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.queryByText('Avaliação fictícia 4')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carregar mais avaliações' }));
    expect(screen.getByText('Avaliação fictícia 6')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais avaliações' }),
    ).not.toBeInTheDocument();
  });
  it('FAQ abre por teclado e fecha a pergunta anterior', async () => {
    const user = userEvent.setup();
    render(
      <Faq
        section={{
          title: 'Dúvidas',
          questions: [
            { question: 'Primeira?', answer: 'Primeira resposta' },
            { question: 'Segunda?', answer: 'Segunda resposta' },
          ],
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Primeira?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Segunda?' }));
    expect(screen.getByRole('button', { name: 'Segunda?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Primeira?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('paginação respeita limites e expõe página atual', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Pagination page={1} totalPages={4} onChange={change} />);
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(change).toHaveBeenCalledWith(2);
  });
  it('checkbox identifica categoria e emite o slug correto', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <CheckFilters
        title="Categoria"
        items={[{ slug: 'portas', name: 'Portas', count: 8 }]}
        selected={[]}
        onChange={change}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: /Portas/ }));
    expect(change).toHaveBeenCalledWith('portas');
  });
});
