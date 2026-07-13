import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsAuthenticated, useSessionStore } from './session-store';

const session = {
  user: { id: 'u1', email: 'a@b.com', fullName: 'Ada', role: 'CLIENT' as const },
};

describe('useSessionStore', () => {
  beforeEach(() => useSessionStore.setState({ user: null }));

  it('stores the user on setSession (tokens live in httpOnly cookies)', () => {
    useSessionStore.getState().setSession(session);
    const state = useSessionStore.getState();
    expect(state.user?.email).toBe('a@b.com');
  });

  it('clears the user on clear', () => {
    useSessionStore.getState().setSession(session);
    useSessionStore.getState().clear();
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('useIsAuthenticated reflects the presence of a user', () => {
    const { result, rerender } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);

    useSessionStore.getState().setSession(session);
    rerender();
    expect(result.current).toBe(true);

    useSessionStore.getState().clear();
    rerender();
    expect(result.current).toBe(false);
  });
});
