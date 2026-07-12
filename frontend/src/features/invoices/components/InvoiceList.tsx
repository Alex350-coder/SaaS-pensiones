import { Download, Receipt } from 'lucide-react';
import { StateMessage } from '@/components/shared/state-message';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import type { InvoiceView } from '@/lib/api-types';
import { formatCurrency, formatDate } from '@/lib/format';
import { INVOICE_STATUS } from '@/lib/status';

interface InvoiceListProps {
  invoices: InvoiceView[];
  pdfPath: (id: string) => string;
  /** Restaurant view shows the client; client view shows the restaurant. */
  party: 'client' | 'restaurant';
}

export function InvoiceList({ invoices, pdfPath, party }: InvoiceListProps) {
  const { download, downloadingId } = usePdfDownload();

  if (invoices.length === 0) {
    return (
      <StateMessage
        icon={Receipt}
        title="Sin facturas"
        description="Aquí aparecerán las facturas emitidas por cada pago confirmado."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serie</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>{party === 'client' ? 'Restaurante' : 'Cliente'}</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">PDF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.serial}</TableCell>
              <TableCell className="text-text-muted">
                {formatDate(invoice.issuedAt)}
              </TableCell>
              <TableCell>
                {party === 'client'
                  ? invoice.restaurant.name
                  : invoice.client.fullName}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(invoice.total)}
              </TableCell>
              <TableCell>
                <StatusBadge meta={INVOICE_STATUS[invoice.status]} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={downloadingId === invoice.id}
                  onClick={() =>
                    download(
                      pdfPath(invoice.id),
                      `${invoice.serial}.pdf`,
                      invoice.id,
                    )
                  }
                >
                  <Download aria-hidden="true" />
                  Descargar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
