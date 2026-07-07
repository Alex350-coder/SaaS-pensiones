import { Response } from 'express';

/**
 * Streams a generated invoice PDF straight to the client, bypassing the global
 * envelope interceptor (which only wraps JSON). Using @Res() hands response
 * control to us, so the interceptor's mapped value is never sent.
 */
export function sendInvoicePdf(
  res: Response,
  buffer: Buffer,
  invoiceId: string,
): void {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="factura-${invoiceId}.pdf"`,
    'Content-Length': String(buffer.length),
  });
  res.end(buffer);
}
