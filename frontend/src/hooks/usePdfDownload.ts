import { useState } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/stores/session-store';

/**
 * Downloads an authenticated PDF stream (invoices are served with `@Res()`, so
 * they bypass the JSON envelope). Fetches the blob with the bearer token and
 * triggers a browser save. Tracks the in-flight id so a row can show a spinner.
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
      const token = useSessionStore.getState().tokens?.accessToken;
      const res = await fetch(`/api/v1${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
