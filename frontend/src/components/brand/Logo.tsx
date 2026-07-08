import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Show the "Pensiones" wordmark next to the mark. */
  withWordmark?: boolean;
}

/**
 * Brand mark: a stylized bowl with a rising sage leaf — "a daily meal you can
 * count on". SVG so it scales crisply and adapts to the theme via currentColor.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label="Pensiones"
      >
        <defs>
          <linearGradient id="logo-bowl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" />
            <stop offset="1" stopColor="var(--color-secondary)" />
          </linearGradient>
        </defs>
        <path
          d="M4 15h24a12 12 0 0 1-24 0Z"
          fill="url(#logo-bowl)"
        />
        <path
          d="M16 13c0-4.4 2.6-7.6 6.5-8.5C22.2 8.7 19.8 12 16 13Z"
          fill="var(--color-accent)"
        />
        <rect x="9" y="26" width="14" height="2.4" rx="1.2" fill="url(#logo-bowl)" />
      </svg>
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight text-text">
          Pensiones
        </span>
      )}
    </span>
  );
}
