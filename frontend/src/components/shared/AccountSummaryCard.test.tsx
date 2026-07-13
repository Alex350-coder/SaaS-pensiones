import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/stores/session-store';
import { withQueryClient } from '@/test/query-utils';
import { AccountSummaryCard } from './AccountSummaryCard';

const mockFetch = vi.mocked(apiFetch);

describe('AccountSummaryCard', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useSessionStore.setState({
      user: { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'CLIENT' } as never,
    });
  });
  afterEach(() => useSessionStore.setState({ user: null }));

  it('renders account details from /auth/me', async () => {
    mockFetch.mockResolvedValue({
      id: 'u1',
      fullName: 'Ada Lovelace',
      email: 'ada@b.com',
      phone: '+51 999',
      role: 'CLIENT',
    });
    render(<AccountSummaryCard />, { wrapper: withQueryClient() });

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@b.com')).toBeInTheDocument();
    expect(screen.getByText('+51 999')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    render(<AccountSummaryCard />, { wrapper: withQueryClient() });
    await waitFor(() =>
      expect(screen.getByText('No pudimos cargar tu cuenta')).toBeInTheDocument(),
    );
  });
});
