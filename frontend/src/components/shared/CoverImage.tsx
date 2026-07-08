import { useState } from 'react';
import { monogram } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CoverImageProps {
  src: string | null;
  alt: string;
  /** Name used to derive the monogram fallback when there is no image. */
  name: string;
  /** Tailwind aspect-ratio class, e.g. `aspect-[16/10]`. */
  aspectClassName?: string;
  /** Render the bottom ink gradient (for text legibility over the image). */
  withGradient?: boolean;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Restaurant cover with a first-class no-image fallback: a branded gradient
 * with the restaurant's monogram. Reserves space via aspect-ratio so images
 * never shift layout (CLS < 0.1), and degrades gracefully if the URL 404s.
 */
export function CoverImage({
  src,
  alt,
  name,
  aspectClassName = 'aspect-[16/10]',
  withGradient = false,
  className,
  loading = 'lazy',
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-surface-raised',
        aspectClassName,
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div
          className="flex size-full items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent"
          aria-hidden="true"
        >
          <span className="select-none text-4xl font-bold tracking-tight text-white/90 drop-shadow-sm">
            {monogram(name)}
          </span>
        </div>
      )}

      {withGradient && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-cover)' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
