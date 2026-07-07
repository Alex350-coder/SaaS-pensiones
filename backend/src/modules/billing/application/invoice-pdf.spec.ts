import { renderInvoicePdf } from './invoice-pdf';
import { InvoiceView } from './invoice-view';

const baseInvoice: InvoiceView = {
  id: 'inv-1',
  series: 'F001',
  number: 1,
  serial: 'F001-000001',
  status: 'ISSUED',
  total: 300,
  issuedAt: new Date('2026-07-07T10:00:00.000Z'),
  pensionId: 'pen-1',
  restaurant: { id: 'rest-1', name: 'La Buena Mesa', slug: 'la-buena-mesa' },
  client: { id: 'cli-1', fullName: 'Ana Pérez', email: 'ana@x.dev' },
};

/** A well-formed PDF starts with the "%PDF" magic bytes and ends with "%%EOF". */
const PDF_MAGIC = '%PDF';

describe('renderInvoicePdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buffer = await renderInvoicePdf(baseInvoice);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);
    expect(buffer.toString('latin1')).toContain('%%EOF');
  });

  it('renders a voided invoice without throwing', async () => {
    const buffer = await renderInvoicePdf({ ...baseInvoice, status: 'VOIDED' });

    expect(buffer.subarray(0, 4).toString('latin1')).toBe(PDF_MAGIC);
  });
});
