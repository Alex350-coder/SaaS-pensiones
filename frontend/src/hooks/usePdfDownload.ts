import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Downloads an authenticated PDF stream (invoices are served with `@Res()`, so
 * they bypass the JSON envelope). Auth rides the httpOnly `access_token` cookie
 * (`credentials: 'include'`, same-origin), so no token is read in JS. Tracks
 * the in-flight id so a row can show a spinner.
 */
export function usePdfDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = async (
    path: string,
    filename: string,
    id: string,
  ): Promise<void> => {
    setDownloadingId(id);
    try {
      const res = await fetch(`/api/v1${path}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('pdf-failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No pudimos descargar el PDF. Inténtalo de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  return { download, downloadingId };
}
