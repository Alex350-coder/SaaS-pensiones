import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));

import { usePdfDownload } from './usePdfDownload';
import { useSessionStore } from '@/stores/session-store';

describe('usePdfDownload', () => {
  const clickSpy = vi.fn();

  beforeEach(() => {
    toastError.mockClear();
    clickSpy.mockClear();
    useSessionStore.setState({ tokens: { accessToken: 'tok', refreshToken: 'r' }, user: null });
    URL.createObjectURL = vi.fn(() => 'blob:url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useSessionStore.setState({ tokens: null, user: null });
  });

  it('fetches with the bearer token and triggers a download', async () => {
    const blob = new Blob(['%PDF']);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePdfDownload());
    await act(async () => {
      await result.current.download('/invoices/i1/pdf', 'factura.pdf', 'i1');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/invoices/i1/pdf', {
      headers: { Authorization: 'Bearer tok' },
    });
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    expect(result.current.downloadingId).toBeNull();
  });

  it('shows an error toast when the stream fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => usePdfDownload());
    await act(async () => {
      await result.current.download('/invoices/i1/pdf', 'factura.pdf', 'i1');
    });
    expect(toastError).toHaveBeenCalled();
    await waitFor(() => expect(result.current.downloadingId).toBeNull());
  });
});
