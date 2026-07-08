import { Toaster as SonnerToaster } from 'sonner';
import { useThemeStore } from '@/stores/theme-store';

/**
 * App-wide toast surface. Auto-dismiss ~4s, announced politely to screen
 * readers (sonner uses an aria-live region and never steals focus). Styled
 * from the design tokens so it matches light/dark.
 */
export function Toaster() {
  const resolved = useThemeStore((s) => s.resolved);
  return (
    <SonnerToaster
      theme={resolved}
      position="bottom-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-md border border-border bg-surface text-text shadow-elevation-3',
          description: 'text-text-muted',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-surface-raised text-text',
          error: 'border-danger/40',
          success: 'border-success/40',
        },
      }}
    />
  );
}
