import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState } from '@/components/shared/state-message';
import { Skeleton } from '@/components/ui/skeleton';
import { restaurantInvoicePdfPath } from '@/features/invoices/api';
import { InvoiceList } from '@/features/invoices/components/InvoiceList';
import { useRestaurantInvoices } from '@/features/invoices/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function RestaurantInvoicesPage() {
  useDocumentTitle('Facturas emitidas');
  const { data, isLoading, isError, refetch } = useRestaurantInvoices();

  return (
    <>
      <PageHeading
        title="Facturas"
        description="Comprobantes emitidos por cada pago confirmado."
      />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <InvoiceList
          invoices={data?.items ?? []}
          party="restaurant"
          pdfPath={restaurantInvoicePdfPath}
        />
      )}
    </>
  );
}
