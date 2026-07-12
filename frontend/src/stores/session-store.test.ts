import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsAuthenticated, useSessionStore } from './session-store';

const session = {
  user: { id: 'u1', email: 'a@b.com', fullName: 'Ada', role: 'CLIENT' as const },
  accessToken: 'a',
  refreshToken: 'r',
};

describe('useSessionStore', () => {
  beforeEach(() => useSessionStore.setState({ user: null, tokens: null }));

  it('stores user + tokens on setSession', () => {
    useSessionStore.getState().setSession(session as never);
    const state = useSessionStore.getState();
    expect(state.user?.email).toBe('a@b.com');
    expect(state.tokens).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('replaces only the token pair on setTokens', () => {
    useSessionStore.getState().setSession(session as never);
    useSessionStore.getState().setTokens({ accessToken: 'a2', refreshToken: 'r2' });
    const state = useSessionStore.getState();
    expect(state.tokens?.accessToken).toBe('a2');
    expect(state.user?.email).toBe('a@b.com');
  });

  it('clears everything on clear', () => {
    useSessionStore.getState().setSession(session as never);
    useSessionStore.getState().clear();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().tokens).toBeNull();
  });

  it('useIsAuthenticated reflects a full session only', () => {
    const { result, rerender } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);

    useSessionStore.getState().setSession(session as never);
    rerender();
    expect(result.current).toBe(true);

    useSessionStore.getState().clear();
    rerender();
    expect(result.current).toBe(false);
  });
});
