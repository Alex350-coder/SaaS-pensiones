import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { to: '/restaurantes', label: 'Restaurantes' },
  { to: '/#como-funciona', label: 'Cómo funciona' },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'rounded-sm px-1 py-1 text-sm font-medium text-text-muted transition-colors hover:text-text',
    isActive && 'text-primary',
  );

function AuthActions({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-text-muted sm:inline">
          Hola, <span className="font-medium text-text">{user.fullName.split(' ')[0]}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          loading={logout.isPending}
          onClick={() => {
            logout.mutate();
            onNavigate?.();
          }}
        >
          <LogOut aria-hidden="true" />
          Salir
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/ingresar" onClick={onNavigate}>
          Ingresar
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link to="/registro" onClick={onNavigate}>
          Crear cuenta
        </Link>
      </Button>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  return (
    <header className="sticky top-0 z-40 border-b border-border glass">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Pensiones — inicio" className="rounded-sm">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <AuthActions />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border bg-surface md:hidden animate-fade-in"
        >
          <nav aria-label="Principal (móvil)" className="container flex flex-col py-4">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="flex min-h-11 items-center rounded-md px-2 text-base font-medium text-text hover:bg-surface-raised"
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-3 border-t border-border pt-3">
              <AuthActions onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
