import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { PasswordField } from './PasswordField';
import { TextField } from './TextField';

const registration = (name: string): UseFormRegisterReturn =>
  ({ name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }) as never;

describe('TextField', () => {
  it('renders a labelled input wired to the registration', () => {
    render(
      <TextField id="email" label="Correo" registration={registration('email')} required />,
    );
    const input = screen.getByLabelText(/Correo/);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('shows a hint when there is no error', () => {
    render(
      <TextField id="email" label="Correo" hint="Usaremos esto para avisarte" registration={registration('email')} />,
    );
    expect(screen.getByText('Usaremos esto para avisarte')).toBeInTheDocument();
  });

  it('announces the error and marks the field invalid', () => {
    render(
      <TextField
        id="email"
        label="Correo"
        hint="hidden when error"
        error="El correo no es válido."
        registration={registration('email')}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('El correo no es válido.');
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('aria-invalid', 'true');
    // Hint gives way to the error.
    expect(screen.queryByText('hidden when error')).not.toBeInTheDocument();
  });
});

describe('PasswordField', () => {
  it('toggles visibility between password and text', async () => {
    const user = userEvent.setup();
    render(<PasswordField id="pw" label="Contraseña" registration={registration('password')} />);

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows the error with an alert role', () => {
    render(
      <PasswordField id="pw" label="Contraseña" error="Requerida" registration={registration('password')} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Requerida');
  });
});
