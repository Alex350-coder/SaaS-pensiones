import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { roleHomePath } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname + location.search}</div>;
}

function signIn(role: 'CLIENT' | 'RESTAURANT_ADMIN' | 'SUPER_ADMIN') {
  useSessionStore.setState({
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', role } as never,
    tokens: { accessToken: 'a', refreshToken: 'r' },
  });
}

afterEach(() => useSessionStore.setState({ user: null, tokens: null }));

describe('RequireAuth', () => {
  beforeEach(() => useSessionStore.setState({ user: null, tokens: null }));

  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/app/pension" element={<div>protegido</div>} />
          </Route>
          <Route path="/ingresar" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders the protected outlet when authenticated', () => {
    signIn('CLIENT');
    renderAt('/app/pension');
    expect(screen.getByText('protegido')).toBeInTheDocument();
  });

  it('redirects to login with a redirect back-param when signed out', () => {
    renderAt('/app/pension');
    expect(screen.getByTestId('path').textContent).toBe(
      '/ingresar?redirect=%2Fapp%2Fpension',
    );
  });
});

describe('RequireRole', () => {
  function renderGuard(allow: readonly ('CLIENT' | 'RESTAURANT_ADMIN' | 'SUPER_ADMIN')[]) {
    return render(
      <MemoryRouter initialEntries={['/panel']}>
        <Routes>
          <Route element={<RequireRole allow={allow} />}>
            <Route path="/panel" element={<div>panel</div>} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders the subtree for an allowed role', () => {
    signIn('RESTAURANT_ADMIN');
    renderGuard(['RESTAURANT_ADMIN']);
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('redirects a wrong-role user to their own home (never a dead end)', () => {
    signIn('CLIENT');
    renderGuard(['RESTAURANT_ADMIN']);
    expect(screen.getByTestId('path').textContent).toBe(roleHomePath('CLIENT'));
  });

  it('sends a signed-out user to login', () => {
    useSessionStore.setState({ user: null, tokens: null });
    renderGuard(['RESTAURANT_ADMIN']);
    expect(screen.getByTestId('path').textContent).toBe('/ingresar');
  });
});
