import { Prisma } from '@prisma/client';
import { formatSerial, InvoiceRow, toInvoiceView } from './invoice-view';

describe('formatSerial', () => {
  it('zero-pads the number to six digits under the series code', () => {
    expect(formatSerial('F001', 1)).toBe('F001-000001');
    expect(formatSerial('F001', 42)).toBe('F001-000042');
  });

  it('does not truncate numbers longer than the pad width', () => {
    expect(formatSerial('F001', 1234567)).toBe('F001-1234567');
  });
});

describe('toInvoiceView', () => {
  const row: InvoiceRow = {
    id: 'inv-1',
    paymentId: 'pay-1',
    seriesId: 'ser-1',
    number: 7,
    issuedAt: new Date('2026-07-07T10:00:00.000Z'),
    total: new Prisma.Decimal('300.00'),
    pdfUrl: null,
    status: 'ISSUED',
    createdAt: new Date('2026-07-07T10:00:00.000Z'),
    series: { series: 'F001' },
    payment: {
      pension: {
        id: 'pen-1',
        restaurant: { id: 'rest-1', name: 'La Buena Mesa', slug: 'la-buena-mesa' },
        client: { id: 'cli-1', fullName: 'Ana Pérez', email: 'ana@x.dev' },
      },
    },
  };

  it('flattens the row into the audience-facing view with a decimal total', () => {
    const view = toInvoiceView(row);

    expect(view).toEqual({
      id: 'inv-1',
      series: 'F001',
      number: 7,
      serial: 'F001-000007',
      status: 'ISSUED',
      total: 300,
      issuedAt: new Date('2026-07-07T10:00:00.000Z'),
      pensionId: 'pen-1',
      restaurant: { id: 'rest-1', name: 'La Buena Mesa', slug: 'la-buena-mesa' },
      client: { id: 'cli-1', fullName: 'Ana Pérez', email: 'ana@x.dev' },
    });
  });
});
