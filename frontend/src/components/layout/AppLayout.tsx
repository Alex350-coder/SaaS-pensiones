import { ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { useLogout } from '@/features/auth/hooks';
import { ROLE_LABELS, roleHomePath } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { navForRole, type NavItem } from './app-nav';
import { ThemeToggle } from './ThemeToggle';

function SidebarNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Secciones" className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-fast',
              isActive
                ? 'bg-primary-soft text-primary'
                : 'text-text-muted hover:bg-surface-raised hover:text-text',
            )
          }
        >
          <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Private app shell for every authenticated surface: a persistent sidebar on
 * desktop, a slide-in drawer on mobile, and a topbar with theme, a link back to
 * the public site, and sign-out. Focus moves to <main> on navigation (WCAG SPA
 * guidance), mirroring the public layout.
 */
export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();

  useEffect(() => {
    if (location.hash) return;
    mainRef.current?.focus();
  }, [location.pathname, location.hash]);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // RequireAuth guarantees a user; this satisfies the type and guards SSR-less
  // race on logout (session cleared → this unmounts).
  if (!user) return null;

  const items = navForRole(user.role);
  const home = roleHomePath(user.role);
  const firstName = user.fullName.split(' ')[0];

  const brand = (
    <Link to={home} aria-label="Pensiones — inicio" className="rounded-sm">
      <Logo />
    </Link>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#app-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-5 md:flex">
          <div className="px-1">{brand}</div>
          <p className="mb-5 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            {ROLE_LABELS[user.role]}
          </p>
          <SidebarNav items={items} />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-surface px-4 py-5">
              <div className="flex items-center justify-between">
                {brand}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar menú"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <p className="mb-5 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                {ROLE_LABELS[user.role]}
              </p>
              <SidebarNav items={items} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border glass">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Abrir menú"
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(true)}
                >
                  <Menu aria-hidden="true" />
                </Button>
                <span className="md:hidden">{brand}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/">
                    <ExternalLink aria-hidden="true" />
                    <span className="hidden sm:inline">Ver sitio</span>
                  </Link>
                </Button>
                <NotificationBell />
                <ThemeToggle />
                <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
                <span className="hidden text-sm text-text-muted sm:inline">
                  Hola, <span className="font-medium text-text">{firstName}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <LogOut aria-hidden="true" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            </div>
          </header>

          <main
            id="app-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
          >
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
