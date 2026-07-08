import { useEffect } from 'react';

const SUFFIX = 'Pensiones';

/** Set the document title for a page, restoring nothing (SPA convention). */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : `${SUFFIX} — tu plan de comidas mensual`;
  }, [title]);
}
