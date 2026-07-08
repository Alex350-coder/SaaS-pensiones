import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Public shell: skip-link → header → main → footer. On every route change we
 * move focus to <main> so keyboard and screen-reader users land on the new
 * content instead of being stranded at the top of the DOM (WCAG SPA guidance).
 */
export function PublicLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Don't steal focus when navigating to an in-page anchor.
    if (location.hash) return;
    mainRef.current?.focus();
  }, [location.pathname, location.hash]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 outline-none"
      >
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
