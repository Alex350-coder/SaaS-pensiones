import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PENSION_STATUS } from '@/lib/status';
import { ConfirmDialog } from './ConfirmDialog';
import { PageHeading } from './page-heading';
import { ErrorState, StateMessage } from './state-message';
import { StatusBadge } from './StatusBadge';

describe('StateMessage / ErrorState', () => {
  it('renders a title and optional description', () => {
    render(<StateMessage title="Sin datos" description="Aún no hay nada aquí" />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay nada aquí')).toBeInTheDocument();
  });

  it('ErrorState exposes a retry action that fires the callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('ErrorState without a retry handler shows no button', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders the label from a status meta entry', () => {
    render(<StatusBadge meta={PENSION_STATUS.ACTIVE} />);
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });
});

describe('PageHeading', () => {
  it('renders the title, description and actions', () => {
    render(
      <PageHeading title="Mis pensiones" description="Tu plan actual" actions={<button>Nuevo</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'Mis pensiones' })).toBeInTheDocument();
    expect(screen.getByText('Tu plan actual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('renders content when open and confirms / cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="¿Cancelar pensión?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        danger
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('¿Cancelar pensión?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render its content while closed', () => {
    render(
      <ConfirmDialog open={false} onOpenChange={vi.fn()} title="Oculto" onConfirm={vi.fn()} />,
    );
    expect(screen.queryByText('Oculto')).not.toBeInTheDocument();
  });
});
