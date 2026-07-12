import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the accessible brand mark with the wordmark by default', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Pensiones' })).toBeInTheDocument();
    expect(screen.getByText('Pensiones')).toBeInTheDocument();
  });

  it('hides the wordmark when asked', () => {
    render(<Logo withWordmark={false} />);
    expect(screen.getByRole('img', { name: 'Pensiones' })).toBeInTheDocument();
    expect(screen.queryByText('Pensiones')).not.toBeInTheDocument();
  });
});
