import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Centered auth surface shared by login and register. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(50% 50% at 20% 10%, var(--color-primary-soft) 0%, transparent 55%), radial-gradient(45% 45% at 90% 90%, var(--color-secondary-soft) 0%, transparent 55%)',
        }}
      />
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/" aria-label="Pensiones — inicio" className="rounded-sm">
            <Logo />
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-elevation-3 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            <p className="mt-1.5 text-sm text-text-muted text-pretty">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
