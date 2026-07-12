import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState } from '@/components/shared/state-message';
import { Skeleton } from '@/components/ui/skeleton';
import { clientInvoicePdfPath } from '@/features/invoices/api';
import { InvoiceList } from '@/features/invoices/components/InvoiceList';
import { useClientInvoices } from '@/features/invoices/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ClientInvoicesPage() {
  useDocumentTitle('Mis facturas');
  const { data, isLoading, isError, refetch } = useClientInvoices();

  return (
    <>
      <PageHeading
        title="Facturas"
        description="Descarga los comprobantes de tus pagos."
      />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <InvoiceList
          invoices={data?.items ?? []}
          party="client"
          pdfPath={clientInvoicePdfPath}
        />
      )}
    </>
  );
}
