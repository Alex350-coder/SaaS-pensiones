import PDFDocument from 'pdfkit';
import { InvoiceView } from './invoice-view';

/** Peruvian sol formatting for the simulated invoice (UI copy is Spanish). */
function formatMoney(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Renders a simulated invoice to a PDF Buffer on demand — no file is stored,
 * so Invoice.pdfUrl stays null. Kept as a pure function (data in, bytes out)
 * so it is unit-testable without HTTP. A real emitter would replace this.
 */
export function renderInvoicePdf(invoice: InvoiceView): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('FACTURA (SIMULADA)', { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(13).text(invoice.serial, { align: 'right' });
    if (invoice.status === 'VOIDED') {
      doc.moveDown(0.2);
      doc.fillColor('red').fontSize(12).text('ANULADA', { align: 'right' });
      doc.fillColor('black');
    }

    // Issuer
    doc.moveDown(1.5);
    doc.fontSize(11).text('Emisor', { underline: true });
    doc.fontSize(12).text(invoice.restaurant.name);
    doc.fontSize(9).fillColor('gray').text(`Restaurante @${invoice.restaurant.slug}`);
    doc.fillColor('black');

    // Client
    doc.moveDown(1);
    doc.fontSize(11).text('Cliente', { underline: true });
    doc.fontSize(12).text(invoice.client.fullName);
    doc.fontSize(9).fillColor('gray').text(invoice.client.email);
    doc.fillColor('black');

    // Detail
    doc.moveDown(1.5);
    doc.fontSize(11).text('Detalle', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text('Pensión de 30 días');
    doc.fontSize(9).fillColor('gray').text(`Ref. pensión: ${invoice.pensionId}`);
    doc.fillColor('black');
    doc.fontSize(9).text(`Fecha de emisión: ${formatDate(invoice.issuedAt)}`);

    // Total
    doc.moveDown(1.5);
    doc.fontSize(16).text(`Total: ${formatMoney(invoice.total)}`, {
      align: 'right',
    });

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('gray')
      .text(
        'Documento simulado con fines de demostración. No tiene validez tributaria.',
        { align: 'center' },
      );

    doc.end();
  });
}
